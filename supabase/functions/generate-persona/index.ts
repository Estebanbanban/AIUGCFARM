import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const NANOBANANA_API_KEY = Deno.env.get("NANOBANANA_API_KEY")!;
const NANOBANANA_BASE_URL =
  Deno.env.get("NANOBANANA_BASE_URL") || "https://api.nanobanana.com/v1";

const PERSONA_LIMITS: Record<string, number> = {
  free: 0,
  starter: 1,
  growth: 3,
  scale: 10,
};

/** Build a portrait generation prompt from persona attributes. */
function buildPrompt(attributes: Record<string, string>): string {
  const parts = [
    "Professional UGC creator portrait photo, looking directly at camera",
  ];
  if (attributes.age) parts.push(`${attributes.age} years old`);
  if (attributes.gender) parts.push(attributes.gender);
  if (attributes.ethnicity) parts.push(attributes.ethnicity);
  if (attributes.style) parts.push(`${attributes.style} style`);
  if (attributes.vibe) parts.push(`${attributes.vibe} vibe`);
  if (attributes.hair) parts.push(`${attributes.hair} hair`);
  parts.push(
    "natural lighting, high quality, realistic, 4K, upper body shot, neutral background",
  );
  return parts.join(", ");
}

/** Call NanoBanana API to generate persona images. */
async function generateImages(prompt: string): Promise<string[]> {
  const res = await fetch(`${NANOBANANA_BASE_URL}/images/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NANOBANANA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      num_images: 4,
      width: 768,
      height: 1024,
      guidance_scale: 7.5,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NanoBanana image generation failed: ${err}`);
  }

  const body = await res.json();
  // Expected response: { images: [{ url: "..." }, ...] }
  return (body.images ?? []).map((img: { url: string }) => img.url);
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const { name, attributes } = await req.json();

    if (!name || typeof name !== "string") {
      return json({ detail: "name is required" }, cors, 400);
    }
    if (!attributes || typeof attributes !== "object") {
      return json({ detail: "attributes object is required" }, cors, 400);
    }

    // Check plan persona limits
    const { data: profile } = await sb
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .single();
    const plan = profile?.plan ?? "free";
    const maxPersonas = PERSONA_LIMITS[plan] ?? 0;

    const { count: currentCount } = await sb
      .from("personas")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("is_active", true);

    if ((currentCount ?? 0) >= maxPersonas) {
      return json(
        {
          detail: `Your ${plan} plan allows up to ${maxPersonas} persona(s). Upgrade to add more.`,
        },
        cors,
        403,
      );
    }

    // Generate images via NanoBanana
    const prompt = buildPrompt(attributes);
    const imageUrls = await generateImages(prompt);

    // Upload generated images to persona-images bucket
    const storedUrls: string[] = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const imageRes = await fetch(imageUrls[i]);
      if (!imageRes.ok) continue;

      const imageBlob = await imageRes.blob();
      const storagePath = `${userId}/${crypto.randomUUID()}.png`;

      const { error: uploadErr } = await sb.storage
        .from("persona-images")
        .upload(storagePath, imageBlob, {
          contentType: "image/png",
          upsert: false,
        });

      if (uploadErr) {
        console.error(`Persona image upload failed: ${uploadErr.message}`);
        continue;
      }

      const {
        data: { publicUrl },
      } = sb.storage.from("persona-images").getPublicUrl(storagePath);
      storedUrls.push(publicUrl);
    }

    if (storedUrls.length === 0) {
      throw new Error("All image uploads failed");
    }

    // Create persona record
    const { data: persona, error: insertErr } = await sb
      .from("personas")
      .insert({
        owner_id: userId,
        name,
        attributes,
        generated_images: storedUrls,
        selected_image_url: null,
        is_active: true,
      })
      .select("id, name, attributes, generated_images, selected_image_url")
      .single();

    if (insertErr) throw new Error(`DB insert failed: ${insertErr.message}`);

    return json({ data: persona }, cors, 201);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("generate-persona error:", e);
    return json({ detail: msg || "Internal error" }, cors, 500);
  }
});
