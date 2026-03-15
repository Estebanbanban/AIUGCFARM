"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

// ─── FFmpeg Singleton (mirrors use-video-stitcher.ts) ───────────────────────

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
 * Wrapper around ffmpeg's exec() that throws on non-zero exit code.
 * The WASM exec() resolves with the exit code — it never rejects — so without
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
      `Demo insert stitching failed at "${step}" (FFmpeg exit ${code}). ` +
      `The video may be corrupt, inaccessible, or in an unsupported format.`,
    );
  }
}

/** Probe a file already in VFS and return its duration in seconds. */
async function probeDuration(ffmpeg: FFmpeg, filename: string): Promise<number> {
  let log = "";
  const handler = ({ message }: { message: string }) => {
    log += message + "\n";
  };

  ffmpeg.on("log", handler);
  try {
    // -i with -f null triggers a probe; exit code 1 is expected
    await ffmpeg.exec(["-i", filename, "-f", "null", "-"]);
  } finally {
    ffmpeg.off("log", handler);
  }

  const duration = parseDuration(log);
  console.log(`[demo-insert] probed duration=${duration}s for ${filename}`);

  if (duration === 0) {
    throw new Error(
      `Could not read duration from "${filename}". ` +
      `The video URL may have expired or the file may be corrupt.`,
    );
  }
  return duration;
}

// ─── Format Dimensions ─────────────────────────────────────────────────────

type VideoFormat = "9:16" | "16:9";

function getDimensions(format: VideoFormat): { w: number; h: number } {
  return format === "9:16" ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 };
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

const BASE_FILES = [
  "original.mp4", "screen.mp4",
  "original_audio.aac", "screen_scaled.mp4",
  "part_a.mp4", "part_b.mp4", "part_c.mp4",
  "concat_list.txt", "concat.mp4", "output.mp4",
];

async function cleanupFFmpegFiles(ffmpeg: FFmpeg) {
  for (const f of BASE_FILES) {
    try { await ffmpeg.deleteFile(f); } catch { /* ignore - file may not exist */ }
  }
}

// ─── Input Type ─────────────────────────────────────────────────────────────

export interface DemoInsertInput {
  videoUrl: string;           // the original Sora-generated video URL
  screenRecordingUrl: string; // the uploaded screen recording URL
  startSec: number;           // when to start showing the demo (e.g., 3.0)
  endSec: number | null;      // when to stop (null = until end of video)
  format: "9:16" | "16:9";
}

// ─── Status Types ───────────────────────────────────────────────────────────

export type DemoInsertStitchStatus =
  | "idle"
  | "loading_ffmpeg"
  | "fetching"
  | "extracting_audio"
  | "scaling"
  | "splitting"
  | "inserting"
  | "muxing"
  | "done"
  | "error";

export const DEMO_INSERT_STATUS_LABELS: Record<DemoInsertStitchStatus, string> = {
  idle: "Insert Demo & Download",
  loading_ffmpeg: "Loading editor\u2026",
  fetching: "Fetching videos\u2026",
  extracting_audio: "Extracting audio\u2026",
  scaling: "Scaling demo\u2026",
  splitting: "Splitting video\u2026",
  inserting: "Inserting demo\u2026",
  muxing: "Muxing audio\u2026",
  done: "Download Stitched",
  error: "Retry Stitch",
};

// ─── Core Pipeline ──────────────────────────────────────────────────────────

/**
 * Non-hook version: returns a Blob directly.
 * Used for batch operations without React state.
 *
 * Pipeline:
 * 1. Fetch both files
 * 2. Probe original video duration
 * 3. Extract audio from the full original video
 * 4. Scale screen recording to match format dimensions (letterbox)
 * 5. Split original video into Part A (before insert) & Part C (after insert)
 * 6. Trim screen recording to insert duration -> Part B
 * 7. Concat Part A + Part B + Part C
 * 8. Mux the original audio back onto the concatenated video
 */
export async function demoInsertStitchToBlob(
  input: DemoInsertInput,
): Promise<Blob> {
  const { videoUrl, screenRecordingUrl, startSec, endSec, format } = input;

  if (ffmpegBusy) {
    throw new Error("FFmpeg is already in use - wait for the current stitch to finish.");
  }
  ffmpegBusy = true;

  try {
    console.log("[demo-insert] loading FFmpeg...");
    const [ffmpeg, { fetchFile }] = await Promise.all([
      getFFmpeg(),
      import("@ffmpeg/util"),
    ]);
    console.log("[demo-insert] FFmpeg loaded OK");

    await cleanupFFmpegFiles(ffmpeg);

    // -- Step 1: Fetch both files -------------------------------------------
    console.log("[demo-insert] fetching clips...");
    await Promise.all([
      ffmpeg.writeFile("original.mp4", await fetchFile(videoUrl))
        .catch(async () => ffmpeg.writeFile("original.mp4", await fetchFile(videoUrl))),
      ffmpeg.writeFile("screen.mp4", await fetchFile(screenRecordingUrl))
        .catch(async () => ffmpeg.writeFile("screen.mp4", await fetchFile(screenRecordingUrl))),
    ]);
    console.log("[demo-insert] clips fetched OK");

    // -- Step 2: Probe original video duration ------------------------------
    const duration = await probeDuration(ffmpeg, "original.mp4");
    const effectiveEnd = endSec !== null ? Math.min(endSec, duration) : duration;

    if (startSec >= effectiveEnd) {
      throw new Error(
        `Invalid time range: startSec (${startSec}) must be less than endSec (${effectiveEnd}).`,
      );
    }

    // -- Step 3: Extract audio from full original video ---------------------
    console.log("[demo-insert] extracting audio...");
    await execOrThrow(ffmpeg, [
      "-i", "original.mp4",
      "-vn",
      "-c:a", "aac",
      "original_audio.aac",
    ], "extract-audio");
    console.log("[demo-insert] audio extracted OK");

    // -- Step 4: Scale screen recording -------------------------------------
    const { w, h } = getDimensions(format);
    console.log(`[demo-insert] scaling screen recording to ${w}x${h}...`);
    await execOrThrow(ffmpeg, [
      "-i", "screen.mp4",
      "-vf", `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "35",
      "-an",
      "screen_scaled.mp4",
    ], "scale-screen");
    console.log("[demo-insert] screen scaled OK");

    // -- Step 5: Split original video into parts ----------------------------
    const hasParts = { a: startSec > 0, c: endSec !== null && effectiveEnd < duration };

    console.log("[demo-insert] splitting original video...");
    if (hasParts.a) {
      await execOrThrow(ffmpeg, [
        "-i", "original.mp4",
        "-t", startSec.toFixed(3),
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "35",
        "-an",
        "part_a.mp4",
      ], "split-part-a");
      console.log(`[demo-insert] part_a: 0 -> ${startSec}s`);
    }

    if (hasParts.c) {
      await execOrThrow(ffmpeg, [
        "-i", "original.mp4",
        "-ss", effectiveEnd.toFixed(3),
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "35",
        "-an",
        "part_c.mp4",
      ], "split-part-c");
      console.log(`[demo-insert] part_c: ${effectiveEnd}s -> end`);
    }

    // -- Step 6: Trim screen recording to insert duration -------------------
    const insertDuration = effectiveEnd - startSec;
    console.log(`[demo-insert] trimming screen recording to ${insertDuration.toFixed(3)}s...`);
    if (endSec !== null) {
      await execOrThrow(ffmpeg, [
        "-i", "screen_scaled.mp4",
        "-t", insertDuration.toFixed(3),
        "-c:v", "copy",
        "part_b.mp4",
      ], "trim-screen");
    } else {
      // endSec is null -> use full screen recording as part_b
      await execOrThrow(ffmpeg, [
        "-i", "screen_scaled.mp4",
        "-c:v", "copy",
        "part_b.mp4",
      ], "copy-screen");
    }
    console.log("[demo-insert] part_b ready");

    // -- Step 7: Concat video parts -----------------------------------------
    console.log("[demo-insert] concatenating video parts...");
    const concatParts: string[] = [];
    if (hasParts.a) concatParts.push("file 'part_a.mp4'");
    concatParts.push("file 'part_b.mp4'");
    if (hasParts.c) concatParts.push("file 'part_c.mp4'");

    const manifest = concatParts.join("\n") + "\n";
    await ffmpeg.writeFile("concat_list.txt", new TextEncoder().encode(manifest));
    await execOrThrow(ffmpeg, [
      "-f", "concat", "-safe", "0",
      "-i", "concat_list.txt",
      "-c", "copy",
      "concat.mp4",
    ], "concat-parts");
    console.log("[demo-insert] concat done");

    // -- Step 8: Mux original audio back ------------------------------------
    console.log("[demo-insert] muxing original audio...");
    await execOrThrow(ffmpeg, [
      "-i", "concat.mp4",
      "-i", "original_audio.aac",
      "-c:v", "copy",
      "-c:a", "aac",
      "-map", "0:v",
      "-map", "1:a",
      "-shortest",
      "output.mp4",
    ], "mux-audio");
    console.log("[demo-insert] mux done");

    const data = (await ffmpeg.readFile("output.mp4")) as Uint8Array;
    const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });

    await cleanupFFmpegFiles(ffmpeg);
    console.log("[demo-insert] done, blob size:", blob.size);
    return blob;
  } finally {
    ffmpegBusy = false;
  }
}

// ─── React Hook ─────────────────────────────────────────────────────────────

export function useDemoInsertStitcher() {
  const [status, setStatus] = useState<DemoInsertStitchStatus>("idle");
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
    async (input: DemoInsertInput) => {
      const { videoUrl, screenRecordingUrl, startSec, endSec, format } = input;

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

      try {
        // -- Load FFmpeg ----------------------------------------------------
        setStatus("loading_ffmpeg");
        setProgress(3);
        console.log("[demo-insert:hook] loading FFmpeg...");
        const [ffmpegInstance, { fetchFile }] = await Promise.all([
          getFFmpeg(),
          import("@ffmpeg/util"),
        ]);
        ffmpeg = ffmpegInstance;
        console.log("[demo-insert:hook] FFmpeg loaded OK");

        await cleanupFFmpegFiles(ffmpeg);

        // -- Fetch both files -----------------------------------------------
        setStatus("fetching");
        setProgress(8);
        await Promise.all([
          ffmpeg.writeFile("original.mp4", await fetchFile(videoUrl))
            .catch(async () => ffmpeg!.writeFile("original.mp4", await fetchFile(videoUrl))),
          ffmpeg.writeFile("screen.mp4", await fetchFile(screenRecordingUrl))
            .catch(async () => ffmpeg!.writeFile("screen.mp4", await fetchFile(screenRecordingUrl))),
        ]);
        setProgress(18);

        // -- Probe original video duration ----------------------------------
        const duration = await probeDuration(ffmpeg, "original.mp4");
        const effectiveEnd = endSec !== null ? Math.min(endSec, duration) : duration;

        if (startSec >= effectiveEnd) {
          throw new Error(
            `Invalid time range: startSec (${startSec}) must be less than endSec (${effectiveEnd}).`,
          );
        }
        setProgress(22);

        // -- Extract audio from full original video -------------------------
        setStatus("extracting_audio");
        setProgress(25);
        console.log("[demo-insert:hook] extracting audio...");
        await execOrThrow(ffmpeg, [
          "-i", "original.mp4",
          "-vn",
          "-c:a", "aac",
          "original_audio.aac",
        ], "extract-audio");
        setProgress(35);

        // -- Scale screen recording -----------------------------------------
        setStatus("scaling");
        setProgress(38);
        const { w, h } = getDimensions(format);
        console.log(`[demo-insert:hook] scaling screen recording to ${w}x${h}...`);
        await execOrThrow(ffmpeg, [
          "-i", "screen.mp4",
          "-vf", `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`,
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-crf", "35",
          "-an",
          "screen_scaled.mp4",
        ], "scale-screen");
        setProgress(48);

        // -- Split original video into parts --------------------------------
        setStatus("splitting");
        setProgress(50);
        const hasParts = { a: startSec > 0, c: endSec !== null && effectiveEnd < duration };

        console.log("[demo-insert:hook] splitting original video...");
        if (hasParts.a) {
          await execOrThrow(ffmpeg, [
            "-i", "original.mp4",
            "-t", startSec.toFixed(3),
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "35",
            "-an",
            "part_a.mp4",
          ], "split-part-a");
          console.log(`[demo-insert:hook] part_a: 0 -> ${startSec}s`);
        }

        if (hasParts.c) {
          await execOrThrow(ffmpeg, [
            "-i", "original.mp4",
            "-ss", effectiveEnd.toFixed(3),
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "35",
            "-an",
            "part_c.mp4",
          ], "split-part-c");
          console.log(`[demo-insert:hook] part_c: ${effectiveEnd}s -> end`);
        }
        setProgress(60);

        // -- Trim screen recording to insert duration -----------------------
        setStatus("inserting");
        setProgress(62);
        const insertDuration = effectiveEnd - startSec;
        console.log(`[demo-insert:hook] trimming screen recording to ${insertDuration.toFixed(3)}s...`);
        if (endSec !== null) {
          await execOrThrow(ffmpeg, [
            "-i", "screen_scaled.mp4",
            "-t", insertDuration.toFixed(3),
            "-c:v", "copy",
            "part_b.mp4",
          ], "trim-screen");
        } else {
          await execOrThrow(ffmpeg, [
            "-i", "screen_scaled.mp4",
            "-c:v", "copy",
            "part_b.mp4",
          ], "copy-screen");
        }
        setProgress(70);

        // -- Concat video parts ---------------------------------------------
        console.log("[demo-insert:hook] concatenating video parts...");
        const concatParts: string[] = [];
        if (hasParts.a) concatParts.push("file 'part_a.mp4'");
        concatParts.push("file 'part_b.mp4'");
        if (hasParts.c) concatParts.push("file 'part_c.mp4'");

        const manifest = concatParts.join("\n") + "\n";
        await ffmpeg.writeFile("concat_list.txt", new TextEncoder().encode(manifest));
        await execOrThrow(ffmpeg, [
          "-f", "concat", "-safe", "0",
          "-i", "concat_list.txt",
          "-c", "copy",
          "concat.mp4",
        ], "concat-parts");
        setProgress(82);

        // -- Mux original audio back ----------------------------------------
        setStatus("muxing");
        setProgress(85);
        console.log("[demo-insert:hook] muxing original audio...");
        await execOrThrow(ffmpeg, [
          "-i", "concat.mp4",
          "-i", "original_audio.aac",
          "-c:v", "copy",
          "-c:a", "aac",
          "-map", "0:v",
          "-map", "1:a",
          "-shortest",
          "output.mp4",
        ], "mux-audio");
        setProgress(92);

        // -- Read output & create blob URL ----------------------------------
        const data = (await ffmpeg.readFile("output.mp4")) as Uint8Array;
        const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });
        const url = URL.createObjectURL(blob);
        prevBlobUrl.current = url;
        setStitchedUrl(url);
        setProgress(100);
        setStatus("done");
        console.log("[demo-insert:hook] done, blob size:", blob.size);

      } catch (err) {
        const msg = err instanceof Error ? err.message : "Demo insert stitching failed";
        console.error("[demo-insert:hook] FAILED:", msg, err);
        setError(msg);
        setStatus("error");
      } finally {
        if (ffmpeg) {
          await cleanupFFmpegFiles(ffmpeg).catch(() => {});
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
