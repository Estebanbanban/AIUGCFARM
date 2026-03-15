/**
 * YouTube Data API v3 helpers for Supabase Edge Functions.
 * Handles OAuth token refresh and video uploads.
 */
import { getAdminClient } from "./supabase.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";
const YOUTUBE_CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
}

interface YouTubeChannel {
  id: string;
  title: string;
  thumbnail: string | null;
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  return res.json();
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${text}`);
  }

  return res.json();
}

/**
 * Get a valid access token for a YouTube connection.
 * Refreshes automatically if expired.
 */
export async function getValidAccessToken(connectionId: string): Promise<string> {
  const db = getAdminClient();
  const { data: conn, error } = await db
    .from("youtube_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("id", connectionId)
    .single();

  if (error || !conn) throw new Error("YouTube connection not found");

  const expiresAt = new Date(conn.token_expires_at);
  const now = new Date();
  // Refresh if token expires within 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(conn.refresh_token);
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

    const updatePayload: Record<string, unknown> = {
      access_token: refreshed.access_token,
      token_expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Persist rotated refresh token if Google returns one
    if ((refreshed as TokenResponse).refresh_token) {
      updatePayload.refresh_token = (refreshed as TokenResponse).refresh_token;
    }

    await db
      .from("youtube_connections")
      .update(updatePayload)
      .eq("id", connectionId);

    return refreshed.access_token;
  }

  return conn.access_token;
}

/**
 * Fetch YouTube channels accessible with the given access token.
 */
export async function fetchYouTubeChannels(accessToken: string): Promise<YouTubeChannel[]> {
  const res = await fetch(
    `${YOUTUBE_CHANNELS_URL}?part=snippet&mine=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch YouTube channels: ${text}`);
  }

  const data = await res.json();
  return (data.items ?? []).map((item: any) => ({
    id: item.id,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails?.default?.url ?? null,
  }));
}

/**
 * Upload a video to YouTube using resumable upload.
 * Streams the video from the source URL to avoid buffering in memory.
 */
export async function uploadToYouTube(
  accessToken: string,
  videoUrl: string,
  metadata: {
    title: string;
    description: string;
    tags: string[];
    visibility: "public" | "unlisted" | "private";
    categoryId?: string;
  }
): Promise<{ videoId: string; youtubeUrl: string }> {
  // Step 1: Fetch video headers to get content length (HEAD request to avoid buffering)
  const headRes = await fetch(videoUrl, { method: "HEAD" });
  if (!headRes.ok) {
    // Fall back to GET if HEAD not supported
    const getRes = await fetch(videoUrl);
    if (!getRes.ok) throw new Error("Failed to access video from storage");
    return uploadToYouTubeFromResponse(accessToken, getRes, metadata);
  }

  const contentLength = headRes.headers.get("content-length");
  const contentType = headRes.headers.get("content-type") || "video/mp4";

  // Step 2: Initiate resumable upload with YouTube
  const initRes = await fetch(
    `${YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        ...(contentLength ? { "X-Upload-Content-Length": contentLength } : {}),
        "X-Upload-Content-Type": contentType,
      },
      body: JSON.stringify({
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          categoryId: metadata.categoryId ?? "22", // People & Blogs
        },
        status: {
          privacyStatus: metadata.visibility,
          selfDeclaredMadeForKids: false,
        },
      }),
    }
  );

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`YouTube upload initiation failed: ${text}`);
  }

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("No upload URL returned from YouTube");

  // Step 3: Stream video directly from storage to YouTube (no full-body buffering)
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error("Failed to download video from storage");

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      ...(contentLength ? { "Content-Length": contentLength } : {}),
    },
    // Stream the body directly — avoids loading entire video into memory
    body: videoRes.body,
    // @ts-ignore: Deno supports duplex streaming
    duplex: "half",
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`YouTube video upload failed: ${text}`);
  }

  const result = await uploadRes.json();
  return {
    videoId: result.id,
    youtubeUrl: `https://www.youtube.com/watch?v=${result.id}`,
  };
}

/** Fallback: upload from an already-fetched Response (for when HEAD is not supported) */
async function uploadToYouTubeFromResponse(
  accessToken: string,
  videoRes: Response,
  metadata: {
    title: string;
    description: string;
    tags: string[];
    visibility: "public" | "unlisted" | "private";
    categoryId?: string;
  }
): Promise<{ videoId: string; youtubeUrl: string }> {
  const contentLength = videoRes.headers.get("content-length");
  const contentType = videoRes.headers.get("content-type") || "video/mp4";

  const initRes = await fetch(
    `${YOUTUBE_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        ...(contentLength ? { "X-Upload-Content-Length": contentLength } : {}),
        "X-Upload-Content-Type": contentType,
      },
      body: JSON.stringify({
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          categoryId: metadata.categoryId ?? "22",
        },
        status: {
          privacyStatus: metadata.visibility,
          selfDeclaredMadeForKids: false,
        },
      }),
    }
  );

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`YouTube upload initiation failed: ${text}`);
  }

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("No upload URL returned from YouTube");

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      ...(contentLength ? { "Content-Length": contentLength } : {}),
    },
    body: videoRes.body,
    // @ts-ignore: Deno supports duplex streaming
    duplex: "half",
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`YouTube video upload failed: ${text}`);
  }

  const result = await uploadRes.json();
  return {
    videoId: result.id,
    youtubeUrl: `https://www.youtube.com/watch?v=${result.id}`,
  };
}
