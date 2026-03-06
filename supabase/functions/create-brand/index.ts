import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const BRAND_LIMITS: Record<string, number> = {
  free: 1,
  starter: 1,
  growth: 3,
  scale: Infinity,
};

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const { name, store_url } = await req.json();
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return json({ detail: "name is required" }, cors, 400);
    }

    // Fetch plan
    const { data: profile } = await sb
      .from("profiles")
      .select("plan, role")
      .eq("id", userId)
      .maybeSingle();

    const plan = (profile?.plan as string) ?? "free";
    const isAdmin = profile?.role === "admin";

    if (!isAdmin) {
      const limit = BRAND_LIMITS[plan] ?? 1;
      if (limit !== Infinity) {
        const { count } = await sb
          .from("brands")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId);

        if ((count ?? 0) >= limit) {
          return json(
            { detail: `Brand limit reached (${limit}) for your ${plan} plan. Upgrade to add more brands.` },
            cors,
            403,
          );
        }
      }
    }

    const { data: brand, error } = await sb
      .from("brands")
      .insert({ owner_id: userId, name: name.trim(), store_url: store_url ?? null })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return json({ data: brand }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Authentication required" }, cors, 401);
    console.error("create-brand error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
