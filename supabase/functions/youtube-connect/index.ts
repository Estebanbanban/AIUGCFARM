import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { ErrorCodes, errorResponse } from "../_shared/errors.ts";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const redirectUri = Deno.env.get("YOUTUBE_REDIRECT_URI");
    if (!clientId || !redirectUri) {
      throw new Error("Google OAuth not configured");
    }

    // Generate a cryptographic nonce for CSRF protection
    const nonce = crypto.randomUUID();

    // Store the nonce in DB for single-use verification
    const db = getAdminClient();
    await db.from("youtube_oauth_states").insert({
      nonce,
      owner_id: userId,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
    });

    const state = btoa(JSON.stringify({ userId, nonce }));

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state,
    });

    const url = `${GOOGLE_AUTH_URL}?${params.toString()}`;

    return json({ data: { url } }, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Unauthorized") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401, cors);
    }
    console.error("youtube-connect error:", err);
    return errorResponse(ErrorCodes.INTERNAL_ERROR, msg ?? "Internal error", 500, cors);
  }
});
