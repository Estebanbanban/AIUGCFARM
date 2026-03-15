import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const { id } = await req.json();

    if (!id || typeof id !== "string") {
      return json({ detail: "Missing slideshow id" }, cors, 400);
    }

    const sb = getAdminClient();

    // Verify slideshow belongs to user and get video_storage_path
    const { data: slideshow, error: fetchErr } = await sb
      .from("slideshows")
      .select("id, video_storage_path")
      .eq("id", id)
      .eq("owner_id", userId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!slideshow) {
      return json({ detail: "Slideshow not found" }, cors, 404);
    }

    // If video_storage_path exists, delete from slideshow-videos bucket
    if (slideshow.video_storage_path) {
      const { error: removeErr } = await sb.storage
        .from("slideshow-videos")
        .remove([slideshow.video_storage_path]);

      if (removeErr) {
        console.error("Video storage cleanup error:", removeErr.message);
      }
    }

    // Delete DB row
    const { error: deleteErr } = await sb
      .from("slideshows")
      .delete()
      .eq("id", id)
      .eq("owner_id", userId);

    if (deleteErr) throw new Error(deleteErr.message);

    return json({ data: { success: true } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("delete-slideshow error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
