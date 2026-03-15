import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { checkSoraJob, downloadSoraVideo } from "../_shared/sora.ts";
import { refundCredits } from "../_shared/credits.ts";
import { sendEmail } from "../_shared/email.ts";
import { captureException } from "../_shared/sentry.ts";

// Credit costs per Sora model
const SORA_COSTS: Record<string, number> = {
  "sora-2": 5,
  "sora-2-pro": 10,
};

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

    // Fetch generation and verify ownership + type
    const { data: gen, error: genErr } = await sb
      .from("generations")
      .select("*")
      .eq("id", generationId)
      .eq("owner_id", userId)
      .eq("type", "single-video")
      .single();

    if (genErr || !gen) {
      return json({ detail: "Generation not found" }, cors, 404);
    }

    // ── Handle "completed" — return existing video URL with fresh signed URL ──
    if (gen.status === "completed") {
      const videos = gen.videos as { completed?: Array<{ key: string; url: string; storage_path: string }> } | null;
      let videoUrl: string | null = null;

      if (videos?.completed?.[0]?.storage_path) {
        const { data: signedData } = await sb.storage
          .from("generated-videos")
          .createSignedUrl(videos.completed[0].storage_path, 3600);
        videoUrl = signedData?.signedUrl ?? null;
      }

      return json({
        data: {
          generation_id: gen.id,
          status: "completed",
          progress: 100,
          video_url: videoUrl,
          completed_at: gen.completed_at,
        },
      }, cors);
    }

    // ── Handle "failed" — return error info ──
    if (gen.status === "failed") {
      return json({
        data: {
          generation_id: gen.id,
          status: "failed",
          progress: 0,
          error_message: gen.error_message,
        },
      }, cors);
    }

    // ── Handle "generating_segments" — poll the single Sora job ──
    if (gen.status === "generating_segments" && gen.external_job_ids) {
      const jobIds = gen.external_job_ids as Record<string, string>;
      const jobId = jobIds.video;

      if (!jobId) {
        return json({
          data: {
            generation_id: gen.id,
            status: "generating_segments",
            progress: 0,
          },
        }, cors);
      }

      const soraJob = await checkSoraJob(jobId);

      // ── Sora job completed ──
      if (soraJob.status === "completed") {
        // Download the video
        const videoBlob = await downloadSoraVideo(jobId);

        // Upload to Supabase Storage
        const storagePath = `${userId}/${generationId}/video.mp4`;
        const { error: uploadErr } = await sb.storage
          .from("generated-videos")
          .upload(storagePath, videoBlob, {
            contentType: "video/mp4",
            upsert: true,
          });

        if (uploadErr) {
          throw new Error(`Video upload failed: ${uploadErr.message}`);
        }

        // Create signed URL (1 hour)
        const { data: signedData } = await sb.storage
          .from("generated-videos")
          .createSignedUrl(storagePath, 3600);

        const signedUrl = signedData?.signedUrl ?? null;

        // Update generation record
        await sb
          .from("generations")
          .update({
            status: "completed",
            videos: {
              completed: [{ key: "video", url: signedUrl, storage_path: storagePath }],
            },
            completed_at: new Date().toISOString(),
          })
          .eq("id", generationId);

        // Send email notification — non-blocking
        try {
          const { data: userRecord } = await sb.auth.admin.getUserById(gen.owner_id);
          const userEmail = userRecord?.user?.email;
          if (userEmail) {
            await sendEmail({
              to: userEmail,
              subject: "Your UGC video is ready \uD83C\uDFAC",
              html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                  <h2 style="margin:0 0 8px">Your video is ready!</h2>
                  <p style="color:#666;margin:0 0 24px">Your UGC video has finished generating. Click below to view and download your result.</p>
                  <a href="https://app.cinerads.com/generate/${gen.id}"
                     style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">
                    View Result &rarr;
                  </a>
                </div>
              `,
            });
          }
        } catch (emailErr) {
          console.error("single-video-status: email notification failed (non-fatal):", emailErr);
        }

        return json({
          data: {
            generation_id: generationId,
            status: "completed",
            progress: 100,
            video_url: signedUrl,
          },
        }, cors);
      }

      // ── Sora job failed ──
      if (soraJob.status === "failed") {
        const soraModel = (gen.sora_model ?? "sora-2") as string;
        const refundAmount = SORA_COSTS[soraModel] ?? 5;
        const errorMsg = soraJob.error_message || "Video generation failed.";

        // Atomically update status to "failed" — only if still "generating_segments"
        // This prevents double-refund from concurrent polling requests
        const { data: updated, error: updateErr } = await sb
          .from("generations")
          .update({
            status: "failed",
            error_message: errorMsg,
          })
          .eq("id", generationId)
          .eq("status", "generating_segments")
          .select("id")
          .maybeSingle();

        // Only refund if WE were the one to transition the status (row was updated)
        if (updated && !updateErr) {
          try {
            await refundCredits(userId, refundAmount, generationId);
            console.log(`Credits refunded: ${refundAmount} -> user ${userId} for generation ${generationId}`);
          } catch (refundErr) {
            console.error(`CRITICAL: Credit refund failed for generation ${generationId} (user ${userId}, ${refundAmount} credits):`, refundErr);
          }
        }

        return json({
          data: {
            generation_id: generationId,
            status: "failed",
            progress: 0,
            error_message: errorMsg,
          },
        }, cors);
      }

      // ── Sora job still pending or processing ──
      return json({
        data: {
          generation_id: gen.id,
          status: "generating_segments",
          progress: soraJob.progress,
        },
      }, cors);
    }

    // ── Handle any other status (pending, scripting, submitting_jobs, etc.) ──
    return json({
      data: {
        generation_id: gen.id,
        status: gen.status,
      },
    }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    captureException(e);
    console.error("single-video-status error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
