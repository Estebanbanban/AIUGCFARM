import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { ErrorCodes, errorResponse } from "../_shared/errors.ts";
import { getValidAccessToken, uploadToYouTube } from "../_shared/youtube.ts";

// The DB stores videos as { hooks: [{ storage_path, duration, ... }], ... }
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

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const db = getAdminClient();

    const body = await req.json();
    const {
      generation_id,
      connection_id,
      title,
      description,
      tags,
      visibility,
    } = body as {
      generation_id: string;
      connection_id: string;
      title: string;
      description?: string;
      tags?: string[];
      visibility?: "public" | "unlisted" | "private";
    };

    // Validate required fields
    if (!generation_id || !connection_id || !title) {
      return errorResponse(
        ErrorCodes.INVALID_INPUT,
        "generation_id, connection_id, and title are required",
        400,
        cors,
      );
    }

    // Verify the connection belongs to this user
    const { data: connection, error: connErr } = await db
      .from("youtube_connections")
      .select("id")
      .eq("id", connection_id)
      .eq("owner_id", userId)
      .single();

    if (connErr || !connection) {
      return errorResponse(ErrorCodes.INVALID_INPUT, "YouTube connection not found", 404, cors);
    }

    // Verify the generation belongs to this user AND fetch the videos JSON
    const { data: generation, error: genErr } = await db
      .from("generations")
      .select("id, owner_id, videos, status")
      .eq("id", generation_id)
      .eq("owner_id", userId)
      .single();

    if (genErr || !generation) {
      return errorResponse(ErrorCodes.INVALID_INPUT, "Generation not found", 404, cors);
    }

    if (generation.status !== "completed") {
      return errorResponse(ErrorCodes.INVALID_INPUT, "Generation is not completed yet", 400, cors);
    }

    // Prefer stitched video (uploaded by frontend after client-side stitch)
    // Fall back to first available segment if stitched version doesn't exist
    const stitchedPath = `${userId}/${generation_id}/stitched.mp4`;
    let storagePath = stitchedPath;

    // Check if stitched file actually exists in storage
    const dirPath = `${userId}/${generation_id}`;
    const { data: fileList } = await db.storage
      .from("generated-videos")
      .list(dirPath, { search: "stitched.mp4" });

    const stitchedExists = (fileList ?? []).some((f) => f.name === "stitched.mp4");

    if (!stitchedExists) {
      // No stitched video — fall back to first segment
      const videos = generation.videos as StoredVideos | null;
      const firstVideo =
        videos?.hooks?.[0] ??
        videos?.bodies?.[0] ??
        videos?.ctas?.[0];

      if (!firstVideo?.storage_path) {
        return errorResponse(ErrorCodes.INVALID_INPUT, "No video found. Please stitch the video first.", 400, cors);
      }

      storagePath = firstVideo.storage_path;
    }

    // Prevent duplicate publishes for the same generation + channel
    const { data: existingPublish } = await db
      .from("youtube_publishes")
      .select("id, status, youtube_url")
      .eq("generation_id", generation_id)
      .eq("connection_id", connection_id)
      .in("status", ["uploading", "completed"])
      .maybeSingle();

    if (existingPublish) {
      if (existingPublish.status === "completed") {
        return json({
          data: {
            publish_id: existingPublish.id,
            status: "completed",
            youtube_url: existingPublish.youtube_url,
            message: "Already published to this channel",
          },
        }, cors);
      }
      // Already uploading — return the existing record
      return json({
        data: {
          publish_id: existingPublish.id,
          status: "uploading",
          message: "Upload already in progress",
        },
      }, cors);
    }

    // Create a publish record with status "uploading"
    const { data: publish, error: insertErr } = await db
      .from("youtube_publishes")
      .insert({
        owner_id: userId,
        generation_id,
        connection_id,
        title,
        description: description ?? "",
        tags: tags ?? [],
        visibility: visibility ?? "private",
        status: "uploading",
      })
      .select("id, status, created_at")
      .single();

    if (insertErr || !publish) {
      console.error("publish-youtube insert error:", insertErr);
      throw new Error("Failed to create publish record");
    }

    // Get a signed URL for the video from Supabase Storage (correct bucket: generated-videos)
    const { data: signedUrlData, error: signErr } = await db.storage
      .from("generated-videos")
      .createSignedUrl(storagePath, 3600);

    if (signErr || !signedUrlData?.signedUrl) {
      await db
        .from("youtube_publishes")
        .update({
          status: "failed",
          error_message: "Failed to create signed URL for video",
          updated_at: new Date().toISOString(),
        })
        .eq("id", publish.id);

      return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to access video file", 500, cors);
    }

    // Get a valid access token (auto-refreshes if expired)
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(connection_id);
    } catch (tokenErr) {
      const tokenMsg = tokenErr instanceof Error ? tokenErr.message : String(tokenErr);
      await db
        .from("youtube_publishes")
        .update({
          status: "failed",
          error_message: `Token error: ${tokenMsg}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", publish.id);

      return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to authenticate with YouTube", 500, cors);
    }

    // Upload to YouTube
    try {
      const result = await uploadToYouTube(accessToken, signedUrlData.signedUrl, {
        title,
        description: description ?? "",
        tags: tags ?? [],
        visibility: visibility ?? "private",
      });

      // Update publish record with success
      const { error: updateErr } = await db
        .from("youtube_publishes")
        .update({
          youtube_video_id: result.videoId,
          youtube_url: result.youtubeUrl,
          status: "completed",
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", publish.id);

      if (updateErr) {
        console.error("publish-youtube update error:", updateErr);
      }

      return json({
        data: {
          publish_id: publish.id,
          status: "completed",
          youtube_video_id: result.videoId,
          youtube_url: result.youtubeUrl,
        },
      }, cors);
    } catch (uploadErr) {
      const uploadMsg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
      console.error("publish-youtube upload error:", uploadMsg);

      await db
        .from("youtube_publishes")
        .update({
          status: "failed",
          error_message: uploadMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", publish.id);

      return json({
        data: {
          publish_id: publish.id,
          status: "failed",
          error_message: uploadMsg,
        },
      }, cors);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Unauthorized") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401, cors);
    }
    console.error("publish-youtube error:", err);
    return errorResponse(ErrorCodes.INTERNAL_ERROR, msg ?? "Internal error", 500, cors);
  }
});
