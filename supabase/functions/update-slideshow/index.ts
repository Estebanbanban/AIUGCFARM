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
    const { id, name, settings, slides, status, hook_text } = await req.json();

    if (!id || typeof id !== "string") {
      return json({ detail: "Missing slideshow id" }, cors, 400);
    }

    const sb = getAdminClient();

    // Verify slideshow belongs to user
    const { data: existing, error: fetchErr } = await sb
      .from("slideshows")
      .select("id")
      .eq("id", id)
      .eq("owner_id", userId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing) {
      return json({ detail: "Slideshow not found" }, cors, 404);
    }

    // Build update payload with only provided fields
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (settings !== undefined) updates.settings = settings;
    if (slides !== undefined) updates.slides = slides;
    if (status !== undefined) updates.status = status;
    if (hook_text !== undefined) updates.hook_text = hook_text;

    const { data: slideshow, error: updateErr } = await sb
      .from("slideshows")
      .update(updates)
      .eq("id", id)
      .eq("owner_id", userId)
      .select("*")
      .single();

    if (updateErr) throw new Error(updateErr.message);

    return json({ data: slideshow }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("update-slideshow error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
