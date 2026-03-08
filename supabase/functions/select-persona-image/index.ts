import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

// Monthly creation limit: how many new personas a user can create per month.
const PERSONAS_PER_MONTH_LIMITS: Record<string, number> = {
  free: 1,
  starter: 2,
  growth: 10,
  scale: 100,
};

// Image re-selection limit: how many times a user can CHANGE the selected
// image on an already-created persona (after the first pick).
//   free    → 0  (pick once, cannot change)
//   starter → 5  (reasonable flexibility)
//   growth  → unlimited
//   scale   → unlimited
const PERSONA_IMAGE_CHANGE_LIMITS: Record<string, number> = {
  free: 0,
  starter: 5,
  growth: Infinity,
  scale: Infinity,
};

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

    // Fetch persona and verify ownership. Include image_selection_count + selected_image_url.
    const { data: persona, error: fetchErr } = await sb
      .from("personas")
      .select("id, owner_id, generated_images, selected_image_url, image_selection_count")
      .eq("id", persona_id)
      .single();

    if (fetchErr || !persona) {
      return json({ detail: "Persona not found" }, cors, 404);
    }
    if (persona.owner_id !== userId) {
      return json({ detail: "Persona not found" }, cors, 404);
    }

    // Fetch plan once — used for both limits below.
    const { data: profileData } = await sb
      .from("profiles")
      .select("plan, role")
      .eq("id", userId)
      .maybeSingle();

    const plan = (profileData?.plan as string) ?? "free";
    const isAdmin = profileData?.role === "admin";

    const isFirstSelection = !persona.selected_image_url;
    const selectionCount = (persona.image_selection_count as number) ?? 0;

    if (!isAdmin && !isFirstSelection) {
      // ── Per-persona image change limit (re-selections only) ─────────────
      // Monthly quota is enforced at persona creation time in generate-persona,
      // not here, so we only gate re-selections.
      const changeLimit = PERSONA_IMAGE_CHANGE_LIMITS[plan] ?? 0;
      if (changeLimit !== Infinity && selectionCount >= changeLimit) {
        return json(
          {
            detail: changeLimit === 0
              ? `Free plan personas cannot have their image changed after the initial selection. Upgrade to change persona images.`
              : `Image change limit reached (${changeLimit}) for this persona on your ${plan} plan.`,
          },
          cors,
          403,
        );
      }
    }

    const images = persona.generated_images as string[];
    if (!images || image_index >= images.length) {
      return json(
        { detail: `Invalid image_index. Available: 0-${(images?.length ?? 1) - 1}` },
        cors,
        400,
      );
    }

    const selectedPath = images[image_index];

    // Update selected image + increment selection counter atomically.
    const { error: updateErr } = await sb
      .from("personas")
      .update({
        selected_image_url: selectedPath,
        image_selection_count: selectionCount + 1,
      })
      .eq("id", persona_id)
      .eq("owner_id", userId);

    if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);

    // Return a fresh signed URL for immediate display.
    const { data: signedData } = await sb.storage
      .from("persona-images")
      .createSignedUrl(selectedPath, 3600);

    return json(
      {
        data: {
          persona_id,
          selected_image_url: selectedPath,
          signed_url: signedData?.signedUrl ?? null,
        },
      },
      cors,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("select-persona-image error:", e);
    return json({ detail: "Failed to select persona image. Please try again." }, cors, 500);
  }
});
