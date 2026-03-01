import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const MAX_PATHS = 20;
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const { paths } = await req.json();

    if (!Array.isArray(paths) || paths.length === 0) {
      return json({ detail: "paths must be a non-empty array of strings" }, cors, 400);
    }
    if (paths.length > MAX_PATHS) {
      return json(
        { detail: `Too many paths. Maximum is ${MAX_PATHS}.` },
        cors,
        400,
      );
    }
    for (const p of paths) {
      if (typeof p !== "string" || !p) {
        return json({ detail: "Each path must be a non-empty string" }, cors, 400);
      }
    }

    // Security: only allow paths owned by the authenticated user.
    // Storage paths follow the pattern "{userId}/{uuid}.png".
    const userPrefix = `${userId}/`;
    const unauthorizedPaths = paths.filter(
      (p: string) => !p.startsWith(userPrefix),
    );
    if (unauthorizedPaths.length > 0) {
      return json({ detail: "Access denied to one or more requested images" }, cors, 403);
    }

    // Generate signed URLs for all requested paths
    const urls: Record<string, string> = {};
    for (const path of paths as string[]) {
      const { data } = await sb.storage
        .from("persona-images")
        .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
      if (data?.signedUrl) {
        urls[path] = data.signedUrl;
      }
    }

    return json({ data: { urls } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("persona-images error:", e);
    return json({ detail: "Failed to generate image URLs. Please try again." }, cors, 500);
  }
});
