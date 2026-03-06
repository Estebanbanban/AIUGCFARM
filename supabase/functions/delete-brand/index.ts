import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const { brand_id } = await req.json();
    if (!brand_id || typeof brand_id !== "string") {
      return json({ detail: "brand_id is required" }, cors, 400);
    }

    // Verify ownership
    const { data: existing } = await sb
      .from("brands")
      .select("id, owner_id")
      .eq("id", brand_id)
      .maybeSingle();

    if (!existing || existing.owner_id !== userId) {
      return json({ detail: "Brand not found" }, cors, 404);
    }

    const { error } = await sb
      .from("brands")
      .delete()
      .eq("id", brand_id)
      .eq("owner_id", userId);

    if (error) throw new Error(error.message);

    return json({ data: { deleted: true } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Authentication required" }, cors, 401);
    console.error("delete-brand error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
