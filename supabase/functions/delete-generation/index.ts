import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const userId = await requireUserId(req);
    const body = await req.json() as { id: string };

    if (!body?.id) return json({ detail: "Missing generation id" }, cors, 400);

    const sb = getAdminClient();
    const { error } = await sb
      .from("generations")
      .delete()
      .eq("id", body.id)
      .eq("owner_id", userId);

    if (error) throw new Error(error.message);
    return json({ success: true }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("delete-generation error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
