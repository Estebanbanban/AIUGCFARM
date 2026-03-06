import { describe, expect, it } from "vitest";
import { getSpeechSegments } from "../use-video-stitcher";

function makeLog(duration: number, silences: Array<[number, number | null]>): string {
  const secs = duration.toFixed(2);
  let log = `  Duration: 00:00:${secs.padStart(5, "0")}, start: 0\n`;
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
    expect(getSpeechSegments(makeLog(5, []), 5)).toEqual([{ start: 0, end: 5 }]);
  });

  it("returns full clip when all silences are shorter than MIN_SILENCE_TO_CUT (0.8s)", () => {
    // 0.5s silence — too short to cut
    expect(getSpeechSegments(makeLog(5, [[1, 1.5]]), 5)).toEqual([{ start: 0, end: 5 }]);
  });

  it("cuts leading silence", () => {
    // 1s leading silence → first candidate {0, 0.2} discarded (<0.3s), cursor=0.8
    // final segment {0.8, 8} → 7.2s → kept
    expect(getSpeechSegments(makeLog(8, [[0, 1.0]]), 8)).toEqual([{ start: 0.8, end: 8 }]);
  });

  it("cuts trailing silence (no silence_end)", () => {
    // trailing silence starts at 6.5, no end → {6.5, 8.0} = 1.5s → cut
    // segment {0, 6.7} → kept; final {7.8, 8.0} = 0.2s → discarded
    expect(getSpeechSegments(makeLog(8, [[6.5, null]]), 8)).toEqual([{ start: 0, end: 6.7 }]);
  });

  it("cuts middle silence and returns two segments", () => {
    const result = getSpeechSegments(makeLog(8, [[0, 1.0], [5.0, 7.0]]), 8);
    expect(result).toEqual([
      { start: 0.8, end: 5.2 },
      { start: 6.8, end: 8 },
    ]);
  });

  it("falls back to full clip when segment count exceeds MAX_SEGMENTS_PER_CLIP (6)", () => {
    // 8 silences of 1s each → up to 9 segments → exceeds cap of 6
    const silences: Array<[number, number]> = Array.from(
      { length: 8 },
      (_, i) => [i * 3 + 1, i * 3 + 2] as [number, number],
    );
    expect(getSpeechSegments(makeLog(30, silences), 30)).toEqual([{ start: 0, end: 30 }]);
  });
});
