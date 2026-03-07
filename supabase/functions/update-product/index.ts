import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST" && req.method !== "PATCH") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const body = await req.json() as Record<string, unknown>;
    const { id, ...fields } = body;

    if (!id || typeof id !== "string") {
      return json({ detail: "Missing product id" }, cors, 400);
    }

    // Only allow safe fields
    const allowed = ["name", "description", "images", "brand_id"] as const;
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in fields) updates[key] = fields[key];
    }

    const sb = getAdminClient();
    const { data, error } = await sb
      .from("products")
      .update(updates)
      .eq("id", id)
      .eq("owner_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return json({ data }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("update-product error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
