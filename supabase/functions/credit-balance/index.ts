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
    const sb = getAdminClient();

    // Fetch credit balance (maybeSingle in case row doesn't exist yet)
    const { data: balance } = await sb
      .from("credit_balances")
      .select("remaining")
      .eq("owner_id", userId)
      .maybeSingle();

    // Fetch profile plan
    const { data: profile } = await sb
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .single();

    return json({
      data: {
        remaining: balance?.remaining ?? 0,
        plan: profile?.plan ?? "free",
      },
    }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("credit-balance error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
