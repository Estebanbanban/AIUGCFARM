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

    // Check monthly persona creation limit
    const now = new Date();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const PERSONAS_PER_MONTH_LIMITS: Record<string, number> = {
      free: 1,
      starter: 2,
      growth: 10,
      scale: 100,
    };

    const { data: profileData } = await sb
      .from("profiles")
      .select("plan, role")
      .eq("id", userId)
      .maybeSingle();

    const plan = (profileData?.plan as string) ?? "free";
    const isAdmin = profileData?.role === "admin";

    if (!isAdmin) {
      const monthLimit = PERSONAS_PER_MONTH_LIMITS[plan] ?? 1;
      const { data: monthRow } = await sb
        .from("persona_monthly_limits")
        .select("personas_created")
        .eq("owner_id", userId)
        .eq("month_year", monthYear)
        .maybeSingle();

      const used = monthRow?.personas_created ?? 0;
      if (used >= monthLimit) {
        return json(
          { detail: `Monthly persona limit reached (${monthLimit}) for your ${plan} plan. Resets next month.` },
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

    // generated_images stores storage paths  -  select the path
    const selectedPath = images[image_index];

    // Store the storage PATH as selected_image_url (not a signed URL)
    const { error: updateErr } = await sb
      .from("personas")
      .update({ selected_image_url: selectedPath })
      .eq("id", persona_id)
      .eq("owner_id", userId);

    if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);

    // Increment monthly persona usage
    const { error: insertErr } = await sb
      .from("persona_monthly_limits")
      .insert({ owner_id: userId, month_year: monthYear, personas_created: 1 })
      .select();

    if (insertErr && insertErr.code === "23505") {
      // Unique constraint violation - row exists, increment it
      const { data: cur } = await sb
        .from("persona_monthly_limits")
        .select("id, personas_created")
        .eq("owner_id", userId)
        .eq("month_year", monthYear)
        .single();
      if (cur) {
        await sb
          .from("persona_monthly_limits")
          .update({ personas_created: cur.personas_created + 1 })
          .eq("id", cur.id);
      }
    }

    // Generate a fresh signed URL for the frontend to display immediately
    const { data: signedData } = await sb.storage
      .from("persona-images")
      .createSignedUrl(selectedPath, 3600); // 1 hour

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
