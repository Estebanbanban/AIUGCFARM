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
      return json({ detail: "Missing collection id" }, cors, 400);
    }

    const sb = getAdminClient();

    // Verify collection belongs to user
    const { data: collection, error: fetchErr } = await sb
      .from("image_collections")
      .select("id")
      .eq("id", id)
      .eq("owner_id", userId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!collection) {
      return json({ detail: "Collection not found" }, cors, 404);
    }

    // Fetch all images to delete from storage
    const { data: images } = await sb
      .from("collection_images")
      .select("storage_path")
      .eq("collection_id", id);

    // Delete files from storage
    if (images && images.length > 0) {
      const paths = images.map((img) => img.storage_path);
      const { error: removeErr } = await sb.storage
        .from("slideshow-images")
        .remove(paths);

      if (removeErr) {
        console.error("Storage cleanup error:", removeErr.message);
      }
    }

    // Delete collection (cascades to collection_images)
    const { error: deleteErr } = await sb
      .from("image_collections")
      .delete()
      .eq("id", id)
      .eq("owner_id", userId);

    if (deleteErr) throw new Error(deleteErr.message);

    return json({ data: { success: true } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("delete-image-collection error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
