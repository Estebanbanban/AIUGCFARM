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
    const { id } = await req.json();

    if (!id || typeof id !== "string") {
      return json({ detail: "Missing hook id" }, cors, 400);
    }

    const sb = getAdminClient();

    // Verify hook belongs to user
    const { data: hook, error: fetchErr } = await sb
      .from("slideshow_hooks")
      .select("id")
      .eq("id", id)
      .eq("owner_id", userId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!hook) {
      return json({ detail: "Hook not found" }, cors, 404);
    }

    const { error: deleteErr } = await sb
      .from("slideshow_hooks")
      .delete()
      .eq("id", id)
      .eq("owner_id", userId);

    if (deleteErr) throw new Error(deleteErr.message);

    return json({ data: { success: true } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("delete-slideshow-hook error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
