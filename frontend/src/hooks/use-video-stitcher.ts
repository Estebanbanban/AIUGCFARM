"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

// Singleton - load once, reuse across stitches
let ffmpegSingleton: FFmpeg | null = null;

// Mutex - FFmpeg WASM is single-threaded; only one stitch can run at a time
let ffmpegBusy = false;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;

  const [{ FFmpeg: FFmpegClass }, { toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util"),
  ]);

  const ffmpeg = new FFmpegClass();
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpegSingleton = ffmpeg;
  return ffmpeg;
}

/** Parse total duration from FFmpeg log: "Duration: HH:MM:SS.ss" */
function parseDuration(log: string): number {
  const match = log.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d+)/);
  if (!match) return 0;
  const [, h, m, s, sub] = match;
  return (
    parseInt(h) * 3600 +
    parseInt(m) * 60 +
    parseInt(s) +
    parseInt(sub) / Math.pow(10, sub.length)
  );
}

/**
 * Wrapper around ffmpeg.exec() that throws on non-zero exit code.
 * ffmpeg.exec() resolves with the exit code — it never rejects — so without
 * this wrapper a failed FFmpeg command silently continues.
 */
async function execOrThrow(
  ffmpeg: FFmpeg,
  args: string[],
  step: string,
): Promise<void> {
  const code = await ffmpeg.exec(args);
  if (code !== 0) {
    throw new Error(
      `Stitching failed at "${step}" (FFmpeg exit ${code}). ` +
      `The video may be corrupt, inaccessible, or in an unsupported format.`,
    );
  }
}

const TRANSITION_BUFFER     = 0.2;   // 200ms buffer at each edge of every cut
const MIN_SILENCE_TO_CUT    = 0.8;   // Only remove silences > 800ms (net removed >= 400ms)
const MIN_SEGMENT_DURATION  = 0.3;   // Discard speech segments < 300ms
const MAX_SEGMENTS_PER_CLIP = 6;     // Safety cap; fall back to full-clip if exceeded

type Segment = { start: number; end: number };

/**
 * Parse silence regions from FFmpeg silencedetect log output.
 * Returns an ordered list of speech segments to keep.
 * Exported for unit testing.
 */
export function getSpeechSegments(log: string, duration: number): Segment[] {
  const silenceStarts = [
    ...log.matchAll(/silence_start: ([\d.]+)/g),
  ].map((m) => parseFloat(m[1]));

  const silenceEnds = [
    ...log.matchAll(/silence_end: ([\d.]+)/g),
  ].map((m) => parseFloat(m[1]));

  const silences: Segment[] = silenceStarts.map((start, i) => ({
    start,
    end: silenceEnds[i] ?? duration,
  }));

  const cuttable = silences.filter((s) => s.end - s.start > MIN_SILENCE_TO_CUT);
  if (cuttable.length === 0) return [{ start: 0, end: duration }];

  const segments: Segment[] = [];
  let cursor = 0;

  for (const silence of cuttable) {
    const segEnd = Math.min(silence.start + TRANSITION_BUFFER, duration);
    if (segEnd - cursor >= MIN_SEGMENT_DURATION) {
      segments.push({ start: cursor, end: segEnd });
    }
    cursor = Math.max(cursor, silence.end - TRANSITION_BUFFER);
  }

  if (duration - cursor >= MIN_SEGMENT_DURATION) {
    segments.push({ start: cursor, end: duration });
  }

  if (segments.length > MAX_SEGMENTS_PER_CLIP) {
    return [{ start: 0, end: duration }];
  }

  return segments.length > 0 ? segments : [{ start: 0, end: duration }];
}

/** Run silencedetect on a file already in the FFmpeg virtual FS */
async function detectSpeechSegments(
  ffmpeg: FFmpeg,
  filename: string,
): Promise<Segment[]> {
  let log = "";
  const handler = ({ message }: { message: string }) => {
    log += message + "\n";
  };

  ffmpeg.on("log", handler);
  let detectCode = 0;
  try {
    // Use plain exec — a non-zero exit (e.g. no audio stream) is handled
    // gracefully below rather than throwing, so silence detection is non-fatal.
    detectCode = await ffmpeg.exec([
      "-i", filename,
      "-af", "silencedetect=n=-40dB:d=0.15",
      "-f", "null", "-",
    ]);
  } finally {
    // Always detach so stale output doesn't bleed into later runs
    ffmpeg.off("log", handler);
  }

  console.log(`[stitcher] silencedetect ${filename} exit=${detectCode}`);

  const duration = parseDuration(log);
  console.log(`[stitcher] parsed duration=${duration}s for ${filename}`);

  if (duration === 0) {
    // Can't even probe the file → real error (corrupt or URL expired)
    throw new Error(
      `Could not read duration from "${filename}". ` +
      `The video URL may have expired or the file may be corrupt.`,
    );
  }

  // getSpeechSegments handles partial log (e.g. no audio → no silence events → full clip)
  const segs = getSpeechSegments(log, duration);
  console.log(`[stitcher] speech segments for ${filename}:`, segs);
  return segs;
}

/**
 * Trim a clip to its speech segments and write the result to outputFile.
 * Single segment: one re-encode pass.
 * Multiple segments: re-encode each → internal concat → outputFile.
 * Returns all temp file names created (caller passes to cleanupFFmpegFiles).
 */
async function trimClipToSegments(
  ffmpeg: FFmpeg,
  inputFile: string,
  segments: Segment[],
  outputFile: string,
): Promise<string[]> {
  const created: string[] = [];
  console.log(`[stitcher] trimming ${inputFile} to ${segments.length} segment(s)`, segments);

  if (segments.length === 1) {
    const seg = segments[0];
    await execOrThrow(ffmpeg, [
      "-i", inputFile,
      "-ss", seg.start.toFixed(3),
      "-to", seg.end.toFixed(3),
      "-c:v", "libx264", "-c:a", "aac",
      outputFile,
    ], `trim-${inputFile}`);
    created.push(outputFile);
    return created;
  }

  const prefix = outputFile.replace(/\.mp4$/, "");
  const segFiles: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segFile = `${prefix}_s${i}.mp4`;
    segFiles.push(segFile);
    created.push(segFile);
    await execOrThrow(ffmpeg, [
      "-i", inputFile,
      "-ss", seg.start.toFixed(3),
      "-to", seg.end.toFixed(3),
      "-c:v", "libx264", "-c:a", "aac",
      segFile,
    ], `trim-${inputFile}-seg${i}`);
  }

  const listFile = `${prefix}_list.txt`;
  created.push(listFile);
  const manifest = segFiles.map((f) => `file '${f}'`).join("\n") + "\n";
  await ffmpeg.writeFile(listFile, new TextEncoder().encode(manifest));
  await execOrThrow(ffmpeg, [
    "-f", "concat", "-safe", "0",
    "-i", listFile,
    "-c", "copy",
    outputFile,
  ], `concat-${inputFile}-segments`);
  created.push(outputFile);
  return created;
}

/** Detect speech segments and trim clip to outputFile in one step */
async function prepareClip(
  ffmpeg: FFmpeg,
  inputFile: string,
  outputFile: string,
): Promise<string[]> {
  const segments = await detectSpeechSegments(ffmpeg, inputFile);
  return trimClipToSegments(ffmpeg, inputFile, segments, outputFile);
}

/** Clean up temp files in the FFmpeg virtual FS */
async function cleanupFFmpegFiles(ffmpeg: FFmpeg, extraFiles: string[] = []) {
  const baseFiles = [
    "hook.mp4", "body.mp4", "cta.mp4",
    "hook_t.mp4", "body_t.mp4", "cta_t.mp4",
    "list.txt", "output.mp4",
  ];
  for (const f of [...new Set([...baseFiles, ...extraFiles])]) {
    try { await ffmpeg.deleteFile(f); } catch { /* ignore - file may not exist */ }
  }
}

/**
 * Non-hook version: returns a Blob directly.
 * Used by useBatchStitcher to stitch combos sequentially without React state.
 */
export async function stitchToBlob(
  hookUrl: string,
  bodyUrl: string,
  ctaUrl: string,
): Promise<Blob> {
  if (ffmpegBusy) throw new Error("FFmpeg is already in use - wait for the current stitch to finish.");
  ffmpegBusy = true;

  try {
    console.log("[stitcher] loading FFmpeg…");
    const [ffmpeg, { fetchFile }] = await Promise.all([
      getFFmpeg(),
      import("@ffmpeg/util"),
    ]);
    console.log("[stitcher] FFmpeg loaded OK");

    await cleanupFFmpegFiles(ffmpeg);

    console.log("[stitcher] fetching clips…");
    await Promise.all([
      ffmpeg.writeFile("hook.mp4", await fetchFile(hookUrl))
        .catch(async () => ffmpeg.writeFile("hook.mp4", await fetchFile(hookUrl))),
      ffmpeg.writeFile("body.mp4", await fetchFile(bodyUrl))
        .catch(async () => ffmpeg.writeFile("body.mp4", await fetchFile(bodyUrl))),
      ffmpeg.writeFile("cta.mp4", await fetchFile(ctaUrl))
        .catch(async () => ffmpeg.writeFile("cta.mp4", await fetchFile(ctaUrl))),
    ]);
    console.log("[stitcher] clips fetched OK");

    console.log("[stitcher] preparing hook…");
    const hookTmp = await prepareClip(ffmpeg, "hook.mp4", "hook_t.mp4");
    console.log("[stitcher] preparing body…");
    const bodyTmp = await prepareClip(ffmpeg, "body.mp4", "body_t.mp4");
    console.log("[stitcher] preparing cta…");
    const ctaTmp  = await prepareClip(ffmpeg, "cta.mp4",  "cta_t.mp4");
    const extraTempFiles = [...hookTmp, ...bodyTmp, ...ctaTmp];
    console.log("[stitcher] all clips prepared, concatenating…");

    const manifest = "file 'hook_t.mp4'\nfile 'body_t.mp4'\nfile 'cta_t.mp4'\n";
    await ffmpeg.writeFile("list.txt", new TextEncoder().encode(manifest));
    await execOrThrow(ffmpeg, ["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "output.mp4"], "final-concat");
    console.log("[stitcher] concat done");

    const data = (await ffmpeg.readFile("output.mp4")) as Uint8Array;
    const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });

    await cleanupFFmpegFiles(ffmpeg, extraTempFiles);
    console.log("[stitcher] done, blob size:", blob.size);
    return blob;
  } finally {
    ffmpegBusy = false;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export type StitchStatus =
  | "idle"
  | "loading_ffmpeg"
  | "fetching"
  | "detecting"
  | "trimming"
  | "concat"
  | "done"
  | "error";

export const STITCH_STATUS_LABELS: Record<StitchStatus, string> = {
  idle: "Stitch & Download",
  loading_ffmpeg: "Loading editor…",
  fetching: "Fetching segments…",
  detecting: "Detecting speech…",
  trimming: "Trimming silence…",
  concat: "Stitching clips…",
  done: "Download Stitched",
  error: "Retry Stitch",
};

export function useVideoStitcher() {
  const [status, setStatus] = useState<StitchStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [stitchedUrl, setStitchedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevBlobUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      ffmpegBusy = false;
    };
  }, []);

  const stitch = useCallback(
    async (hookUrl: string, bodyUrl: string, ctaUrl: string) => {
      if (ffmpegBusy) {
        setError("FFmpeg is already in use - wait for the current stitch to finish.");
        setStatus("error");
        return;
      }
      ffmpegBusy = true;

      if (prevBlobUrl.current) {
        URL.revokeObjectURL(prevBlobUrl.current);
        prevBlobUrl.current = null;
      }

      setStitchedUrl(null);
      setError(null);
      setProgress(0);

      let ffmpeg: FFmpeg | null = null;
      let extraTempFiles: string[] = [];

      try {
        setStatus("loading_ffmpeg");
        setProgress(5);
        console.log("[stitcher:hook] loading FFmpeg…");
        const [ffmpegInstance, { fetchFile }] = await Promise.all([
          getFFmpeg(),
          import("@ffmpeg/util"),
        ]);
        ffmpeg = ffmpegInstance;
        console.log("[stitcher:hook] FFmpeg loaded OK");

        // Pre-run cleanup — clear stale files from any previous run on this singleton
        await cleanupFFmpegFiles(ffmpeg);

        setStatus("fetching");
        setProgress(15);
        await Promise.all([
          ffmpeg
            .writeFile("hook.mp4", await fetchFile(hookUrl))
            .catch(async () => ffmpeg!.writeFile("hook.mp4", await fetchFile(hookUrl))),
          ffmpeg
            .writeFile("body.mp4", await fetchFile(bodyUrl))
            .catch(async () => ffmpeg!.writeFile("body.mp4", await fetchFile(bodyUrl))),
          ffmpeg
            .writeFile("cta.mp4", await fetchFile(ctaUrl))
            .catch(async () => ffmpeg!.writeFile("cta.mp4", await fetchFile(ctaUrl))),
        ]);

        setStatus("trimming");
        setProgress(45);
        const hookTmp = await prepareClip(ffmpeg, "hook.mp4", "hook_t.mp4");
        setProgress(55);
        const bodyTmp = await prepareClip(ffmpeg, "body.mp4", "body_t.mp4");
        setProgress(65);
        const ctaTmp  = await prepareClip(ffmpeg, "cta.mp4",  "cta_t.mp4");
        extraTempFiles = [...hookTmp, ...bodyTmp, ...ctaTmp];

        setStatus("concat");
        setProgress(80);
        const manifest = "file 'hook_t.mp4'\nfile 'body_t.mp4'\nfile 'cta_t.mp4'\n";
        await ffmpeg.writeFile("list.txt", new TextEncoder().encode(manifest));
        await execOrThrow(ffmpeg, [
          "-f", "concat",
          "-safe", "0",
          "-i", "list.txt",
          "-c", "copy",
          "output.mp4",
        ], "final-concat");

        setProgress(90);
        const data = (await ffmpeg.readFile("output.mp4")) as Uint8Array;
        const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });
        const url = URL.createObjectURL(blob);
        prevBlobUrl.current = url;
        setStitchedUrl(url);
        setProgress(100);
        setStatus("done");

      } catch (err) {
        const msg = err instanceof Error ? err.message : "Stitching failed";
        console.error("[stitcher:hook] FAILED:", msg, err);
        setError(msg);
        setStatus("error");
      } finally {
        if (ffmpeg) {
          await cleanupFFmpegFiles(ffmpeg, extraTempFiles).catch(() => {});
        }
        ffmpegBusy = false;
      }
    },
    [],
  );

  /** Reset back to idle (e.g. when selection changes) */
  const reset = useCallback(() => {
    if (prevBlobUrl.current) {
      URL.revokeObjectURL(prevBlobUrl.current);
      prevBlobUrl.current = null;
    }
    setStitchedUrl(null);
    setError(null);
    setProgress(0);
    setStatus("idle");
  }, []);

  return { stitch, reset, status, progress, stitchedUrl, error };
}
