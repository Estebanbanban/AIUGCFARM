import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { ErrorCodes, errorResponse } from "../_shared/errors.ts";
import { exchangeCodeForTokens, fetchYouTubeChannels } from "../_shared/youtube.ts";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const db = getAdminClient();

    const { code, state } = await req.json();
    if (!code || typeof code !== "string") {
      return errorResponse(ErrorCodes.INVALID_INPUT, "code is required", 400, cors);
    }
    if (!state || typeof state !== "string") {
      return errorResponse(ErrorCodes.INVALID_INPUT, "state is required", 400, cors);
    }

    // Verify state: userId match + single-use nonce
    let statePayload: { userId?: string; nonce?: string };
    try {
      statePayload = JSON.parse(atob(state));
    } catch {
      return errorResponse(ErrorCodes.INVALID_INPUT, "Invalid state parameter", 400, cors);
    }

    if (statePayload.userId !== userId) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "State mismatch - userId does not match", 403, cors);
    }

    // Verify and consume the single-use nonce
    if (statePayload.nonce) {
      const { data: nonceRow, error: nonceErr } = await db
        .from("youtube_oauth_states")
        .select("id, expires_at")
        .eq("nonce", statePayload.nonce)
        .eq("owner_id", userId)
        .maybeSingle();

      if (nonceErr || !nonceRow) {
        return errorResponse(ErrorCodes.INVALID_INPUT, "Invalid or expired OAuth state", 400, cors);
      }
      if (new Date(nonceRow.expires_at) < new Date()) {
        await db.from("youtube_oauth_states").delete().eq("id", nonceRow.id);
        return errorResponse(ErrorCodes.INVALID_INPUT, "OAuth state expired. Please try connecting again.", 400, cors);
      }
      // Delete the nonce so it can't be reused
      await db.from("youtube_oauth_states").delete().eq("id", nonceRow.id);
    }

    const redirectUri = Deno.env.get("YOUTUBE_REDIRECT_URI");
    if (!redirectUri) throw new Error("YOUTUBE_REDIRECT_URI not configured");

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // Validate refresh_token is present (required for long-lived access)
    if (!tokens.refresh_token) {
      return errorResponse(
        ErrorCodes.INVALID_INPUT,
        "No refresh token returned. Please revoke CineRads access in your Google account settings and try again.",
        400,
        cors,
      );
    }

    // Fetch the user's YouTube channels
    const channels = await fetchYouTubeChannels(tokens.access_token);
    if (channels.length === 0) {
      return errorResponse(ErrorCodes.INVALID_INPUT, "No YouTube channels found for this account", 400, cors);
    }

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const now = new Date().toISOString();

    // Upsert a connection for each channel
    const upsertedConnections = [];
    for (const channel of channels) {
      const upsertPayload: Record<string, unknown> = {
        owner_id: userId,
        channel_id: channel.id,
        channel_title: channel.title,
        channel_thumbnail: channel.thumbnail,
        access_token: tokens.access_token,
        token_expires_at: tokenExpiresAt,
        scopes: SCOPES,
        updated_at: now,
      };
      // Only update refresh_token when present (avoid wiping existing token on re-auth)
      if (tokens.refresh_token) {
        upsertPayload.refresh_token = tokens.refresh_token;
      }

      const { data, error } = await db
        .from("youtube_connections")
        .upsert(upsertPayload, { onConflict: "owner_id,channel_id" })
        .select("id, channel_id, channel_title, channel_thumbnail, scopes, created_at, updated_at")
        .single();

      if (error) {
        console.error("Upsert error for channel", channel.id, error);
        throw new Error(`Failed to save connection for channel ${channel.title}: ${error.message}`);
      }

      upsertedConnections.push(data);
    }

    return json({ data: { connections: upsertedConnections } }, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Unauthorized") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401, cors);
    }
    console.error("youtube-callback error:", err);
    return errorResponse(ErrorCodes.INTERNAL_ERROR, msg ?? "Internal error", 500, cors);
  }
});
