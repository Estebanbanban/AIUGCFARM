import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Slot limits: how many active personas (with images) a user can have
const PERSONA_LIMITS: Record<string, number> = {
  free: 1,
  starter: 1,
  growth: 3,
  scale: 10,
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

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return json(
        { detail: "Content-Type must be multipart/form-data" },
        cors,
        400,
      );
    }

    const formData = await req.formData();

    const name = formData.get("name");
    if (!name || typeof name !== "string") {
      return json({ detail: "name is required" }, cors, 400);
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return json({ detail: "file is required" }, cors, 400);
    }

    // Validate file type and size
    if (!ALLOWED_TYPES.has(file.type)) {
      return json(
        { detail: `Invalid file type: ${file.type}. Allowed: image/jpeg, image/png, image/webp` },
        cors,
        400,
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return json(
        { detail: `File exceeds maximum size of 5MB` },
        cors,
        400,
      );
    }

    const personaIdRaw = formData.get("persona_id");
    const existingPersonaId = typeof personaIdRaw === "string" && personaIdRaw ? personaIdRaw : null;

    // Fetch profile for plan + admin check
    const { data: profileRow } = await sb
      .from("profiles")
      .select("plan, role")
      .eq("id", userId)
      .maybeSingle();

    const plan = (profileRow?.plan as string) ?? "free";
    const isAdmin = profileRow?.role === "admin";

    // If creating a new persona, check slot limit
    if (!existingPersonaId && !isAdmin) {
      const maxPersonas = PERSONA_LIMITS[plan] ?? 1;
      const { count: currentCount } = await sb
        .from("personas")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .eq("is_active", true)
        .neq("generated_images", "[]");

      if ((currentCount ?? 0) >= maxPersonas) {
        return json(
          {
            detail: plan === "free"
              ? "You can create 1 persona on the free plan. Upgrade to add more."
              : `Your ${plan} plan allows up to ${maxPersonas} persona(s). Upgrade to add more.`,
          },
          cors,
          403,
        );
      }
    }

    // If updating an existing persona, verify ownership
    if (existingPersonaId) {
      const { data: existing } = await sb
        .from("personas")
        .select("id, owner_id")
        .eq("id", existingPersonaId)
        .maybeSingle();

      if (!existing || existing.owner_id !== userId) {
        return json({ detail: "Persona not found" }, cors, 404);
      }
    }

    // Upload image to persona-images bucket
    const ext = file.name.split(".").pop() || "jpg";
    const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await sb.storage
      .from("persona-images")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("Persona image upload failed:", uploadErr.message);
      return json({ detail: "Image upload failed. Please try again." }, cors, 500);
    }

    let personaId: string;
    let generatedImages: string[];

    if (existingPersonaId) {
      // Append to existing persona's generated_images
      const { data: existing } = await sb
        .from("personas")
        .select("generated_images")
        .eq("id", existingPersonaId)
        .single();

      const currentImages: string[] = Array.isArray(existing?.generated_images)
        ? (existing.generated_images as string[])
        : [];
      generatedImages = [...currentImages, storagePath];

      const { error: updateErr } = await sb
        .from("personas")
        .update({ generated_images: generatedImages })
        .eq("id", existingPersonaId)
        .eq("owner_id", userId);

      if (updateErr) throw new Error(updateErr.message);
      personaId = existingPersonaId;
    } else {
      // Insert new persona record
      // Do NOT upsert persona_monthly_limits — select-persona-image handles that on first selection
      const { data: inserted, error: insertErr } = await sb
        .from("personas")
        .insert({
          owner_id: userId,
          name: name.trim(),
          attributes: { source: "upload" },
          generated_images: [storagePath],
          is_active: true,
          regen_count: 0,
        })
        .select("id, generated_images")
        .single();

      if (insertErr || !inserted) {
        throw new Error(insertErr?.message ?? "Failed to create persona");
      }
      personaId = inserted.id as string;
      generatedImages = inserted.generated_images as string[];
    }

    // Generate signed URL for immediate display
    const { data: signedData } = await sb.storage
      .from("persona-images")
      .createSignedUrl(storagePath, 3600);

    return json(
      {
        data: {
          persona_id: personaId,
          storage_path: storagePath,
          signed_url: signedData?.signedUrl ?? null,
          generated_images: generatedImages,
        },
      },
      cors,
      201,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("upload-persona-image error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
