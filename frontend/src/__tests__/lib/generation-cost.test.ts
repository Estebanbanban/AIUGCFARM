import { describe, it, expect } from "vitest";
import { calculateGenerationCost } from "@/lib/generation-cost";
import type { GenerationSegments } from "@/types/database";

function makeSegments(
  hooks: number[],
  bodies: number[],
  ctas: number[],
): GenerationSegments {
  const toVideos = (durations: number[]) =>
    durations.map((d, i) => ({
      url: `https://example.com/video-${i}.mp4`,
      duration: d,
      variation: i,
      variant_label: String.fromCharCode(65 + i), // A, B, C...
    }));
  return {
    hooks: toVideos(hooks),
    bodies: toVideos(bodies),
    ctas: toVideos(ctas),
  };
}

describe("calculateGenerationCost", () => {
  describe("quality resolution", () => {
    it("resolves 'hd' to hd quality", () => {
      const result = calculateGenerationCost(null, "hd", null);
      expect(result.quality).toBe("hd");
    });

    it("resolves anything else to standard", () => {
      expect(calculateGenerationCost(null, "standard", null).quality).toBe("standard");
      expect(calculateGenerationCost(null, null, null).quality).toBe("standard");
      expect(calculateGenerationCost(null, undefined, null).quality).toBe("standard");
    });
  });

  describe("model normalization", () => {
    it("uses kling-v2-6 for standard quality when no model given", () => {
      const result = calculateGenerationCost(null, "standard", null);
      expect(result.modelName).toBe("kling-v2-6");
    });

    it("uses kling-v3 for hd quality when no model given", () => {
      const result = calculateGenerationCost(null, "hd", null);
      expect(result.modelName).toBe("kling-v3");
    });

    it("uses explicit model when provided", () => {
      const result = calculateGenerationCost(null, "standard", "kling-v3");
      expect(result.modelName).toBe("kling-v3");
    });

    it("normalizes kling-v3-0 to kling-v3-0", () => {
      const result = calculateGenerationCost(null, "standard", "kling-v3-0");
      expect(result.modelName).toBe("kling-v3-0");
    });
  });

  describe("empty/null videos", () => {
    it("returns 0 cost for null videos", () => {
      const result = calculateGenerationCost(null, "standard", null);
      expect(result.rawSeconds).toBe(0);
      expect(result.totalBilledSeconds).toBe(0);
      expect(result.totalCostUsd).toBe(0);
    });

    it("returns 0 cost for undefined videos", () => {
      const result = calculateGenerationCost(undefined, "standard", null);
      expect(result.totalCostUsd).toBe(0);
    });

    it("returns 0 cost for empty segments", () => {
      const segments = makeSegments([], [], []);
      const result = calculateGenerationCost(segments, "standard", null);
      expect(result.totalCostUsd).toBe(0);
    });
  });

  describe("billing seconds", () => {
    it("bills 5s for videos <= 5s", () => {
      const segments = makeSegments([3], [], []);
      const result = calculateGenerationCost(segments, "standard", null);
      expect(result.totalBilledSeconds).toBe(5);
    });

    it("bills 5s for exactly 5s video", () => {
      const segments = makeSegments([5], [], []);
      const result = calculateGenerationCost(segments, "standard", null);
      expect(result.totalBilledSeconds).toBe(5);
    });

    it("bills 10s for videos > 5s", () => {
      const segments = makeSegments([6], [], []);
      const result = calculateGenerationCost(segments, "standard", null);
      expect(result.totalBilledSeconds).toBe(10);
    });

    it("bills 10s for exactly 10s video", () => {
      const segments = makeSegments([10], [], []);
      const result = calculateGenerationCost(segments, "standard", null);
      expect(result.totalBilledSeconds).toBe(10);
    });
  });

  describe("cost calculation", () => {
    it("calculates cost for single standard generation (3 segments)", () => {
      // 3 segments at 5s each = 15 billed seconds * $0.042/s
      const segments = makeSegments([4], [5], [3]);
      const result = calculateGenerationCost(segments, "standard", null);
      expect(result.totalBilledSeconds).toBe(15); // 5+5+5
      expect(result.usdPerSecond).toBe(0.042);
      expect(result.totalCostUsd).toBeCloseTo(0.63, 2);
    });

    it("calculates cost for HD generation", () => {
      // kling-v3 (HD) bills actual seconds: 4+5+3=12s * $0.084/s
      const segments = makeSegments([4], [5], [3]);
      const result = calculateGenerationCost(segments, "hd", null);
      expect(result.totalBilledSeconds).toBe(12);
      expect(result.usdPerSecond).toBe(0.084);
      expect(result.totalCostUsd).toBeCloseTo(1.008, 2);
    });

    it("HD costs more per second but bills actual duration (no 5/10 snap)", () => {
      // standard (kling-v2-6): 5+5+5=15 billed × $0.042 = $0.63
      // hd (kling-v3): 4+5+3=12 billed × $0.084 = $1.008
      const segments = makeSegments([4], [5], [3]);
      const stdResult = calculateGenerationCost(segments, "standard", null);
      const hdResult = calculateGenerationCost(segments, "hd", null);
      expect(stdResult.totalBilledSeconds).toBe(15);
      expect(hdResult.totalBilledSeconds).toBe(12);
      expect(hdResult.usdPerSecond).toBeCloseTo(stdResult.usdPerSecond * 2, 5);
    });

    it("calculates cost for triple generation (9 segments)", () => {
      // 9 segments, all 5s or less => 9 * 5 = 45 billed seconds
      const segments = makeSegments([3, 4, 5], [4, 3, 5], [2, 3, 4]);
      const result = calculateGenerationCost(segments, "standard", null);
      expect(result.totalBilledSeconds).toBe(45);
      expect(result.totalCostUsd).toBeCloseTo(1.89, 2);
    });

    it("tracks raw seconds separately from billed seconds", () => {
      const segments = makeSegments([3], [8], [2]);
      const result = calculateGenerationCost(segments, "standard", null);
      expect(result.rawSeconds).toBe(13); // 3+8+2
      expect(result.totalBilledSeconds).toBe(20); // 5+10+5
    });
  });

  describe("model-specific pricing", () => {
    it("uses model rate when explicit model is provided", () => {
      const segments = makeSegments([5], [], []);
      const result = calculateGenerationCost(segments, "standard", "kling-v3");
      // kling-v3 rate = $0.084 even though quality is "standard"
      expect(result.usdPerSecond).toBe(0.084);
      expect(result.totalCostUsd).toBeCloseTo(0.42, 2);
    });

    it("uses kling-v3-0 rate", () => {
      const segments = makeSegments([5], [], []);
      const result = calculateGenerationCost(segments, "standard", "kling-v3-0");
      expect(result.usdPerSecond).toBe(0.084);
    });
  });
});
