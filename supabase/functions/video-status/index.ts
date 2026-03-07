import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { checkKlingJob } from "../_shared/kling.ts";
import { checkSoraJob } from "../_shared/sora.ts";
import { refundCredits } from "../_shared/credits.ts";
import { sendEmail } from "../_shared/email.ts";
import { captureException } from "../_shared/sentry.ts";

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
  failed?: string[]; // job keys that failed e.g. ["hook_2", "cta_3"]
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

  // Collect all storage paths with their metadata for batch signing
  const allSegments: Array<{ segType: typeof segmentTypes[number]; seg: StoredSegmentVideo }> = [];
  const allPaths: string[] = [];

  for (const segType of segmentTypes) {
    for (const seg of stored[segType]) {
      allSegments.push({ segType, seg });
      allPaths.push(seg.storage_path);
    }
  }

  if (allPaths.length === 0) return result;

  // Batch sign all video URLs in a single call
  const { data: batchSigned, error: batchErr } = await sb.storage
    .from("generated-videos")
    .createSignedUrls(allPaths, 3600);

  if (batchErr || !batchSigned) {
    console.error("Failed to batch sign video URLs:", batchErr?.message);
    return result;
  }

  // Map signed URLs back to segments
  for (let i = 0; i < allSegments.length; i++) {
    const signed = batchSigned[i];
    if (!signed?.signedUrl) {
      console.error(`Failed to sign video URL for ${allPaths[i]}`);
      continue;
    }

    const { segType, seg } = allSegments[i];
    result[segType].push({
      url: signed.signedUrl,
      duration: seg.duration,
      variation: seg.variation,
      variant_label: seg.variant_label,
    });
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
          hooks_count: gen.hooks_count ?? 3,
          bodies_count: gen.bodies_count ?? 3,
          ctas_count: gen.ctas_count ?? 3,
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

      const failedSegments: string[] = [];
      let failedMessage = "";

      // Get the script for looking up variant_label and duration
      const script = gen.script as Record<string, Array<Record<string, unknown>>> | null;

      // Poll all pending jobs in parallel — route by provider for backward compat
      const videoProvider = (gen.video_provider ?? "kling") as "kling" | "sora";
      const pendingJobKeys = jobKeys.filter((k) => !completedKeys.has(k));
      const pollResults = await Promise.allSettled(
        pendingJobKeys.map(async (jobKey) => {
          const klingResult = videoProvider === "sora"
            ? await checkSoraJob(jobIds[jobKey])
            : await checkKlingJob(jobIds[jobKey]);
          return { jobKey, klingResult };
        })
      );

      // Process poll results — download & upload completed videos in parallel
      const downloadTasks: Promise<void>[] = [];

      for (let i = 0; i < pollResults.length; i++) {
        const pollResult = pollResults[i];
        const pendingJobKey = pendingJobKeys[i];

        if (pollResult.status === "rejected") {
          // Distinguish permanent 4xx errors from transient ones
          const errMsg = pollResult.reason instanceof Error ? pollResult.reason.message : String(pollResult.reason);
          console.error("Video job check failed:", errMsg);
          const statusMatch = errMsg.match(/(?:Kling|Sora) status error (\d{3})/);
          const httpStatus = statusMatch ? parseInt(statusMatch[1], 10) : 0;
          const isPermanentHttp = httpStatus >= 400 && httpStatus < 500 && httpStatus !== 429;
          const permanentBodyPatterns = /INVALID_IMAGE|content.?policy|NSFW|MODERATION|banned|blocked/i;
          const isPermanent = isPermanentHttp || permanentBodyPatterns.test(errMsg);
          if (isPermanent) {
            failedSegments.push(pendingJobKey);
            // Use a generic message — don't expose raw API error details to client
            failedMessage = httpStatus >= 400 && httpStatus < 500
              ? "Video generation was rejected (content policy or invalid input). Please try a different image or script."
              : "Video generation failed. Please try again.";
          }
          // Transient or permanent: treat as still-in-progress or failed, do not break
          continue;
        }
        const { jobKey, klingResult } = pollResult.value;

        if (klingResult.status === "completed" && klingResult.video_url) {
          downloadTasks.push(
            (async () => {
              const videoRes = await fetch(klingResult.video_url!);
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

              const { segType, variation } = parseJobKey(jobKey);

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
            })().catch((dlErr) => {
              console.error(`Video download/upload failed for ${jobKey}:`, dlErr);
              failedSegments.push(jobKey);
              failedMessage = "Failed to save one or more video segments. Please try again.";
            })
          );
        } else if (klingResult.status === "failed") {
          const errMsg = klingResult.error_message || "";
          const permanentContentPatterns = /INVALID_IMAGE|content.?policy|NSFW|MODERATION|banned|blocked/i;
          failedSegments.push(jobKey);
          // Don't expose raw API error details — log internally, show generic message
          console.error(`Kling segment ${jobKey} failed:`, errMsg);
          failedMessage = permanentContentPatterns.test(errMsg)
            ? "Video generation was rejected. The image or script may have triggered a content policy check."
            : "Video generation failed. Please try again.";
        }
      }

      await Promise.all(downloadTasks);

      const completedCount = completedKeys.size;
      const totalCount = jobKeys.length;
      const failedCount = failedSegments.length;

      // Check if all jobs have a final status (completed or failed)
      const allJobsResolved = completedCount + failedCount === totalCount;

      if (failedCount > 0 && allJobsResolved) {
        const quality = (gen.video_quality ?? "standard") as keyof typeof COSTS;
        const fallbackCost = gen.mode === "single"
          ? COSTS[quality].single
          : COSTS[quality].batch;
        const latestDebitAmount = await getLatestGenerationDebitAmount(sb, userId, generationId);

        if (failedCount === totalCount) {
          // ALL segments failed — full failure, full refund (existing behavior)
          await sb
            .from("generations")
            .update({
              status: "failed",
              videos: storedVideos,
              error_message: failedMessage || "All video segments failed to generate.",
            })
            .eq("id", generationId);

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
                const { count: completedGenerationsCount } = await sb
                  .from("generations")
                  .select("id", { count: "exact", head: true })
                  .eq("owner_id", userId)
                  .eq("status", "completed");

                if ((completedGenerationsCount ?? 0) === 0) {
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
              error_message: failedMessage || "All video segments failed to generate.",
              progress: { completed: completedCount, total: totalCount },
            },
          }, cors);
        } else {
          // PARTIAL failure — some segments succeeded; mark completed with failed list
          storedVideos.failed = failedSegments;
          const partialErrorMsg = `${failedCount} of ${totalCount} segment(s) failed to generate. Credits refunded for failed segments.`;

          await sb
            .from("generations")
            .update({
              status: "completed",
              videos: storedVideos,
              completed_at: new Date().toISOString(),
              error_message: partialErrorMsg,
            })
            .eq("id", generationId);

          // Proportional refund for failed segments only
          if (latestDebitAmount && latestDebitAmount > 0) {
            const proportionalRefund = Math.round((failedCount / totalCount) * latestDebitAmount);
            if (proportionalRefund > 0) {
              try {
                await refundCredits(userId, proportionalRefund, generationId);
                console.log(`Partial credits refunded: ${proportionalRefund} of ${latestDebitAmount} → user ${userId} for generation ${generationId} (${failedCount}/${totalCount} segments failed)`);
              } catch (refundErr) {
                console.error(`CRITICAL: Partial credit refund failed for generation ${generationId} (user ${userId}, ${proportionalRefund} credits):`, refundErr);
              }
            }
          }

          return json({
            data: {
              generation_id: generationId,
              status: "completed",
              mode: gen.mode,
              script: gen.script,
              composite_image_url: compositeImageUrl,
              error_message: partialErrorMsg,
              progress: { completed: completedCount, total: totalCount },
            },
          }, cors);
        }
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

        // Send email notification — non-blocking, failure must not affect status
        try {
          const { data: userRecord } = await sb.auth.admin.getUserById(gen.owner_id);
          const userEmail = userRecord?.user?.email;
          if (userEmail) {
            await sendEmail({
              to: userEmail,
              subject: "Your UGC video is ready 🎬",
              html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                  <h2 style="margin:0 0 8px">Your video is ready!</h2>
                  <p style="color:#666;margin:0 0 24px">Your UGC ad has finished generating. Click below to view and download your results.</p>
                  <a href="https://app.cinerads.com/generate/${gen.id}"
                     style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">
                    View Result →
                  </a>
                </div>
              `,
            });
          }
        } catch (emailErr) {
          console.error("video-status: email notification failed (non-fatal):", emailErr);
        }

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
            hooks_count: gen.hooks_count ?? 3,
            bodies_count: gen.bodies_count ?? 3,
            ctas_count: gen.ctas_count ?? 3,
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
    captureException(e);
    console.error("video-status error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
