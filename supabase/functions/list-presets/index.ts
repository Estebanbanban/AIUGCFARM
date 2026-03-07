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

    const { data: presets, error } = await sb
      .from("generation_presets")
      .select("*")
      .eq("owner_id", userId)
      .order("last_used_at", { ascending: false, nullsFirst: false });

    if (error) throw new Error(error.message);

    // Sort by COALESCE(last_used_at, created_at) DESC in JS since Supabase
    // doesn't support COALESCE in .order() directly.
    const sorted = (presets ?? []).sort((a, b) => {
      const aTime = new Date(a.last_used_at ?? a.created_at).getTime();
      const bTime = new Date(b.last_used_at ?? b.created_at).getTime();
      return bTime - aTime;
    });

    return json({ data: sorted }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Authentication required" }, cors, 401);
    console.error("list-presets error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
