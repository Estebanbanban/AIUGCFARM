import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { checkKlingJob } from "../_shared/kling.ts";
import { refundCredits } from "../_shared/credits.ts";

const COSTS = {
  standard: { single: 5, batch: 15 },
  hd:       { single: 10, batch: 30 },
} as const;

// ── Types ─────────────────────────────────────────────────────────────

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

interface ResponseSegmentVideo {
  url: string;
  duration: number;
  variation: number;
  variant_label: string;
}

interface ResponseSegments {
  hooks: ResponseSegmentVideo[];
  bodies: ResponseSegmentVideo[];
  ctas: ResponseSegmentVideo[];
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Generate a fresh signed URL for a composite image storage path.
 * Returns null if the path is already a full URL or signing fails.
 */
async function getCompositeSignedUrl(
  sb: ReturnType<typeof getAdminClient>,
  storagePath: string,
): Promise<string | null> {
  if (storagePath.startsWith("http")) return storagePath;

  const { data, error } = await sb.storage
    .from("composite-images")
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    console.error("Failed to sign composite image URL:", error?.message);
    return null;
  }

  return data.signedUrl;
}

/**
 * Generate fresh signed URLs for all segment videos in a StoredVideos structure.
 */
async function signSegmentVideos(
  sb: ReturnType<typeof getAdminClient>,
  stored: StoredVideos,
): Promise<ResponseSegments> {
  const result: ResponseSegments = { hooks: [], bodies: [], ctas: [] };
  const segmentTypes = ["hooks", "bodies", "ctas"] as const;

  // Sign all URLs in parallel
  const signingTasks = segmentTypes.flatMap((segType) =>
    stored[segType].map(async (seg) => {
      const { data, error } = await sb.storage
        .from("generated-videos")
        .createSignedUrl(seg.storage_path, 3600);

      if (error || !data?.signedUrl) {
        console.error(`Failed to sign video URL for ${seg.storage_path}:`, error?.message);
        return null;
      }

      return {
        segType,
        video: {
          url: data.signedUrl,
          duration: seg.duration,
          variation: seg.variation,
          variant_label: seg.variant_label,
        } as ResponseSegmentVideo,
      };
    })
  );

  const signed = await Promise.all(signingTasks);
  for (const item of signed) {
    if (item) result[item.segType].push(item.video);
  }

  return result;
}

/**
 * Return the most recent generation debit amount (absolute value) for a given generation.
 * This captures either the initial generation charge or a 1-credit segment regeneration charge.
 */
async function getLatestGenerationDebitAmount(
  sb: ReturnType<typeof getAdminClient>,
  userId: string,
  generationId: string,
): Promise<number | null> {
  const { data, error } = await sb
    .from("credit_ledger")
    .select("amount")
    .eq("owner_id", userId)
    .eq("reference_id", generationId)
    .eq("reason", "generation")
    .lt("amount", 0)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to read latest generation debit:", error.message);
    return null;
  }

  if (typeof data?.amount !== "number") return null;
  return Math.abs(data.amount);
}

/**
 * Parse a job key like "hook_1" into its segment type and variation number.
 */
function parseJobKey(jobKey: string): { segType: "hooks" | "bodies" | "ctas"; variation: number } {
  const parts = jobKey.split("_");
  const variation = parseInt(parts[parts.length - 1], 10);
  const prefix = parts.slice(0, -1).join("_"); // "hook", "body", "cta"

  const typeMap: Record<string, "hooks" | "bodies" | "ctas"> = {
    hook: "hooks",
    body: "bodies",
    bodie: "bodies", // legacy alias from a previous bug
    cta: "ctas",
  };

  const segType = typeMap[prefix];
  if (!segType) throw new Error(`Unknown job key prefix: ${prefix}`);

  return { segType, variation };
}

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "GET") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const url = new URL(req.url);
    const generationId = url.searchParams.get("generation_id");
    if (!generationId) {
      return json({ detail: "generation_id query parameter is required" }, cors, 400);
    }

    // Fetch generation and verify ownership
    const { data: gen, error: genErr } = await sb
      .from("generations")
      .select("*")
      .eq("id", generationId)
      .eq("owner_id", userId)
      .single();

    if (genErr || !gen) {
      return json({ detail: "Generation not found" }, cors, 404);
    }

    // ── Helper: build composite signed URL if available ──────────────
    let compositeImageUrl: string | null = null;
    if (gen.composite_image_url) {
      compositeImageUrl = await getCompositeSignedUrl(sb, gen.composite_image_url);
    }

    // ── Handle "completed"  -  return current state with fresh signed URLs ─
    if (gen.status === "completed") {
      let segments: ResponseSegments | undefined;
      if (gen.videos && typeof gen.videos === "object" && !Array.isArray(gen.videos)) {
        segments = await signSegmentVideos(sb, gen.videos as StoredVideos);
      }

      return json({
        data: {
          generation_id: gen.id,
          status: gen.status,
          mode: gen.mode,
          script: gen.script,
          composite_image_url: compositeImageUrl,
          segments,
          completed_at: gen.completed_at,
        },
      }, cors);
    }

    // ── Handle "failed"  -  return current state ──────────────────────
    if (gen.status === "failed") {
      return json({
        data: {
          generation_id: gen.id,
          status: gen.status,
          mode: gen.mode,
          script: gen.script,
          composite_image_url: compositeImageUrl,
          error_message: gen.error_message,
        },
      }, cors);
    }

    // ── Handle "generating_segments"  -  poll Kling for each job ──────
    if (gen.status === "generating_segments" && gen.external_job_ids) {
      const jobIds = gen.external_job_ids as Record<string, string>;
      const jobKeys = Object.keys(jobIds);

      // Guard against empty job IDs (shouldn't happen, but prevents 0===0 false "completed")
      if (jobKeys.length === 0) {
        return json({
          data: {
            generation_id: gen.id,
            status: "generating_segments",
            mode: gen.mode,
            script: gen.script,
            composite_image_url: compositeImageUrl,
            progress: { completed: 0, total: 0 },
          },
        }, cors);
      }

      // Load existing stored videos progress (or start fresh)
      const storedVideos: StoredVideos = (
        gen.videos &&
        typeof gen.videos === "object" &&
        !Array.isArray(gen.videos) &&
        (gen.videos as StoredVideos).hooks
      )
        ? gen.videos as StoredVideos
        : { hooks: [], bodies: [], ctas: [] };

      // Build a set of already-completed job keys from stored videos
      const completedKeys = new Set<string>();
      const segmentTypes = ["hooks", "bodies", "ctas"] as const;
      for (const segType of segmentTypes) {
        for (const seg of storedVideos[segType]) {
          // Derive job key from storage_path: e.g. "userId/genId/hook_1.mp4" -> "hook_1"
          const filename = seg.storage_path.split("/").pop() ?? "";
          const jobKey = filename.replace(".mp4", "");
          completedKeys.add(jobKey);
        }
      }

      let anyFailed = false;
      let failedMessage = "";

      // Get the script for looking up variant_label and duration
      const script = gen.script as Record<string, Array<Record<string, unknown>>> | null;

      for (const jobKey of jobKeys) {
        // Skip already completed jobs
        if (completedKeys.has(jobKey)) continue;

        let klingResult;
        try {
          klingResult = await checkKlingJob(jobIds[jobKey]);
        } catch (err) {
          console.error(`Kling check failed for ${jobKey}:`, err);
          // Treat transient errors as still-in-progress, not failure
          continue;
        }

        if (klingResult.status === "completed" && klingResult.video_url) {
          // Download and store the video
          try {
            const videoRes = await fetch(klingResult.video_url);
            if (!videoRes.ok) {
              throw new Error(`Failed to download video: HTTP ${videoRes.status}`);
            }
            const videoBlob = await videoRes.blob();
            const storagePath = `${userId}/${generationId}/${jobKey}.mp4`;

            const { error: uploadErr } = await sb.storage
              .from("generated-videos")
              .upload(storagePath, videoBlob, {
                contentType: "video/mp4",
                upsert: true,
              });

            if (uploadErr) {
              throw new Error(`Video upload failed for ${jobKey}: ${uploadErr.message}`);
            }

            // Parse job key to get segment type and variation
            const { segType, variation } = parseJobKey(jobKey);

            // Look up duration and variant_label from script
            let duration = 5;
            let variantLabel = "";
            if (script && script[segType]) {
              const segIndex = variation - 1;
              const segData = script[segType][segIndex];
              if (segData) {
                duration = (segData.duration_seconds as number) ?? 5;
                variantLabel = (segData.variant_label as string) ?? "";
              }
            }

            storedVideos[segType].push({
              storage_path: storagePath,
              duration,
              variation,
              variant_label: variantLabel,
            });

            completedKeys.add(jobKey);
          } catch (dlErr) {
            console.error(`Video download/upload failed for ${jobKey}:`, dlErr);
            anyFailed = true;
            failedMessage = dlErr instanceof Error ? dlErr.message : String(dlErr);
          }
        } else if (klingResult.status === "failed") {
          anyFailed = true;
          failedMessage = klingResult.error_message || `Video generation failed for segment ${jobKey}`;
        }
      }

      const completedCount = completedKeys.size;
      const totalCount = jobKeys.length;

      // Check if all jobs have a final status (completed or failed)
      const allJobsResolved = completedCount === totalCount || anyFailed;

      if (anyFailed) {
        // Mark as failed and refund credits
        await sb
          .from("generations")
          .update({
            status: "failed",
            videos: storedVideos,
            error_message: failedMessage || "One or more video segments failed",
          })
          .eq("id", generationId);

        // Refund credits based on the latest debit for this generation.
        // This correctly handles both initial generation failures and 1-credit segment regenerations.
        const quality = (gen.video_quality ?? "standard") as keyof typeof COSTS;
        const fallbackCost = gen.mode === "single"
          ? COSTS[quality].single
          : COSTS[quality].batch;
        const latestDebitAmount = await getLatestGenerationDebitAmount(sb, userId, generationId);
        const refundAmount = latestDebitAmount ?? fallbackCost;
        try {
          await refundCredits(userId, refundAmount, generationId);
          console.log(`Credits refunded: ${refundAmount} → user ${userId} for generation ${generationId}`);

          // If this was a discounted first-video attempt that failed, restore eligibility.
          if (refundAmount > 1) {
            const { data: profile } = await sb
              .from("profiles")
              .select("first_video_discount_used")
              .eq("id", userId)
              .maybeSingle();

            if (profile?.first_video_discount_used) {
              const { count: completedCount } = await sb
                .from("generations")
                .select("id", { count: "exact", head: true })
                .eq("owner_id", userId)
                .eq("status", "completed");

              if ((completedCount ?? 0) === 0) {
                await sb
                  .from("profiles")
                  .update({ first_video_discount_used: false })
                  .eq("id", userId);
              }
            }
          }
        } catch (refundErr) {
          // Log prominently — user loses credits if this fails
          console.error(`CRITICAL: Credit refund failed for generation ${generationId} (user ${userId}, ${refundAmount} credits):`, refundErr);
          // Update the generation error_message to include refund failure so it's traceable
          await sb.from("generations")
            .update({ error_message: `${failedMessage || "Generation failed"} | REFUND FAILED: ${refundErr instanceof Error ? refundErr.message : String(refundErr)}` })
            .eq("id", generationId);
        }

        return json({
          data: {
            generation_id: generationId,
            status: "failed",
            mode: gen.mode,
            script: gen.script,
            composite_image_url: compositeImageUrl,
            error_message: failedMessage || "One or more video segments failed",
            progress: { completed: completedCount, total: totalCount },
          },
        }, cors);
      }

      if (allJobsResolved && completedCount === totalCount) {
        // All 9 completed successfully
        await sb
          .from("generations")
          .update({
            status: "completed",
            videos: storedVideos,
            completed_at: new Date().toISOString(),
          })
          .eq("id", generationId);

        // Generate signed URLs for response
        const segments = await signSegmentVideos(sb, storedVideos);

        return json({
          data: {
            generation_id: generationId,
            status: "completed",
            mode: gen.mode,
            script: gen.script,
            composite_image_url: compositeImageUrl,
            segments,
            progress: { completed: completedCount, total: totalCount },
          },
        }, cors);
      }

      // Still in progress  -  save partial progress
      await sb
        .from("generations")
        .update({ videos: storedVideos })
        .eq("id", generationId);

      return json({
        data: {
          generation_id: generationId,
          status: "generating_segments",
          mode: gen.mode,
          script: gen.script,
          composite_image_url: compositeImageUrl,
          progress: { completed: completedCount, total: totalCount },
        },
      }, cors);
    }

    // ── Handle pre-video statuses (pending, scripting, submitting_jobs) ─
    return json({
      data: {
        generation_id: gen.id,
        status: gen.status,
        mode: gen.mode,
        script: gen.script ?? undefined,
        composite_image_url: compositeImageUrl,
      },
    }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("video-status error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
