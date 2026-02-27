import type { GenerationSegments } from "@/types/database";

type VideoQuality = "standard" | "hd";
type KlingModel = "kling-v2-6" | "kling-v3" | "kling-v3-0";

const MODEL_BY_QUALITY: Record<VideoQuality, string> = {
  standard: "kling-v2-6",
  hd: "kling-v3",
};

const USD_PER_SECOND_BY_QUALITY: Record<VideoQuality, number> = {
  standard: 0.042,
  hd: 0.084,
};

const USD_PER_SECOND_BY_MODEL: Record<KlingModel, number> = {
  "kling-v2-6": 0.042,
  "kling-v3": 0.084,
  "kling-v3-0": 0.084,
};

function resolveQuality(input: string | null | undefined): VideoQuality {
  return input === "hd" ? "hd" : "standard";
}

function normalizeModel(model: string | null | undefined): KlingModel | null {
  if (!model) return null;
  if (model === "kling-v2-6") return "kling-v2-6";
  if (model === "kling-v3" || model === "kling-v3-0") return model;
  if (model.startsWith("kling-v3")) return "kling-v3";
  if (model.startsWith("kling-v2-6")) return "kling-v2-6";
  return null;
}

function billedSeconds(durationSeconds: number): number {
  return durationSeconds <= 5 ? 5 : 10;
}

export function calculateGenerationCost(
  videos: GenerationSegments | null | undefined,
  quality: string | null | undefined,
  model: string | null | undefined,
) {
  const resolvedQuality = resolveQuality(quality);
  const normalizedModel = normalizeModel(model);
  const modelName = normalizedModel ?? MODEL_BY_QUALITY[resolvedQuality];

  const allDurations = [
    ...(videos?.hooks ?? []).map((v) => v.duration),
    ...(videos?.bodies ?? []).map((v) => v.duration),
    ...(videos?.ctas ?? []).map((v) => v.duration),
  ].filter((d) => typeof d === "number" && d > 0);

  const rawSeconds = allDurations.reduce((sum, d) => sum + d, 0);
  const totalBilledSeconds = allDurations.reduce((sum, d) => sum + billedSeconds(d), 0);
  const usdPerSecond = normalizedModel
    ? USD_PER_SECOND_BY_MODEL[normalizedModel]
    : USD_PER_SECOND_BY_QUALITY[resolvedQuality];
  const totalCostUsd = totalBilledSeconds * usdPerSecond;

  return {
    quality: resolvedQuality,
    modelName,
    usdPerSecond,
    rawSeconds,
    totalBilledSeconds,
    totalCostUsd,
  };
}
