import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { ErrorCodes, errorResponse } from "../_shared/errors.ts";

const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const db = getAdminClient();

    const { connection_id } = await req.json();
    if (!connection_id || typeof connection_id !== "string") {
      return errorResponse(ErrorCodes.INVALID_INPUT, "connection_id is required", 400, cors);
    }

    // Fetch the connection to get the token for revocation (and verify ownership)
    const { data: conn } = await db
      .from("youtube_connections")
      .select("id, access_token, refresh_token, owner_id")
      .eq("id", connection_id)
      .eq("owner_id", userId)
      .maybeSingle();

    if (!conn) {
      return errorResponse(ErrorCodes.INVALID_INPUT, "Connection not found", 404, cors);
    }

    // Delete the connection from the database
    const { error: deleteError } = await db
      .from("youtube_connections")
      .delete()
      .eq("id", connection_id)
      .eq("owner_id", userId);

    if (deleteError) throw new Error(deleteError.message);

    // Best-effort token revocation with Google
    const tokenToRevoke = conn.refresh_token || conn.access_token;
    if (tokenToRevoke) {
      try {
        await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(tokenToRevoke)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      } catch (revokeErr) {
        // Don't fail the disconnect if revocation fails
        console.warn("Token revocation failed (best effort):", revokeErr);
      }
    }

    return json({ data: { ok: true } }, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Unauthorized") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401, cors);
    }
    console.error("youtube-disconnect error:", err);
    return errorResponse(ErrorCodes.INTERNAL_ERROR, msg ?? "Internal error", 500, cors);
  }
});
