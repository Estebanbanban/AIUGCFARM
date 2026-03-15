import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "GET") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    // Fetch all collections for the user
    const { data: collections, error } = await sb
      .from("image_collections")
      .select("id, name, description, image_count, created_at, updated_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    // For each collection, fetch first 4 images and generate signed URLs
    const result = await Promise.all(
      (collections ?? []).map(async (col) => {
        const { data: images } = await sb
          .from("collection_images")
          .select("storage_path")
          .eq("collection_id", col.id)
          .order("created_at", { ascending: false })
          .limit(4);

        const previewImages: string[] = [];
        if (images && images.length > 0) {
          const paths = images.map((img) => img.storage_path);
          for (const path of paths) {
            const { data: signed } = await sb.storage
              .from("slideshow-images")
              .createSignedUrl(path, 3600);
            if (signed?.signedUrl) {
              previewImages.push(signed.signedUrl);
            }
          }
        }

        return {
          id: col.id,
          name: col.name,
          description: col.description,
          image_count: col.image_count,
          created_at: col.created_at,
          preview_images: previewImages,
        };
      }),
    );

    return json({ data: result }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("list-image-collections error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
