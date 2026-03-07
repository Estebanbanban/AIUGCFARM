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

    const { preset_id } = await req.json();

    if (!preset_id || typeof preset_id !== "string") {
      return json({ detail: "preset_id is required" }, cors, 400);
    }

    const { data: deleted, error } = await sb
      .from("generation_presets")
      .delete()
      .eq("id", preset_id)
      .eq("owner_id", userId)
      .select();

    if (error) throw new Error(error.message);

    if (!deleted || deleted.length === 0) {
      return json({ detail: "Preset not found" }, cors, 404);
    }

    return json({ data: { deleted: true } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Authentication required" }, cors, 401);
    console.error("delete-preset error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
