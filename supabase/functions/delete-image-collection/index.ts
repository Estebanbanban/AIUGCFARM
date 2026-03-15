import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { r2DeleteMany } from "../_shared/r2.ts";

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

    // Fetch all images to delete from R2
    const { data: images } = await sb
      .from("collection_images")
      .select("storage_path")
      .eq("collection_id", id);

    // Delete files from R2
    if (images && images.length > 0) {
      const r2Keys = images.map((img) => `slideshow-images/${img.storage_path}`);
      try {
        await r2DeleteMany(r2Keys);
      } catch (err) {
        console.error("R2 cleanup error:", (err as Error).message);
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
