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
    const sb = getAdminClient();

    const { data, error } = await sb
      .from("brands")
      .select("*, products(count)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    // Flatten product count from Supabase aggregation format
    const brands = (data ?? []).map((b: Record<string, unknown>) => ({
      ...b,
      product_count:
        Array.isArray(b.products) && b.products.length > 0
          ? (b.products as { count: number }[])[0].count
          : 0,
    }));

    return json({ data: brands }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("list-brands error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
