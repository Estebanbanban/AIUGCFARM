import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { ErrorCodes, errorResponse } from "../_shared/errors.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "GET") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const db = getAdminClient();

    const url = new URL(req.url);
    const publishId = url.searchParams.get("publish_id");
    const generationId = url.searchParams.get("generation_id");

    // Single publish lookup by publish_id
    if (publishId) {
      const { data: publish, error } = await db
        .from("youtube_publishes")
        .select(`
          id,
          generation_id,
          connection_id,
          youtube_video_id,
          youtube_url,
          title,
          description,
          tags,
          visibility,
          status,
          error_message,
          published_at,
          created_at,
          updated_at,
          youtube_connections (
            channel_title
          )
        `)
        .eq("id", publishId)
        .eq("owner_id", userId)
        .single();

      if (error || !publish) {
        return errorResponse(ErrorCodes.INVALID_INPUT, "Publish record not found", 404, cors);
      }

      // Flatten the joined channel_title
      const { youtube_connections, ...rest } = publish as typeof publish & {
        youtube_connections: { channel_title: string } | null;
      };

      return json({
        data: {
          ...rest,
          channel_title: youtube_connections?.channel_title ?? null,
        },
      }, cors);
    }

    // List publishes for a generation
    if (generationId) {
      const { data: publishes, error } = await db
        .from("youtube_publishes")
        .select(`
          id,
          generation_id,
          connection_id,
          youtube_video_id,
          youtube_url,
          title,
          description,
          tags,
          visibility,
          status,
          error_message,
          published_at,
          created_at,
          updated_at,
          youtube_connections (
            channel_title
          )
        `)
        .eq("generation_id", generationId)
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("youtube-publish-status query error:", error);
        throw new Error("Failed to fetch publish records");
      }

      // Flatten the joined channel_title for each record
      const results = (publishes ?? []).map((p) => {
        const { youtube_connections, ...rest } = p as typeof p & {
          youtube_connections: { channel_title: string } | null;
        };
        return {
          ...rest,
          channel_title: youtube_connections?.channel_title ?? null,
        };
      });

      return json({ data: results }, cors);
    }

    // Neither publish_id nor generation_id provided
    return errorResponse(
      ErrorCodes.INVALID_INPUT,
      "Either publish_id or generation_id query parameter is required",
      400,
      cors,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Unauthorized") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401, cors);
    }
    console.error("youtube-publish-status error:", err);
    return errorResponse(ErrorCodes.INTERNAL_ERROR, msg ?? "Internal error", 500, cors);
  }
});
