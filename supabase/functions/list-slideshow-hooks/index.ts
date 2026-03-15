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
    const productId = url.searchParams.get("product_id");
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));

    const sb = getAdminClient();

    let query = sb
      .from("slideshow_hooks")
      .select("id, text, product_id, niche, is_used, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (productId) {
      query = query.eq("product_id", productId);
    }

    const { data: hooks, error } = await query;

    if (error) throw new Error(error.message);

    return json({ data: { hooks: hooks ?? [] } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("list-slideshow-hooks error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
