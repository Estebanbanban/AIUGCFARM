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

    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const { data } = await sb
      .from("persona_monthly_limits")
      .select("personas_created, month_year")
      .eq("owner_id", userId)
      .eq("month_year", monthYear)
      .maybeSingle();

    return json({ data: data ?? null }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("get-persona-monthly-usage error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
