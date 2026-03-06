"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

// Singleton - load once, reuse across stitches
let ffmpegSingleton: FFmpeg | null = null;

// Mutex - FFmpeg WASM is single-threaded; only one stitch can run at a time
let ffmpegBusy = false;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegSingleton?.loaded) return ffmpegSingleton;

  // Dynamically import FFmpeg libraries only when first needed (~1.5-2MB)
  const [{ FFmpeg: FFmpegClass }, { toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util"),
  ]);

  const ffmpeg = new FFmpegClass();
  // Use non-MT core (no SharedArrayBuffer / no COOP+COEP headers required)
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(
      `${baseURL}/ffmpeg-core.wasm`,
      "application/wasm",
    ),
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
 * Parse silence regions from FFmpeg silencedetect log output.
 * Returns the speech start/end trimpoints (cutting leading + trailing silence).
 *
 * FFmpeg log format (per silent region):
 *   silence_start: 0.000000
 *   silence_end: 0.542 | silence_duration: 0.542
 */
const TRANSITION_BUFFER = 0.08; // 80ms breathing room at clip boundaries
const MIN_TRAILING_SILENCE = 0.15; // Cut trailing silence longer than 150ms
const FADE_DURATION = 0.25; // 250ms fade-in/fade-out on each segment

function getSpeechBounds(
  log: string,
  duration: number,
): { start: number; end: number } {
  const silenceStarts = [
    ...log.matchAll(/silence_start: ([\d.]+)/g),
  ].map((m) => parseFloat(m[1]));

  const silenceEnds = [
    ...log.matchAll(/silence_end: ([\d.]+)/g),
  ].map((m) => parseFloat(m[1]));

  let speechStart = 0;
  let speechEnd = duration;

  // Leading silence: first silence starts at or very close to 0
  // Kling often has 200-400ms of ambient silence before speech starts.
  // Keep TRANSITION_BUFFER of pre-speech audio so clips don't feel cut mid-breath.
  if (silenceStarts.length > 0 && silenceStarts[0] < 0.5) {
    speechStart = Math.max(0, (silenceEnds[0] ?? 0) - TRANSITION_BUFFER);
  }

  // Trailing silence: last silence_start has no matching silence_end
  // OR its silence_end is within 0.3s of total duration
  const lastStart = silenceStarts[silenceStarts.length - 1];
  const lastEnd = silenceEnds[silenceEnds.length - 1];

  if (lastStart !== undefined) {
    const isLastSilenceTrailing =
      lastEnd === undefined || Math.abs(lastEnd - duration) < 0.3;
    // Only treat as trailing if it's not the same silence as the leading one
    const isDifferentFromLeading =
      silenceStarts.length > 1 || silenceStarts[0] >= 0.15;
    // Only cut if trailing silence is long enough to be noticeable
    const trailingSilenceDuration = duration - lastStart;
    if (isLastSilenceTrailing && isDifferentFromLeading && trailingSilenceDuration > MIN_TRAILING_SILENCE) {
      speechEnd = lastStart + TRANSITION_BUFFER; // keep 100ms after last word
    }
  }

  // Safety clamp - always leave at least 0.5s of content
  return {
    start: Math.max(0, speechStart),
    end: Math.min(duration, Math.max(speechEnd, speechStart + 0.5)),
  };
}

/** Run silencedetect on a file already in the FFmpeg virtual FS */
async function detectSpeechBounds(
  ffmpeg: FFmpeg,
  filename: string,
): Promise<{ start: number; end: number }> {
  let log = "";
  const handler = ({ message }: { message: string }) => {
    log += message + "\n";
  };

  ffmpeg.on("log", handler);
  // -f null -  → discard output, only need the log
  await ffmpeg.exec([
    "-i",
    filename,
    "-af",
    "silencedetect=n=-30dB:d=0.08",
    "-f",
    "null",
    "-",
  ]);
  ffmpeg.off("log", handler);

  const duration = parseDuration(log);
  return getSpeechBounds(log, duration);
}

/** Clean up temp files in the FFmpeg virtual FS between batch calls */
async function cleanupFFmpegFiles(ffmpeg: FFmpeg) {
  const tempFiles = ["hook.mp4", "body.mp4", "cta.mp4", "hook_t.mp4", "body_t.mp4", "cta_t.mp4", "list.txt", "output.mp4"];
  for (const f of tempFiles) {
    try { await ffmpeg.deleteFile(f); } catch { /* ignore - file may not exist */ }
  }
}

/**
 * Non-hook version: returns a Blob directly.
 * Used by useBatchStitcher to stitch combos sequentially without React state.
 * Cleans up all temp files after each run to prevent WASM memory leaks.
 */
export async function stitchToBlob(
  hookUrl: string,
  bodyUrl: string,
  ctaUrl: string,
): Promise<Blob> {
  if (ffmpegBusy) throw new Error("FFmpeg is already in use - wait for the current stitch to finish.");
  ffmpegBusy = true;

  try {
    const [ffmpeg, { fetchFile }] = await Promise.all([
      getFFmpeg(),
      import("@ffmpeg/util"),
    ]);

    // Clean up any leftover files from a previous run
    await cleanupFFmpegFiles(ffmpeg);

    await Promise.all([
      ffmpeg.writeFile("hook.mp4", await fetchFile(hookUrl))
        .catch(async () => ffmpeg.writeFile("hook.mp4", await fetchFile(hookUrl))),
      ffmpeg.writeFile("body.mp4", await fetchFile(bodyUrl))
        .catch(async () => ffmpeg.writeFile("body.mp4", await fetchFile(bodyUrl))),
      ffmpeg.writeFile("cta.mp4", await fetchFile(ctaUrl))
        .catch(async () => ffmpeg.writeFile("cta.mp4", await fetchFile(ctaUrl))),
    ]);

    const [hookB, bodyB, ctaB] = await Promise.all([
      detectSpeechBounds(ffmpeg, "hook.mp4"),
      detectSpeechBounds(ffmpeg, "body.mp4"),
      detectSpeechBounds(ffmpeg, "cta.mp4"),
    ]);

    // Build fade filters for each segment: fade-in at start + fade-out at end.
    // This creates smooth visual/audio transitions at every cut point.
    function fadeFilters(dur: number) {
      const fo = Math.max(0, dur - FADE_DURATION).toFixed(3);
      return {
        vf: `fade=t=in:st=0:d=${FADE_DURATION},fade=t=out:st=${fo}:d=${FADE_DURATION}`,
        af: `afade=t=in:st=0:d=${FADE_DURATION},afade=t=out:st=${fo}:d=${FADE_DURATION}`,
      };
    }
    const hf = fadeFilters(hookB.end - hookB.start);
    const bf = fadeFilters(bodyB.end - bodyB.start);
    const cf = fadeFilters(ctaB.end - ctaB.start);

    await ffmpeg.exec(["-i", "hook.mp4", "-ss", hookB.start.toFixed(3), "-to", hookB.end.toFixed(3), "-vf", hf.vf, "-af", hf.af, "-c:v", "libx264", "-c:a", "aac", "hook_t.mp4"]);
    await ffmpeg.exec(["-i", "body.mp4", "-ss", bodyB.start.toFixed(3), "-to", bodyB.end.toFixed(3), "-vf", bf.vf, "-af", bf.af, "-c:v", "libx264", "-c:a", "aac", "body_t.mp4"]);
    await ffmpeg.exec(["-i", "cta.mp4",  "-ss", ctaB.start.toFixed(3),  "-to", ctaB.end.toFixed(3),  "-vf", cf.vf, "-af", cf.af, "-c:v", "libx264", "-c:a", "aac", "cta_t.mp4"]);

    const manifest = "file 'hook_t.mp4'\nfile 'body_t.mp4'\nfile 'cta_t.mp4'\n";
    await ffmpeg.writeFile("list.txt", new TextEncoder().encode(manifest));
    await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "output.mp4"]);

    const data = (await ffmpeg.readFile("output.mp4")) as Uint8Array;
    const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });

    await cleanupFFmpegFiles(ffmpeg);
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

  // Reset the busy flag on unmount so a remount doesn't get stuck
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

      // Revoke previous blob to free memory
      if (prevBlobUrl.current) {
        URL.revokeObjectURL(prevBlobUrl.current);
        prevBlobUrl.current = null;
      }

      setStitchedUrl(null);
      setError(null);
      setProgress(0);

      try {
        setStatus("loading_ffmpeg");
        setProgress(5);
        const [ffmpeg, { fetchFile }] = await Promise.all([
          getFFmpeg(),
          import("@ffmpeg/util"),
        ]);

        setStatus("fetching");
        setProgress(15);
        await Promise.all([
          ffmpeg
            .writeFile("hook.mp4", await fetchFile(hookUrl))
            .catch(async () => ffmpeg.writeFile("hook.mp4", await fetchFile(hookUrl))),
          ffmpeg
            .writeFile("body.mp4", await fetchFile(bodyUrl))
            .catch(async () => ffmpeg.writeFile("body.mp4", await fetchFile(bodyUrl))),
          ffmpeg
            .writeFile("cta.mp4", await fetchFile(ctaUrl))
            .catch(async () => ffmpeg.writeFile("cta.mp4", await fetchFile(ctaUrl))),
        ]);

        setStatus("detecting");
        setProgress(30);
        const [hookB, bodyB, ctaB] = await Promise.all([
          detectSpeechBounds(ffmpeg, "hook.mp4"),
          detectSpeechBounds(ffmpeg, "body.mp4"),
          detectSpeechBounds(ffmpeg, "cta.mp4"),
        ]);

        setStatus("trimming");
        setProgress(45);
        // Trim each clip to its speech boundaries, adding fade-in/fade-out for smooth cuts.
        function fadeFilters(dur: number) {
          const fo = Math.max(0, dur - FADE_DURATION).toFixed(3);
          return {
            vf: `fade=t=in:st=0:d=${FADE_DURATION},fade=t=out:st=${fo}:d=${FADE_DURATION}`,
            af: `afade=t=in:st=0:d=${FADE_DURATION},afade=t=out:st=${fo}:d=${FADE_DURATION}`,
          };
        }
        const hf = fadeFilters(hookB.end - hookB.start);
        const bf = fadeFilters(bodyB.end - bodyB.start);
        const cf = fadeFilters(ctaB.end - ctaB.start);

        await ffmpeg.exec([
          "-i", "hook.mp4",
          "-ss", hookB.start.toFixed(3),
          "-to", hookB.end.toFixed(3),
          "-vf", hf.vf, "-af", hf.af,
          "-c:v", "libx264", "-c:a", "aac",
          "hook_t.mp4",
        ]);
        setProgress(55);
        await ffmpeg.exec([
          "-i", "body.mp4",
          "-ss", bodyB.start.toFixed(3),
          "-to", bodyB.end.toFixed(3),
          "-vf", bf.vf, "-af", bf.af,
          "-c:v", "libx264", "-c:a", "aac",
          "body_t.mp4",
        ]);
        setProgress(65);
        await ffmpeg.exec([
          "-i", "cta.mp4",
          "-ss", ctaB.start.toFixed(3),
          "-to", ctaB.end.toFixed(3),
          "-vf", cf.vf, "-af", cf.af,
          "-c:v", "libx264", "-c:a", "aac",
          "cta_t.mp4",
        ]);

        setStatus("concat");
        setProgress(80);
        // Write concat manifest and join (clips are already encoded with fades)
        const manifest = "file 'hook_t.mp4'\nfile 'body_t.mp4'\nfile 'cta_t.mp4'\n";
        await ffmpeg.writeFile(
          "list.txt",
          new TextEncoder().encode(manifest),
        );

        await ffmpeg.exec([
          "-f", "concat",
          "-safe", "0",
          "-i", "list.txt",
          "-c", "copy",
          "output.mp4",
        ]);

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
        setError(msg);
        setStatus("error");
      } finally {
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
