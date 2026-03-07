import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "GET") return json({ detail: "Method not allowed" }, cors, 405);

    const userId = await requireUserId(req);
    const url = new URL(req.url);
    const brandId = url.searchParams.get("brand_id");

    const sb = getAdminClient();
    let query = sb
      .from("products")
      .select("*")
      .eq("owner_id", userId)
      .eq("confirmed", true)
      .order("created_at", { ascending: false });

    if (brandId) {
      query = query.eq("brand_id", brandId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return json({ data: data ?? [] }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("list-products error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
