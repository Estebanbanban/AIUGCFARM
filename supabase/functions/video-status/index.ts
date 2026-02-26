import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const KLING_API_KEY = Deno.env.get("KLING_API_KEY")!;
const KLING_BASE_URL =
  Deno.env.get("KLING_BASE_URL") || "https://api.klingai.com/v1";

/** Poll Kling API for a single job's status. */
async function checkKlingJob(
  jobId: string,
): Promise<{ status: string; video_url?: string }> {
  const res = await fetch(`${KLING_BASE_URL}/videos/jobs/${jobId}`, {
    headers: {
      Authorization: `Bearer ${KLING_API_KEY}`,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kling status check failed: ${err}`);
  }

  const body = await res.json();
  return {
    status: body.status, // "pending" | "processing" | "completed" | "failed"
    video_url: body.output?.video_url,
  };
}

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

    // If already completed or failed, return current state
    if (gen.status === "completed" || gen.status === "failed") {
      return json({
        data: {
          generation_id: gen.id,
          status: gen.status,
          videos: gen.videos,
          error_message: gen.error_message,
          completed_at: gen.completed_at,
        },
      }, cors);
    }

    // If generating_video, poll Kling for each job
    if (gen.status === "generating_video" && gen.external_job_ids) {
      const jobIds = gen.external_job_ids as Record<string, string>;
      const segments = Object.keys(jobIds);
      const videoResults: Record<string, { status: string; url?: string }> = {};
      const videos = (gen.videos as { segment: string; url: string }[]) ?? [];
      const completedSegments = new Set(videos.map((v) => v.segment));
      let allDone = true;
      let anyFailed = false;

      for (const segment of segments) {
        if (completedSegments.has(segment)) {
          videoResults[segment] = { status: "completed" };
          continue;
        }

        const result = await checkKlingJob(jobIds[segment]);
        videoResults[segment] = { status: result.status };

        if (result.status === "completed" && result.video_url) {
          // Download and store the video
          const videoRes = await fetch(result.video_url);
          if (videoRes.ok) {
            const videoBlob = await videoRes.blob();
            const storagePath = `${userId}/${generationId}/${segment}.mp4`;

            const { error: uploadErr } = await sb.storage
              .from("generated-videos")
              .upload(storagePath, videoBlob, {
                contentType: "video/mp4",
                upsert: false,
              });

            if (!uploadErr) {
              const {
                data: { publicUrl },
              } = sb.storage
                .from("generated-videos")
                .getPublicUrl(storagePath);

              videos.push({ segment, url: publicUrl });
              videoResults[segment].url = publicUrl;
            } else {
              console.error(`Video upload failed for ${segment}:`, uploadErr);
              anyFailed = true;
            }
          }
        } else if (result.status === "failed") {
          anyFailed = true;
        } else {
          allDone = false;
        }
      }

      // Update generation
      if (allDone && !anyFailed) {
        await sb
          .from("generations")
          .update({
            status: "completed",
            videos,
            completed_at: new Date().toISOString(),
          })
          .eq("id", generationId);
      } else if (anyFailed && allDone) {
        await sb
          .from("generations")
          .update({
            status: "failed",
            videos,
            error_message: "One or more video segments failed",
          })
          .eq("id", generationId);
      } else {
        // Partial progress — update videos array
        await sb
          .from("generations")
          .update({ videos })
          .eq("id", generationId);
      }

      const completedCount = videos.length;
      const totalCount = segments.length;

      return json({
        data: {
          generation_id: generationId,
          status: allDone
            ? anyFailed
              ? "failed"
              : "completed"
            : "generating_video",
          progress: {
            completed: completedCount,
            total: totalCount,
            segments: videoResults,
          },
          videos,
        },
      }, cors);
    }

    // For other statuses (scripting, generating_image), return current state
    return json({
      data: {
        generation_id: gen.id,
        status: gen.status,
        script: gen.script,
        composite_image_url: gen.composite_image_url,
        videos: gen.videos,
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
