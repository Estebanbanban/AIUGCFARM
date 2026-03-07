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
    const personaId = url.searchParams.get("persona_id");

    const sb = getAdminClient();
    let query = sb
      .from("generations")
      .select("*, products(name, images), personas(name, selected_image_url)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (personaId) {
      query = query.eq("persona_id", personaId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return json({ data: data ?? [] }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("list-generations error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
