import type { GenerationSegments } from "@/types/database";

type VideoQuality = "standard" | "hd";

const MODEL_BY_QUALITY: Record<VideoQuality, string> = {
  standard: "kling-v2-6",
  hd: "kling-v3",
};

const USD_PER_SECOND_BY_QUALITY: Record<VideoQuality, number> = {
  standard: 0.042,
  hd: 0.084,
};

function resolveQuality(input: string | null | undefined): VideoQuality {
  return input === "hd" ? "hd" : "standard";
}

function billedSeconds(durationSeconds: number): number {
  return durationSeconds <= 5 ? 5 : 10;
}

export function calculateGenerationCost(
  videos: GenerationSegments | null | undefined,
  quality: string | null | undefined,
) {
  const resolvedQuality = resolveQuality(quality);
  const allDurations = [
    ...(videos?.hooks ?? []).map((v) => v.duration),
    ...(videos?.bodies ?? []).map((v) => v.duration),
    ...(videos?.ctas ?? []).map((v) => v.duration),
  ].filter((d) => typeof d === "number" && d > 0);

  const rawSeconds = allDurations.reduce((sum, d) => sum + d, 0);
  const totalBilledSeconds = allDurations.reduce((sum, d) => sum + billedSeconds(d), 0);
  const usdPerSecond = USD_PER_SECOND_BY_QUALITY[resolvedQuality];
  const totalCostUsd = totalBilledSeconds * usdPerSecond;

  return {
    quality: resolvedQuality,
    modelName: MODEL_BY_QUALITY[resolvedQuality],
    usdPerSecond,
    rawSeconds,
    totalBilledSeconds,
    totalCostUsd,
  };
}
