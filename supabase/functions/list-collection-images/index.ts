import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { r2PublicUrl } from "../_shared/r2.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "GET") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const url = new URL(req.url);
    const collectionId = url.searchParams.get("collection_id");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") ?? "200", 10)));

    if (!collectionId) {
      return json({ detail: "collection_id is required" }, cors, 400);
    }

    // Verify collection belongs to user
    const { data: collection, error: colErr } = await sb
      .from("image_collections")
      .select("id")
      .eq("id", collectionId)
      .eq("owner_id", userId)
      .maybeSingle();

    if (colErr) throw new Error(colErr.message);
    if (!collection) {
      return json({ detail: "Collection not found" }, cors, 404);
    }

    // Get total count
    const { count: total } = await sb
      .from("collection_images")
      .select("id", { count: "exact", head: true })
      .eq("collection_id", collectionId);

    // Fetch paginated images
    const offset = (page - 1) * limit;
    const { data: images, error: imgErr } = await sb
      .from("collection_images")
      .select("id, filename, storage_path, width, height, created_at")
      .eq("collection_id", collectionId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (imgErr) throw new Error(imgErr.message);

    // Build public R2 URLs — no signed URL calls needed
    const imagesWithUrls = (images ?? []).map((img) => ({
      id: img.id,
      filename: img.filename,
      url: r2PublicUrl(img.storage_path),
      width: img.width,
      height: img.height,
      created_at: img.created_at,
    }));

    return json(
      {
        data: {
          images: imagesWithUrls,
          total: total ?? 0,
          page,
        },
      },
      cors,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("list-collection-images error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
