import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const DEFAULT_SETTINGS = {
  aspectRatio: "9:16",
  slideDuration: 2,
  resolution: { width: 1080, height: 1920 },
  overlay: { enabled: true, opacity: 0.25, color: "#000000" },
  text: {
    position: "top-third",
    color: "#FFFFFF",
    case: "lowercase",
    fontFamily: "Inter",
    fontSize: 48,
    fontWeight: 700,
    textShadow: true,
  },
  captionStyle: "tiktok",
  showPill: true,
};

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const { name, product_id, settings, slides } = await req.json();

    const sb = getAdminClient();

    const { data: slideshow, error } = await sb
      .from("slideshows")
      .insert({
        owner_id: userId,
        name: name ?? "Untitled Slideshow",
        product_id: product_id ?? null,
        settings: settings ?? DEFAULT_SETTINGS,
        slides: slides ?? [],
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return json({ data: slideshow }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("create-slideshow error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
