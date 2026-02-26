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

    const { persona_id, image_index } = await req.json();

    if (!persona_id || typeof persona_id !== "string") {
      return json({ detail: "persona_id is required" }, cors, 400);
    }
    if (typeof image_index !== "number" || image_index < 0) {
      return json({ detail: "image_index must be a non-negative number" }, cors, 400);
    }

    // Fetch persona and verify ownership
    const { data: persona, error: fetchErr } = await sb
      .from("personas")
      .select("id, owner_id, generated_images")
      .eq("id", persona_id)
      .single();

    if (fetchErr || !persona) {
      return json({ detail: "Persona not found" }, cors, 404);
    }
    if (persona.owner_id !== userId) {
      return json({ detail: "Persona not found" }, cors, 404);
    }

    const images = persona.generated_images as string[];
    if (!images || image_index >= images.length) {
      return json(
        { detail: `Invalid image_index. Available: 0-${(images?.length ?? 1) - 1}` },
        cors,
        400,
      );
    }

    const selectedUrl = images[image_index];

    const { error: updateErr } = await sb
      .from("personas")
      .update({ selected_image_url: selectedUrl })
      .eq("id", persona_id)
      .eq("owner_id", userId);

    if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);

    return json({
      data: { persona_id, selected_image_url: selectedUrl },
    }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("select-persona-image error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
