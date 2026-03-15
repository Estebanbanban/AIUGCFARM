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
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "12", 10)));
    const status = url.searchParams.get("status") ?? "all";

    const sb = getAdminClient();
    const offset = (page - 1) * limit;

    // Build query
    let query = sb
      .from("slideshows")
      .select("*", { count: "exact" })
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data: slideshows, error, count } = await query;

    if (error) throw new Error(error.message);

    // For each slideshow, build a public R2 thumbnail URL from the first slide's image
    const result = await Promise.all(
      (slideshows ?? []).map(async (ss) => {
        let thumbnailUrl: string | null = null;
        const slides = Array.isArray(ss.slides) ? ss.slides : [];

        // Find the first slide with an imageId
        const firstSlideWithImage = slides.find(
          (s: Record<string, unknown>) => s.imageId && typeof s.imageId === "string",
        );

        if (firstSlideWithImage) {
          const { data: img } = await sb
            .from("collection_images")
            .select("storage_path")
            .eq("id", (firstSlideWithImage as Record<string, string>).imageId)
            .maybeSingle();

          if (img?.storage_path) {
            thumbnailUrl = r2PublicUrl(img.storage_path);
          }
        }

        return { ...ss, thumbnailUrl };
      }),
    );

    return json({
      data: {
        slideshows: result,
        total: count ?? 0,
        page,
      },
    }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("list-slideshows error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
