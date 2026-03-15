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
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return json({ detail: "Missing slideshow id" }, cors, 400);
    }

    const sb = getAdminClient();

    const { data: slideshow, error } = await sb
      .from("slideshows")
      .select("*")
      .eq("id", id)
      .eq("owner_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!slideshow) {
      return json({ detail: "Slideshow not found" }, cors, 404);
    }

    // For each slide that has an imageId, generate a signed URL
    const slides = Array.isArray(slideshow.slides) ? slideshow.slides : [];
    const enrichedSlides = await Promise.all(
      slides.map(async (slide: Record<string, unknown>) => {
        if (!slide.imageId || typeof slide.imageId !== "string") return slide;

        // Look up the collection_images row to get the storage_path
        const { data: img } = await sb
          .from("collection_images")
          .select("storage_path")
          .eq("id", slide.imageId)
          .maybeSingle();

        if (!img?.storage_path) return slide;

        const { data: signed } = await sb.storage
          .from("slideshow-images")
          .createSignedUrl(img.storage_path, 3600);

        return {
          ...slide,
          imageUrl: signed?.signedUrl ?? null,
        };
      }),
    );

    return json({ data: { ...slideshow, slides: enrichedSlides } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("get-slideshow error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
