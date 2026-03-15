import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { r2Delete } from "../_shared/r2.ts";

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
      return json({ detail: "Missing image id" }, cors, 400);
    }

    const sb = getAdminClient();

    // Fetch the image — enforce owner_id in the query itself
    const { data: image, error: fetchErr } = await sb
      .from("collection_images")
      .select("id, storage_path, collection_id")
      .eq("id", id)
      .eq("owner_id", userId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!image) {
      return json({ detail: "Image not found" }, cors, 404);
    }

    // Delete from R2
    try {
      await r2Delete(`slideshow-images/${image.storage_path}`);
    } catch (err) {
      console.error("R2 delete error:", (err as Error).message);
    }

    // Delete DB row (trigger auto-decrements image_count)
    const { error: deleteErr } = await sb
      .from("collection_images")
      .delete()
      .eq("id", id)
      .eq("owner_id", userId);

    if (deleteErr) throw new Error(deleteErr.message);

    return json({ data: { success: true } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("delete-collection-image error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
