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
    const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

    const sb = getAdminClient();
    const { data } = await sb
      .from("regeneration_limits")
      .select("regens_used")
      .eq("owner_id", userId)
      .eq("month_year", month)
      .maybeSingle();

    return json({ data: data ?? null }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("get-regen-limit error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
