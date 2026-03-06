# Multi-Segment Silence Removal — Implementation Plan (v2, post-review)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove silence gaps anywhere in a video clip (not just leading/trailing), producing tight multi-segment output with a 200ms natural buffer on each side of every cut.

**Architecture:** Replace the single-bounds `getSpeechBounds → {start,end}` model with a multi-segment `getSpeechSegments → Segment[]` model. A shared `prepareClip` helper (detect + trim) is called from both `stitchToBlob` and `useVideoStitcher`, eliminating the duplicated flow that existed in v1 of this plan. Cleanup runs at both ends of the hook path: pre-run and in `finally`.

**Tech Stack:** FFmpeg WASM (`@ffmpeg/ffmpeg` + `@ffmpeg/core@0.12.6`), `silencedetect` filter, TypeScript, Vitest (pure parser unit tests).

**One file changed:** `frontend/src/hooks/use-video-stitcher.ts`
**No consumer changes needed:** `use-batch-stitcher.ts` and `generate/[id]/page.tsx` public APIs unchanged.

---

## Review Findings Addressed

| Finding | Severity | Fix in this plan |
|---------|----------|-----------------|
| `useVideoStitcher` missing pre-run + finally cleanup | High | Task 7: declare `ffmpeg` before `try`, add cleanup pre-write and in `finally` |
| `MIN_SILENCE_TO_CUT=0.5` → only 100ms net removed | Medium | Task 1: raise to `0.8s` (net removed ≥ 400ms) |
| Log listener not detached on FFmpeg error | Medium | Task 3: wrap exec in `try/finally`, move `ffmpeg.off` to `finally` |
| "No re-encode for full clip" note inaccurate | Low | Task 4 + edge case table: note that single-segment path still re-encodes |
| Duplicated detect/trim flow in both callers | Improvement | Task 5: shared `prepareClip` helper |
| No segment count cap | Improvement | Task 2: `MAX_SEGMENTS_PER_CLIP = 6` fallback |
| No unit tests | Improvement | Task 8: pure parser tests via Vitest |

---

## Algorithm: `getSpeechSegments`

```
Constants:
  TRANSITION_BUFFER     = 0.2s   (buffer kept at each edge of every cut)
  MIN_SILENCE_TO_CUT    = 0.8s   (only remove silences where net_removed = duration - 0.4s >= 0.4s)
  MIN_SEGMENT_DURATION  = 0.3s   (discard speech segments shorter than this)
  MAX_SEGMENTS_PER_CLIP = 6      (safety cap; beyond this, fall back to full-clip)

Steps:
  1. Parse all silence_start / silence_end pairs from FFmpeg log
  2. Trailing silence has no silence_end → use `duration`
  3. Filter: only cut silences > MIN_SILENCE_TO_CUT
  4. If none → return [{0, duration}]
  5. Walk silences with cursor = 0:
     For each silence {s, e}:
       - speech segment: {cursor, min(s + TRANSITION_BUFFER, duration)}
       - discard if duration < MIN_SEGMENT_DURATION
       - cursor = max(cursor, e - TRANSITION_BUFFER)
  6. Final segment: {cursor, duration} — discard if < MIN_SEGMENT_DURATION
  7. If segments.length > MAX_SEGMENTS_PER_CLIP → return [{0, duration}] (fallback)
  8. Safety: if empty → return [{0, duration}]
```

### Worked example (8s body clip, leading 0–1s + middle gap 5–7s)

```
Both silences > 0.8s → cuttable

cursor=0 → process {0→1.0}:
  segment {0, 0.2} → 0.2s < MIN_SEGMENT_DURATION → DISCARD
  cursor = 0.8

cursor=0.8 → process {5.0→7.0}:
  segment {0.8, 5.2} → 4.4s → KEEP
  cursor = 6.8

final segment {6.8, 8.0} → 1.2s → KEEP

Result: [{0.8, 5.2}, {6.8, 8.0}]   (2 segments, under MAX_SEGMENTS_PER_CLIP)
```

---

## Task 1 — New constants + `Segment` type

**File:** `frontend/src/hooks/use-video-stitcher.ts`

Replace existing constants block:

```typescript
// BEFORE
const TRANSITION_BUFFER = 0.2;
const MIN_TRAILING_SILENCE = 0.3;

// AFTER
const TRANSITION_BUFFER     = 0.2;   // 200ms buffer at each edge of every cut
const MIN_SILENCE_TO_CUT    = 0.8;   // Only remove silences > 800ms (net removed >= 400ms)
const MIN_SEGMENT_DURATION  = 0.3;   // Discard speech segments < 300ms
const MAX_SEGMENTS_PER_CLIP = 6;     // Fallback to full-clip if clip has > 6 speech islands

type Segment = { start: number; end: number };
```

---

## Task 2 — Replace `getSpeechBounds` with `getSpeechSegments`

**File:** `frontend/src/hooks/use-video-stitcher.ts` — delete lines 60–105, replace with:

Export the function so it can be unit tested (Task 8).

```typescript
/**
 * Parse silence regions from FFmpeg silencedetect log output.
 * Returns an ordered list of speech segments to keep.
 * Exported for unit testing — internal use only outside of tests.
 */
export function getSpeechSegments(log: string, duration: number): Segment[] {
  const silenceStarts = [
    ...log.matchAll(/silence_start: ([\d.]+)/g),
  ].map((m) => parseFloat(m[1]));

  const silenceEnds = [
    ...log.matchAll(/silence_end: ([\d.]+)/g),
  ].map((m) => parseFloat(m[1]));

  // Trailing silence has no silence_end — use clip duration
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

  // Safety cap: pathological inputs fall back to full-clip trim
  if (segments.length > MAX_SEGMENTS_PER_CLIP) {
    return [{ start: 0, end: duration }];
  }

  return segments.length > 0 ? segments : [{ start: 0, end: duration }];
}
```

---

## Task 3 — Replace `detectSpeechBounds` with `detectSpeechSegments`

**File:** `frontend/src/hooks/use-video-stitcher.ts` — delete lines 107–132, replace with:

Key change: `ffmpeg.off` is in `finally` so it always detaches even if exec throws.

```typescript
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
  try {
    await ffmpeg.exec([
      "-i", filename,
      "-af", "silencedetect=n=-40dB:d=0.15",
      "-f", "null", "-",
    ]);
  } finally {
    ffmpeg.off("log", handler);   // always detach — even if exec throws
  }

  return getSpeechSegments(log, parseDuration(log));
}
```

---

## Task 4 — Add `trimClipToSegments` helper

Insert after `detectSpeechSegments`, before `cleanupFFmpegFiles`.

Note: the single-segment fast path still re-encodes (no copy-stream path for MVP). The "no re-encode" claim in the v1 edge case table was inaccurate — corrected in the edge case table at the bottom of this plan.

```typescript
/**
 * Trim a clip to its speech segments and write the result to outputFile.
 *
 * Single segment: one re-encode pass.
 * Multiple segments: re-encode each → internal concat → outputFile.
 *
 * Returns all temp file names created (caller passes to cleanupFFmpegFiles).
 * outputFile is included in the returned list.
 */
async function trimClipToSegments(
  ffmpeg: FFmpeg,
  inputFile: string,
  segments: Segment[],
  outputFile: string,
): Promise<string[]> {
  const created: string[] = [];

  if (segments.length === 1) {
    const seg = segments[0];
    await ffmpeg.exec([
      "-i", inputFile,
      "-ss", seg.start.toFixed(3),
      "-to", seg.end.toFixed(3),
      "-c:v", "libx264", "-c:a", "aac",
      outputFile,
    ]);
    created.push(outputFile);
    return created;
  }

  // Multi-segment: trim each piece, then concat
  const prefix = outputFile.replace(/\.mp4$/, "");
  const segFiles: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segFile = `${prefix}_s${i}.mp4`;
    segFiles.push(segFile);
    created.push(segFile);
    await ffmpeg.exec([
      "-i", inputFile,
      "-ss", seg.start.toFixed(3),
      "-to", seg.end.toFixed(3),
      "-c:v", "libx264", "-c:a", "aac",
      segFile,
    ]);
  }

  const listFile = `${prefix}_list.txt`;
  created.push(listFile);
  const manifest = segFiles.map((f) => `file '${f}'`).join("\n") + "\n";
  await ffmpeg.writeFile(listFile, new TextEncoder().encode(manifest));
  await ffmpeg.exec([
    "-f", "concat", "-safe", "0",
    "-i", listFile,
    "-c", "copy",
    outputFile,
  ]);
  created.push(outputFile);
  return created;
}
```

---

## Task 5 — Add shared `prepareClip` helper

Insert after `trimClipToSegments`. Eliminates the duplicated detect+trim flow in both callers.

```typescript
/**
 * Detect speech segments in inputFile and trim to outputFile.
 * Returns all created temp file names for cleanup.
 */
async function prepareClip(
  ffmpeg: FFmpeg,
  inputFile: string,
  outputFile: string,
): Promise<string[]> {
  const segments = await detectSpeechSegments(ffmpeg, inputFile);
  return trimClipToSegments(ffmpeg, inputFile, segments, outputFile);
}
```

---

## Task 6 — Update `cleanupFFmpegFiles`

```typescript
async function cleanupFFmpegFiles(ffmpeg: FFmpeg, extraFiles: string[] = []) {
  const baseFiles = [
    "hook.mp4", "body.mp4", "cta.mp4",
    "hook_t.mp4", "body_t.mp4", "cta_t.mp4",
    "list.txt", "output.mp4",
  ];
  for (const f of [...new Set([...baseFiles, ...extraFiles])]) {
    try { await ffmpeg.deleteFile(f); } catch { /* ignore */ }
  }
}
```

---

## Task 7 — Update `stitchToBlob`

Replace the detect+trim block:

```typescript
// BEFORE
const hookB = await detectSpeechBounds(ffmpeg, "hook.mp4");
// ... three separate trim ffmpeg.exec calls ...

// AFTER
const hookTmp = await prepareClip(ffmpeg, "hook.mp4", "hook_t.mp4");
const bodyTmp = await prepareClip(ffmpeg, "body.mp4", "body_t.mp4");
const ctaTmp  = await prepareClip(ffmpeg, "cta.mp4",  "cta_t.mp4");
const extraTempFiles = [...hookTmp, ...bodyTmp, ...ctaTmp];
```

Update the final cleanup call to pass extra files:
```typescript
await cleanupFFmpegFiles(ffmpeg, extraTempFiles);
```

The pre-run `cleanupFFmpegFiles(ffmpeg)` at line ~162 stays as-is (no extra files yet at that point).

---

## Task 8 — Update `useVideoStitcher.stitch()` — full try/catch/finally rewrite

The existing hook has no cleanup in `finally` and no pre-run cleanup. Rewrite the try/catch/finally structure:

```typescript
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

    // Declare outside try so catch/finally can access them
    let ffmpeg: FFmpeg | null = null;
    let extraTempFiles: string[] = [];

    try {
      setStatus("loading_ffmpeg");
      setProgress(5);
      const [ffmpegInstance, { fetchFile }] = await Promise.all([
        getFFmpeg(),
        import("@ffmpeg/util"),
      ]);
      ffmpeg = ffmpegInstance;

      // Pre-run cleanup — clear stale files from any previous run on this singleton
      await cleanupFFmpegFiles(ffmpeg);

      setStatus("fetching");
      setProgress(15);
      await Promise.all([
        ffmpeg.writeFile("hook.mp4", await fetchFile(hookUrl))
          .catch(async () => ffmpeg!.writeFile("hook.mp4", await fetchFile(hookUrl))),
        ffmpeg.writeFile("body.mp4", await fetchFile(bodyUrl))
          .catch(async () => ffmpeg!.writeFile("body.mp4", await fetchFile(bodyUrl))),
        ffmpeg.writeFile("cta.mp4", await fetchFile(ctaUrl))
          .catch(async () => ffmpeg!.writeFile("cta.mp4", await fetchFile(ctaUrl))),
      ]);

      setStatus("detecting");
      setProgress(30);
      // Sequential — FFmpeg WASM is single-threaded; parallel log handlers cross-contaminate

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
      await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "output.mp4"]);

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
      // Always clean up temp files and release the mutex
      if (ffmpeg) {
        await cleanupFFmpegFiles(ffmpeg, extraTempFiles).catch(() => {});
      }
      ffmpegBusy = false;
    }
  },
  [],
);
```

Note: the `setStatus("detecting")` label is now cosmetic (detect runs inside `prepareClip` during the trimming phase). Either remove it or keep it — the progress step at 30 can be removed since detect and trim are now one combined step per clip.

---

## Task 9 — Delete dead code

Remove entirely (TypeScript will error if references remain — acts as a compile-time check):
- `getSpeechBounds` function
- `detectSpeechBounds` function
- `MIN_TRAILING_SILENCE` constant

---

## Task 10 — Unit tests for `getSpeechSegments`

**File:** `frontend/src/hooks/__tests__/use-video-stitcher.test.ts` (create new)

`getSpeechSegments` is a pure function — no FFmpeg or browser needed. Run with Vitest.

```typescript
import { describe, expect, it } from "vitest";
import { getSpeechSegments } from "../use-video-stitcher";

// Helper to build a mock FFmpeg silence log
function makeLog(duration: number, silences: Array<[number, number | null]>): string {
  let log = `  Duration: 00:00:${duration.toFixed(2).padStart(5, "0")}, start: 0\n`;
  for (const [start, end] of silences) {
    log += `silence_start: ${start}\n`;
    if (end !== null) {
      log += `silence_end: ${end} | silence_duration: ${(end - start).toFixed(3)}\n`;
    }
  }
  return log;
}

describe("getSpeechSegments", () => {
  it("returns full clip when no silence detected", () => {
    const result = getSpeechSegments(makeLog(5, []), 5);
    expect(result).toEqual([{ start: 0, end: 5 }]);
  });

  it("returns full clip when silence is shorter than MIN_SILENCE_TO_CUT (0.8s)", () => {
    const result = getSpeechSegments(makeLog(5, [[1, 1.5]]), 5); // 0.5s silence
    expect(result).toEqual([{ start: 0, end: 5 }]);
  });

  it("cuts leading silence", () => {
    const result = getSpeechSegments(makeLog(8, [[0, 1.0]]), 8);
    // leading 1s silence: first segment {0, 0.2} discarded (< 0.3s), cursor → 0.8
    // final segment {0.8, 8.0} → 7.2s → kept
    expect(result).toEqual([{ start: 0.8, end: 8 }]);
  });

  it("cuts trailing silence", () => {
    // trailing silence has no end (null)
    const result = getSpeechSegments(makeLog(8, [[6.5, null]]), 8);
    // segment {0, 6.7} → 6.7s → kept
    // final segment {7.8, 8.0} → 0.2s → discarded (< 0.3s)
    expect(result).toEqual([{ start: 0, end: 6.7 }]);
  });

  it("cuts middle silence and returns two segments", () => {
    const result = getSpeechSegments(makeLog(8, [[0, 1.0], [5.0, 7.0]]), 8);
    expect(result).toEqual([
      { start: 0.8, end: 5.2 },
      { start: 6.8, end: 8 },
    ]);
  });

  it("falls back to full clip when segment count exceeds MAX_SEGMENTS_PER_CLIP (6)", () => {
    // 8 silences → 9 potential speech segments → exceeds cap
    const silences: Array<[number, number]> = Array.from({ length: 8 }, (_, i) => [
      i * 3 + 1, i * 3 + 2,
    ]);
    const duration = 30;
    const result = getSpeechSegments(makeLog(duration, silences), duration);
    expect(result).toEqual([{ start: 0, end: duration }]);
  });
});
```

Run tests:
```bash
cd frontend && bun run test src/hooks/__tests__/use-video-stitcher.test.ts
```

Expected: all 6 tests pass.

---

## Verification Checklist

- [ ] `bun run build` from `frontend/` — zero TypeScript errors
- [ ] `bun run test` — all 6 parser unit tests pass
- [ ] No references to `getSpeechBounds`, `detectSpeechBounds`, `MIN_TRAILING_SILENCE`
- [ ] `prepareClip` is the only place that calls `detectSpeechSegments` + `trimClipToSegments`
- [ ] `detectSpeechSegments` has `ffmpeg.off` in `finally`
- [ ] `useVideoStitcher.stitch()` calls `cleanupFFmpegFiles` pre-write (inside try, after getFFmpeg) and in `finally`
- [ ] `stitchToBlob` passes `extraTempFiles` to final cleanup
- [ ] Manual test: stitch combo with known mid-clip silence → gap removed in output

---

## Edge Cases

| Scenario | Result |
|----------|--------|
| No silence detected | `[{0, duration}]` — full clip |
| Short pause < 800ms | Not cut — natural breath preserved |
| Leading silence only | One segment starting after it |
| Trailing silence only | One segment ending before it |
| Middle silence > 800ms | Two speech segments |
| Multiple middle silences | Up to MAX_SEGMENTS_PER_CLIP speech segments |
| > 6 cuttable silences | Fallback to `[{0, duration}]` — safety valve |
| Single segment (full clip) | Re-encoded once via fast path — no internal concat |
| All silence / broken clip | Safety fallback → `[{0, duration}]` |
| Trailing silence with no `silence_end` | Treated as `{start, duration}` — cut correctly |
| FFmpeg exec throws during detect | Log listener detached in `finally` — no accumulation |
| Error mid-stitch in hook | `cleanupFFmpegFiles` runs in `finally` — FS stays clean |
