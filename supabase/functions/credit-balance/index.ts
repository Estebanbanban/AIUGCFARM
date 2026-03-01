import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { ADMIN_UNLIMITED_CREDITS } from "../_shared/credits.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "GET") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const [{ data: balance }, { data: profile }] = await Promise.all([
      sb
        .from("credit_balances")
        .select("remaining")
        .eq("owner_id", userId)
        .maybeSingle(),
      sb
        .from("profiles")
        .select("plan, role")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const isUnlimited = profile?.role === "admin";

    return json({
      data: {
        remaining: isUnlimited
          ? ADMIN_UNLIMITED_CREDITS
          : (balance?.remaining ?? 0),
        plan: profile?.plan ?? "free",
        is_unlimited: isUnlimited,
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
