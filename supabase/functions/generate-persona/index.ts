import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { withRetry } from "../_shared/retry.ts";

const NANOBANANA_API_KEY = Deno.env.get("NANOBANANA_API_KEY")!;
const NANOBANANA_BASE_URL =
  Deno.env.get("NANOBANANA_BASE_URL") || "https://api.nanobanana.com/v1";

const PERSONA_LIMITS: Record<string, number> = {
  free: 0,
  starter: 1,
  growth: 3,
  scale: 10,
};

/* ------------------------------------------------------------------ */
/*  Attribute validation                                              */
/* ------------------------------------------------------------------ */

const VALID_GENDERS = new Set(["male", "female", "non_binary"]);
const VALID_AGE_RANGES = new Set(["18_25", "25_35", "35_45", "45_55", "55_plus"]);
const VALID_BODY_TYPES = new Set(["slim", "average", "athletic", "curvy", "plus_size"]);

const REQUIRED_ATTRIBUTE_KEYS = [
  "gender",
  "skin_tone",
  "age",
  "hair_color",
  "hair_style",
  "eye_color",
  "body_type",
  "clothing_style",
  "accessories",
] as const;

interface PersonaAttributes {
  gender: string;
  skin_tone: string;
  age: string;
  hair_color: string;
  hair_style: string;
  eye_color: string;
  body_type: string;
  clothing_style: string;
  accessories: string[];
}

/**
 * Validate the incoming attributes object. Returns a user-friendly error
 * message if validation fails, or `null` when the input is valid.
 */
function validateAttributes(
  attrs: Record<string, unknown>,
): string | null {
  const missing = REQUIRED_ATTRIBUTE_KEYS.filter(
    (key) => attrs[key] === undefined || attrs[key] === null,
  );
  if (missing.length > 0) {
    return `Missing required attributes: ${missing.join(", ")}`;
  }

  if (!VALID_GENDERS.has(attrs.gender as string)) {
    return `Invalid gender. Expected one of: ${[...VALID_GENDERS].join(", ")}`;
  }
  if (!VALID_AGE_RANGES.has(attrs.age as string)) {
    return `Invalid age range. Expected one of: ${[...VALID_AGE_RANGES].join(", ")}`;
  }
  if (!VALID_BODY_TYPES.has(attrs.body_type as string)) {
    return `Invalid body type. Expected one of: ${[...VALID_BODY_TYPES].join(", ")}`;
  }

  if (typeof attrs.skin_tone !== "string" || !attrs.skin_tone) {
    return "skin_tone must be a non-empty string";
  }
  if (typeof attrs.hair_color !== "string" || !attrs.hair_color) {
    return "hair_color must be a non-empty string";
  }
  if (typeof attrs.hair_style !== "string" || !attrs.hair_style) {
    return "hair_style must be a non-empty string";
  }
  if (typeof attrs.eye_color !== "string" || !attrs.eye_color) {
    return "eye_color must be a non-empty string";
  }
  if (typeof attrs.clothing_style !== "string" || !attrs.clothing_style) {
    return "clothing_style must be a non-empty string";
  }
  if (!Array.isArray(attrs.accessories)) {
    return "accessories must be an array of strings";
  }
  if (attrs.accessories.length > 5) {
    return "accessories can contain at most 5 items";
  }
  for (const item of attrs.accessories) {
    if (typeof item !== "string") {
      return "Each accessory must be a string";
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Prompt building                                                   */
/* ------------------------------------------------------------------ */

const AGE_LABEL: Record<string, string> = {
  "18_25": "18-25 years old",
  "25_35": "25-35 years old",
  "35_45": "35-45 years old",
  "45_55": "45-55 years old",
  "55_plus": "55+ years old",
};

const GENDER_LABEL: Record<string, string> = {
  male: "male",
  female: "female",
  non_binary: "non-binary",
};

const BODY_TYPE_LABEL: Record<string, string> = {
  slim: "slim build",
  average: "average build",
  athletic: "athletic build",
  curvy: "curvy build",
  plus_size: "plus-size build",
};

/** Map hex skin-tone color to a descriptive label for the image prompt. */
function hexToSkinToneLabel(hex: string): string {
  const map: Record<string, string> = {
    "#FDDBB4": "very light",
    "#F1C27D": "light",
    "#E0AC69": "medium-light",
    "#C68642": "medium",
    "#8D5524": "medium-dark",
    "#5C3A1E": "dark",
  };
  return map[hex.toUpperCase()] ?? "natural";
}

/**
 * Build a rich, descriptive prompt from validated persona attributes.
 * Produces a UGC-style portrait suitable for video ad generation.
 */
function buildPrompt(attributes: PersonaAttributes): string {
  const parts: string[] = [
    "Professional UGC creator portrait photo, looking directly at camera",
  ];

  // Demographics
  const genderLabel = GENDER_LABEL[attributes.gender] ?? attributes.gender;
  const ageLabel = AGE_LABEL[attributes.age] ?? attributes.age;
  parts.push(`${genderLabel} person`);
  parts.push(ageLabel);

  // Body type
  const bodyLabel = BODY_TYPE_LABEL[attributes.body_type] ?? attributes.body_type;
  parts.push(bodyLabel);

  // Hair
  parts.push(`${attributes.hair_color} ${attributes.hair_style.toLowerCase()} hair`);

  // Eyes
  parts.push(`${attributes.eye_color.toLowerCase()} eyes`);

  // Skin tone — map hex to descriptive label
  const skinToneLabel = hexToSkinToneLabel(attributes.skin_tone);
  parts.push(`${skinToneLabel} skin tone`);

  // Clothing
  parts.push(`wearing ${attributes.clothing_style.toLowerCase()} clothing`);

  // Accessories
  const realAccessories = attributes.accessories.filter(
    (a) => a.toLowerCase() !== "none",
  );
  if (realAccessories.length > 0) {
    parts.push(`with ${realAccessories.join(", ").toLowerCase()}`);
  }

  // Quality / style directives
  parts.push(
    "natural lighting, high quality, realistic, 4K, upper body shot, neutral background, social media style",
  );

  return parts.join(", ");
}

/* ------------------------------------------------------------------ */
/*  NanoBanana API                                                    */
/* ------------------------------------------------------------------ */

/** Call NanoBanana API to generate persona images (with retry). */
async function generateImages(prompt: string): Promise<string[]> {
  return withRetry(async () => {
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
      const errText = await res.text();
      throw new Error(`NanoBanana image generation failed (${res.status}): ${errText}`);
    }

    const body = await res.json();
    // Expected response: { images: [{ url: "..." }, ...] }
    const urls = (body.images ?? []).map((img: { url: string }) => img.url);
    if (urls.length === 0) {
      throw new Error("NanoBanana returned no images");
    }
    return urls;
  }, 3, 500);
}

/* ------------------------------------------------------------------ */
/*  Edge Function handler                                             */
/* ------------------------------------------------------------------ */

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const { name, attributes, persona_id } = await req.json();

    if (!name || typeof name !== "string") {
      return json({ detail: "name is required" }, cors, 400);
    }
    if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
      return json({ detail: "attributes object is required" }, cors, 400);
    }

    // Validate attributes
    const validationError = validateAttributes(attributes as Record<string, unknown>);
    if (validationError) {
      return json({ detail: validationError }, cors, 400);
    }

    const validAttrs = attributes as PersonaAttributes;
    const isRegeneration = typeof persona_id === "string" && persona_id.length > 0;

    // If regenerating, verify the persona exists and belongs to the user
    if (isRegeneration) {
      const { data: existing } = await sb
        .from("personas")
        .select("id, owner_id")
        .eq("id", persona_id)
        .single();
      if (!existing || existing.owner_id !== userId) {
        return json({ detail: "Persona not found" }, cors, 404);
      }
    }

    // Check plan persona limits (skip for regeneration — not creating a new slot)
    if (!isRegeneration) {
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
    }

    // Generate images via NanoBanana (with retry)
    const prompt = buildPrompt(validAttrs);
    const imageUrls = await generateImages(prompt);

    // Upload generated images to persona-images bucket (private)
    const storagePaths: string[] = [];
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

      storagePaths.push(storagePath);
    }

    if (storagePaths.length === 0) {
      throw new Error("All image uploads failed");
    }

    // Generate signed URLs for the immediate response
    const signedUrls: string[] = [];
    for (const path of storagePaths) {
      const { data } = await sb.storage
        .from("persona-images")
        .createSignedUrl(path, 3600); // 1 hour
      if (data?.signedUrl) {
        signedUrls.push(data.signedUrl);
      }
    }

    // Save persona record — UPDATE on regeneration, INSERT on new creation
    let persona;
    if (isRegeneration) {
      const { data, error } = await sb
        .from("personas")
        .update({
          name,
          attributes,
          generated_images: storagePaths,
          selected_image_url: null, // reset selection on regeneration
        })
        .eq("id", persona_id)
        .eq("owner_id", userId)
        .select("id, name, attributes, generated_images, selected_image_url")
        .single();
      if (error) throw new Error(`DB update failed: ${error.message}`);
      persona = data;
    } else {
      const { data, error } = await sb
        .from("personas")
        .insert({
          owner_id: userId,
          name,
          attributes,
          generated_images: storagePaths,
          selected_image_url: null,
          is_active: true,
        })
        .select("id, name, attributes, generated_images, selected_image_url")
        .single();
      if (error) throw new Error(`DB insert failed: ${error.message}`);
      persona = data;
    }

    // Return signed URLs to the frontend for immediate display
    return json(
      {
        data: {
          ...persona,
          generated_image_urls: signedUrls,
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
    console.error("generate-persona error:", e);
    return json({ detail: "Failed to generate persona. Please try again." }, cors, 500);
  }
});
