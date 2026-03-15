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

    const { data: connections, error } = await db
      .from("youtube_connections")
      .select("id, channel_id, channel_title, channel_thumbnail, scopes, created_at, updated_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("list-youtube-connections query error:", error);
      throw new Error("Failed to fetch YouTube connections");
    }

    return json({ data: connections ?? [] }, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Unauthorized") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401, cors);
    }
    console.error("list-youtube-connections error:", err);
    return errorResponse(ErrorCodes.INTERNAL_ERROR, msg ?? "Internal error", 500, cors);
  }
});
