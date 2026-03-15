"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

// ─── FFmpeg Singleton (mirrors use-video-stitcher.ts) ───────────────────────
// FFmpeg WASM only loads once per page; a separate module-level singleton is
// fine — if the engine is already loaded the second `load()` is a no-op.

let ffmpegSingleton: FFmpeg | null = null;
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

// ─── FFmpeg Helpers ─────────────────────────────────────────────────────────

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
      `SaaS demo stitching failed at "${step}" (FFmpeg exit ${code}). ` +
      `The video may be corrupt, inaccessible, or in an unsupported format.`,
    );
  }
}

// ─── Silence-trimming utilities (copied from use-video-stitcher.ts) ─────────

const TRANSITION_BUFFER     = 0.15;
const MIN_SILENCE_TO_CUT    = 0.5;
const MIN_SEGMENT_DURATION  = 0.2;
const MAX_SEGMENTS_PER_CLIP = 6;

type Segment = { start: number; end: number };

function getSpeechSegments(log: string, duration: number): Segment[] {
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
    detectCode = await ffmpeg.exec([
      "-i", filename,
      "-af", "silencedetect=n=-30dB:d=0.1",
      "-f", "null", "-",
    ]);
  } finally {
    ffmpeg.off("log", handler);
  }

  console.log(`[saas-stitcher] silencedetect ${filename} exit=${detectCode}`);

  const duration = parseDuration(log);
  console.log(`[saas-stitcher] parsed duration=${duration}s for ${filename}`);

  if (duration === 0) {
    throw new Error(
      `Could not read duration from "${filename}". ` +
      `The video URL may have expired or the file may be corrupt.`,
    );
  }

  const segs = getSpeechSegments(log, duration);
  const segStr = segs.map(s => `${s.start.toFixed(2)}-${s.end.toFixed(2)}`).join(", ");
  console.log(`[saas-stitcher] ${filename} → ${segs.length} seg(s): [${segStr}] (total ${duration.toFixed(2)}s)`);
  return segs;
}

async function encodeSegment(
  ffmpeg: FFmpeg,
  inputFile: string,
  start: number,
  duration: number,
  outputFile: string,
): Promise<void> {
  await execOrThrow(ffmpeg, [
    "-i", inputFile,
    "-ss", start.toFixed(3),
    "-t", duration.toFixed(3),
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "35",
    "-c:a", "aac",
    "-b:a", "128k",
    outputFile,
  ], `encode-${outputFile}`);
}

/**
 * Detect speech segments, re-encode each one, then concat them into outputFile.
 * Returns all temp file names created (caller passes to cleanupFFmpegFiles).
 */
async function prepareClip(
  ffmpeg: FFmpeg,
  inputFile: string,
  outputFile: string,
): Promise<string[]> {
  const segments = await detectSpeechSegments(ffmpeg, inputFile);
  const created: string[] = [];

  if (segments.length === 1) {
    const seg = segments[0];
    console.log(`[saas-stitcher] encode ${inputFile}: ${seg.start.toFixed(3)}s → ${seg.end.toFixed(3)}s`);
    await encodeSegment(ffmpeg, inputFile, seg.start, seg.end - seg.start, outputFile);
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
    console.log(`[saas-stitcher] encode ${inputFile} seg${i}: ${seg.start.toFixed(3)}s → ${seg.end.toFixed(3)}s`);
    await encodeSegment(ffmpeg, inputFile, seg.start, seg.end - seg.start, segFile);
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
  ], `concat-${inputFile}-segs`);
  created.push(outputFile);
  return created;
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

const BASE_FILES = [
  "hook.mp4", "body.mp4", "cta.mp4", "screen.mp4",
  "hook_t.mp4", "cta_t.mp4",
  "body_audio.aac", "screen_scaled.mp4", "saas_body.mp4",
  "list.txt", "output.mp4",
];

async function cleanupFFmpegFiles(ffmpeg: FFmpeg, extraFiles: string[] = []) {
  for (const f of [...new Set([...BASE_FILES, ...extraFiles])]) {
    try { await ffmpeg.deleteFile(f); } catch { /* ignore - file may not exist */ }
  }
}

// ─── Format Dimensions ─────────────────────────────────────────────────────

type VideoFormat = "9:16" | "16:9";

function getDimensions(format: VideoFormat): { w: number; h: number } {
  return format === "9:16" ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 };
}

// ─── Core Pipeline ──────────────────────────────────────────────────────────

export type SaasDemoStitchStatus =
  | "idle"
  | "loading_ffmpeg"
  | "fetching"
  | "extracting_audio"
  | "scaling"
  | "muxing"
  | "trimming"
  | "concat"
  | "done"
  | "error";

export const SAAS_DEMO_STATUS_LABELS: Record<SaasDemoStitchStatus, string> = {
  idle: "Stitch & Download",
  loading_ffmpeg: "Loading editor…",
  fetching: "Fetching segments…",
  extracting_audio: "Extracting voiceover…",
  scaling: "Scaling screen recording…",
  muxing: "Muxing audio…",
  trimming: "Trimming hook & CTA…",
  concat: "Stitching final video…",
  done: "Download Stitched",
  error: "Retry Stitch",
};

interface SaasDemoStitchInput {
  hookUrl: string;
  bodyUrl: string;
  ctaUrl: string;
  screenRecordingUrl: string;
  format: VideoFormat;
}

/**
 * Non-hook version: returns a Blob directly.
 * Used for batch operations without React state.
 *
 * Pipeline:
 * 1. Fetch all 4 files
 * 2. Extract audio from body (AI-generated) video
 * 3. Scale screen recording to target format dimensions
 * 4. Mux extracted audio onto scaled screen recording (-shortest)
 * 5. Trim hook & CTA (silence removal via prepareClip)
 * 6. Concat: hook_t.mp4 + saas_body.mp4 + cta_t.mp4
 */
export async function saasDemoStitchToBlob(
  input: SaasDemoStitchInput,
): Promise<Blob> {
  const { hookUrl, bodyUrl, ctaUrl, screenRecordingUrl, format } = input;

  if (ffmpegBusy) {
    throw new Error("FFmpeg is already in use - wait for the current stitch to finish.");
  }
  ffmpegBusy = true;

  try {
    console.log("[saas-stitcher] loading FFmpeg…");
    const [ffmpeg, { fetchFile }] = await Promise.all([
      getFFmpeg(),
      import("@ffmpeg/util"),
    ]);
    console.log("[saas-stitcher] FFmpeg loaded OK");

    await cleanupFFmpegFiles(ffmpeg);

    // ── Step 1: Fetch all clips ──────────────────────────────────────────
    console.log("[saas-stitcher] fetching clips…");
    await Promise.all([
      ffmpeg.writeFile("hook.mp4", await fetchFile(hookUrl))
        .catch(async () => ffmpeg.writeFile("hook.mp4", await fetchFile(hookUrl))),
      ffmpeg.writeFile("body.mp4", await fetchFile(bodyUrl))
        .catch(async () => ffmpeg.writeFile("body.mp4", await fetchFile(bodyUrl))),
      ffmpeg.writeFile("cta.mp4", await fetchFile(ctaUrl))
        .catch(async () => ffmpeg.writeFile("cta.mp4", await fetchFile(ctaUrl))),
      ffmpeg.writeFile("screen.mp4", await fetchFile(screenRecordingUrl))
        .catch(async () => ffmpeg.writeFile("screen.mp4", await fetchFile(screenRecordingUrl))),
    ]);
    console.log("[saas-stitcher] clips fetched OK");

    // ── Step 2: Extract audio from body video ────────────────────────────
    console.log("[saas-stitcher] extracting audio from body…");
    await execOrThrow(ffmpeg, [
      "-i", "body.mp4",
      "-vn",
      "-c:a", "aac",
      "body_audio.aac",
    ], "extract-audio");
    console.log("[saas-stitcher] audio extracted OK");

    // ── Step 3: Scale screen recording to target dimensions ──────────────
    const { w, h } = getDimensions(format);
    console.log(`[saas-stitcher] scaling screen recording to ${w}x${h}…`);
    await execOrThrow(ffmpeg, [
      "-i", "screen.mp4",
      "-vf", `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "35",
      "-an",
      "screen_scaled.mp4",
    ], "scale-screen");
    console.log("[saas-stitcher] screen scaled OK");

    // ── Step 4: Mux audio onto scaled screen recording ───────────────────
    console.log("[saas-stitcher] muxing audio onto screen recording…");
    await execOrThrow(ffmpeg, [
      "-i", "screen_scaled.mp4",
      "-i", "body_audio.aac",
      "-c:v", "copy",
      "-c:a", "aac",
      "-map", "0:v",
      "-map", "1:a",
      "-shortest",
      "saas_body.mp4",
    ], "mux-audio");
    console.log("[saas-stitcher] mux done OK");

    // ── Step 5: Prepare hook & CTA (silence trimming) ────────────────────
    console.log("[saas-stitcher] preparing hook…");
    const hookTmp = await prepareClip(ffmpeg, "hook.mp4", "hook_t.mp4");
    console.log("[saas-stitcher] preparing cta…");
    const ctaTmp  = await prepareClip(ffmpeg, "cta.mp4", "cta_t.mp4");
    const extraTempFiles = [...hookTmp, ...ctaTmp];
    console.log("[saas-stitcher] hook & CTA prepared OK");

    // ── Step 6: Final concat ─────────────────────────────────────────────
    console.log("[saas-stitcher] concatenating final video…");
    const manifest = "file 'hook_t.mp4'\nfile 'saas_body.mp4'\nfile 'cta_t.mp4'\n";
    await ffmpeg.writeFile("list.txt", new TextEncoder().encode(manifest));
    await execOrThrow(ffmpeg, [
      "-f", "concat", "-safe", "0",
      "-i", "list.txt",
      "-c", "copy",
      "output.mp4",
    ], "final-concat");
    console.log("[saas-stitcher] concat done");

    const data = (await ffmpeg.readFile("output.mp4")) as Uint8Array;
    const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });

    await cleanupFFmpegFiles(ffmpeg, extraTempFiles);
    console.log("[saas-stitcher] done, blob size:", blob.size);
    return blob;
  } finally {
    ffmpegBusy = false;
  }
}

// ─── React Hook ─────────────────────────────────────────────────────────────

export function useSaasDemoStitcher() {
  const [status, setStatus] = useState<SaasDemoStitchStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [stitchedUrl, setStitchedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevBlobUrl = useRef<string | null>(null);

  // Release mutex on unmount (safety net)
  useEffect(() => {
    return () => {
      ffmpegBusy = false;
    };
  }, []);

  const stitch = useCallback(
    async (input: SaasDemoStitchInput) => {
      const { hookUrl, bodyUrl, ctaUrl, screenRecordingUrl, format } = input;

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
        // ── Load FFmpeg ────────────────────────────────────────────────
        setStatus("loading_ffmpeg");
        setProgress(3);
        console.log("[saas-stitcher:hook] loading FFmpeg…");
        const [ffmpegInstance, { fetchFile }] = await Promise.all([
          getFFmpeg(),
          import("@ffmpeg/util"),
        ]);
        ffmpeg = ffmpegInstance;
        console.log("[saas-stitcher:hook] FFmpeg loaded OK");

        await cleanupFFmpegFiles(ffmpeg);

        // ── Fetch all 4 clips ──────────────────────────────────────────
        setStatus("fetching");
        setProgress(8);
        await Promise.all([
          ffmpeg.writeFile("hook.mp4", await fetchFile(hookUrl))
            .catch(async () => ffmpeg!.writeFile("hook.mp4", await fetchFile(hookUrl))),
          ffmpeg.writeFile("body.mp4", await fetchFile(bodyUrl))
            .catch(async () => ffmpeg!.writeFile("body.mp4", await fetchFile(bodyUrl))),
          ffmpeg.writeFile("cta.mp4", await fetchFile(ctaUrl))
            .catch(async () => ffmpeg!.writeFile("cta.mp4", await fetchFile(ctaUrl))),
          ffmpeg.writeFile("screen.mp4", await fetchFile(screenRecordingUrl))
            .catch(async () => ffmpeg!.writeFile("screen.mp4", await fetchFile(screenRecordingUrl))),
        ]);
        setProgress(20);

        // ── Extract audio from body video ──────────────────────────────
        setStatus("extracting_audio");
        setProgress(25);
        console.log("[saas-stitcher:hook] extracting audio from body…");
        await execOrThrow(ffmpeg, [
          "-i", "body.mp4",
          "-vn",
          "-c:a", "aac",
          "body_audio.aac",
        ], "extract-audio");
        setProgress(35);

        // ── Scale screen recording ─────────────────────────────────────
        setStatus("scaling");
        setProgress(38);
        const { w, h } = getDimensions(format);
        console.log(`[saas-stitcher:hook] scaling screen recording to ${w}x${h}…`);
        await execOrThrow(ffmpeg, [
          "-i", "screen.mp4",
          "-vf", `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`,
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-crf", "35",
          "-an",
          "screen_scaled.mp4",
        ], "scale-screen");
        setProgress(50);

        // ── Mux audio onto scaled screen recording ─────────────────────
        setStatus("muxing");
        setProgress(53);
        console.log("[saas-stitcher:hook] muxing audio onto screen recording…");
        await execOrThrow(ffmpeg, [
          "-i", "screen_scaled.mp4",
          "-i", "body_audio.aac",
          "-c:v", "copy",
          "-c:a", "aac",
          "-map", "0:v",
          "-map", "1:a",
          "-shortest",
          "saas_body.mp4",
        ], "mux-audio");
        setProgress(62);

        // ── Trim hook & CTA ────────────────────────────────────────────
        setStatus("trimming");
        setProgress(65);
        console.log("[saas-stitcher:hook] preparing hook…");
        const hookTmp = await prepareClip(ffmpeg, "hook.mp4", "hook_t.mp4");
        setProgress(73);
        console.log("[saas-stitcher:hook] preparing cta…");
        const ctaTmp  = await prepareClip(ffmpeg, "cta.mp4", "cta_t.mp4");
        extraTempFiles = [...hookTmp, ...ctaTmp];
        setProgress(80);

        // ── Final concat ───────────────────────────────────────────────
        setStatus("concat");
        setProgress(83);
        console.log("[saas-stitcher:hook] concatenating final video…");
        const manifest = "file 'hook_t.mp4'\nfile 'saas_body.mp4'\nfile 'cta_t.mp4'\n";
        await ffmpeg.writeFile("list.txt", new TextEncoder().encode(manifest));
        await execOrThrow(ffmpeg, [
          "-f", "concat", "-safe", "0",
          "-i", "list.txt",
          "-c", "copy",
          "output.mp4",
        ], "final-concat");
        setProgress(92);

        // ── Read output & create blob URL ──────────────────────────────
        const data = (await ffmpeg.readFile("output.mp4")) as Uint8Array;
        const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });
        const url = URL.createObjectURL(blob);
        prevBlobUrl.current = url;
        setStitchedUrl(url);
        setProgress(100);
        setStatus("done");
        console.log("[saas-stitcher:hook] done, blob size:", blob.size);

      } catch (err) {
        const msg = err instanceof Error ? err.message : "SaaS demo stitching failed";
        console.error("[saas-stitcher:hook] FAILED:", msg, err);
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
