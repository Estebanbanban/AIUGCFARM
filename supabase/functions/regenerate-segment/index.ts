import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { checkCredits, debitCredit, refundCredits } from "../_shared/credits.ts";
import { withRetry } from "../_shared/retry.ts";
import { submitKlingJob } from "../_shared/kling.ts";

type SegmentType = "hook" | "body" | "cta";
type SegmentPlural = "hooks" | "bodies" | "ctas";

interface ScriptSegment {
  text: string;
  duration_seconds: number;
  variant_label: string;
}

interface GenerationScript {
  hooks: ScriptSegment[];
  bodies: ScriptSegment[];
  ctas: ScriptSegment[];
}

interface StoredSegmentVideo {
  storage_path: string;
  duration: number;
  variation: number;
  variant_label: string;
}

interface StoredVideos {
  hooks: StoredSegmentVideo[];
  bodies: StoredSegmentVideo[];
  ctas: StoredSegmentVideo[];
}

const KLING_MODEL = {
  standard: "kling-v2-6",
  hd: "kling-v3",
} as const;

const SEGMENT_MAP: Record<SegmentType, SegmentPlural> = {
  hook: "hooks",
  body: "bodies",
  cta: "ctas",
};

function isStoredVideos(value: unknown): value is StoredVideos {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.hooks) && Array.isArray(v.bodies) && Array.isArray(v.ctas);
}

function clampKlingDuration(seconds: number): number {
  return seconds <= 5 ? 5 : 10;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const { generation_id, segment_type, variation } = await req.json();

    if (!generation_id || typeof generation_id !== "string") {
      return json({ detail: "generation_id is required" }, cors, 400);
    }

    if (!["hook", "body", "cta"].includes(segment_type)) {
      return json({ detail: "segment_type must be 'hook', 'body', or 'cta'" }, cors, 400);
    }

    const variationNumber = Number(variation);
    if (!Number.isInteger(variationNumber) || variationNumber < 1) {
      return json({ detail: "variation must be a positive integer" }, cors, 400);
    }

    const segmentType = segment_type as SegmentType;
    const segmentKey = `${segmentType}_${variationNumber}`;

    const { data: generation, error: generationErr } = await sb
      .from("generations")
      .select("id, owner_id, status, script, composite_image_url, external_job_ids, videos, video_quality, kling_model")
      .eq("id", generation_id)
      .eq("owner_id", userId)
      .single();

    if (generationErr || !generation) {
      return json({ detail: "Generation not found" }, cors, 404);
    }

    if (generation.status !== "completed") {
      return json(
        { detail: "You can only regenerate segments for completed generations." },
        cors,
        409,
      );
    }

    if (!generation.composite_image_url) {
      return json({ detail: "Generation has no composite image" }, cors, 400);
    }

    const script = generation.script as GenerationScript | null;
    if (!script) {
      return json({ detail: "Generation script is missing" }, cors, 400);
    }

    const segmentListKey = SEGMENT_MAP[segmentType];
    const segment = script[segmentListKey]?.[variationNumber - 1];
    if (!segment) {
      return json(
        { detail: `Segment not found for ${segmentType} variation ${variationNumber}` },
        cors,
        404,
      );
    }

    if (
      !generation.external_job_ids ||
      typeof generation.external_job_ids !== "object" ||
      Array.isArray(generation.external_job_ids) ||
      Object.keys(generation.external_job_ids as Record<string, string>).length === 0
    ) {
      return json(
        { detail: "Generation cannot be regenerated because job metadata is missing." },
        cors,
        409,
      );
    }

    const remaining = await checkCredits(userId);
    if (remaining < 1) {
      return json(
        { detail: "Insufficient credits. Regenerating a segment costs 1 credit." },
        cors,
        402,
      );
    }

    await debitCredit(userId, generation.id);

    try {
      let compositeSignedUrl = generation.composite_image_url as string;
      if (!compositeSignedUrl.startsWith("http")) {
        const { data: signedData, error: signedErr } = await sb.storage
          .from("composite-images")
          .createSignedUrl(compositeSignedUrl, 7200);

        if (signedErr || !signedData?.signedUrl) {
          throw new Error(`Failed to sign composite image URL: ${signedErr?.message}`);
        }

        compositeSignedUrl = signedData.signedUrl;
      }

      const quality = (generation.video_quality ?? "standard") as "standard" | "hd";
      const modelName = (generation.kling_model as string | null)
        ?? KLING_MODEL[quality]
        ?? KLING_MODEL.standard;

      const klingResult = await withRetry(() =>
        submitKlingJob({
          image_url: compositeSignedUrl,
          script: `A UGC creator speaking directly to camera, saying: "${segment.text}" Natural, authentic talking-head style, casual handheld selfie aesthetic.`,
          duration: clampKlingDuration(segment.duration_seconds ?? 5),
          mode: "pro",
          sound: "on",
          model_name: modelName,
        }),
      );

      const existingJobIds =
        generation.external_job_ids && typeof generation.external_job_ids === "object"
          ? generation.external_job_ids as Record<string, string>
          : {};

      const updatedJobIds: Record<string, string> = {
        ...existingJobIds,
        [segmentKey]: klingResult.job_id,
      };

      const existingVideos: StoredVideos = isStoredVideos(generation.videos)
        ? generation.videos
        : { hooks: [], bodies: [], ctas: [] };

      // Remove only the segment being regenerated so video-status repolls this key.
      const nextVideos: StoredVideos = {
        ...existingVideos,
        [segmentListKey]: existingVideos[segmentListKey].filter(
          (v) => v.variation !== variationNumber,
        ),
      };

      const { error: updateErr } = await sb
        .from("generations")
        .update({
          status: "generating_segments",
          error_message: null,
          completed_at: null,
          external_job_ids: updatedJobIds,
          kling_model: klingResult.model_name || modelName,
          videos: nextVideos,
        })
        .eq("id", generation.id);

      if (updateErr) {
        throw new Error(`Failed to update generation: ${updateErr.message}`);
      }

      return json(
        {
          data: {
            generation_id: generation.id,
            status: "generating_segments",
            job_key: segmentKey,
            credits_charged: 1,
          },
        },
        cors,
        200,
      );
    } catch (pipelineErr) {
      // If job submission/update fails after debit, refund that single credit.
      try {
        await refundCredits(userId, 1, generation.id);
      } catch (refundErr) {
        console.error("Segment regen refund failed:", refundErr);
      }
      throw pipelineErr;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("regenerate-segment error:", e);
    return json({ detail: msg || "Failed to regenerate segment" }, cors, 500);
  }
});
