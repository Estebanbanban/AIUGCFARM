import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { withRetry } from "../_shared/retry.ts";
import { callOpenRouter } from "../_shared/openrouter.ts";

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
 * Fallback: build a basic attribute-list prompt when OpenRouter is unavailable.
 */
function buildFallbackPrompt(attributes: PersonaAttributes): string {
  const genderLabel = GENDER_LABEL[attributes.gender] ?? attributes.gender;
  const ageLabel = AGE_LABEL[attributes.age] ?? attributes.age;
  const bodyLabel = BODY_TYPE_LABEL[attributes.body_type] ?? attributes.body_type;
  const skinToneLabel = hexToSkinToneLabel(attributes.skin_tone);
  const realAccessories = attributes.accessories.filter(
    (a) => a.toLowerCase() !== "none",
  );

  const parts = [
    "Casual iPhone front-camera selfie vlog, talking to camera, UGC creator style",
    `${genderLabel} person`,
    ageLabel,
    bodyLabel,
    `${attributes.hair_color} ${attributes.hair_style.toLowerCase()} hair`,
    `${attributes.eye_color.toLowerCase()} eyes`,
    `${skinToneLabel} skin tone`,
    `wearing ${attributes.clothing_style.toLowerCase()} clothing`,
    ...(realAccessories.length > 0 ? [`with ${realAccessories.join(", ").toLowerCase()}`] : []),
    "natural window light, authentic imperfections, realistic, 4K, upper body shot",
  ];

  return parts.join(", ");
}

/* ------------------------------------------------------------------ */
/*  Scene prompt generation via OpenRouter                            */
/* ------------------------------------------------------------------ */

const SCENE_PROMPT_SYSTEM = `You are an expert AI image prompt writer specializing in authentic UGC (user-generated content) style photography for social media ads.

Given a persona's physical attributes, write a single image generation prompt that creates a realistic "talking-to-camera" selfie scene for use with an AI image generator.

The prompt must:
- Describe a casual handheld iPhone front-camera selfie vlog aesthetic
- Set a believable background/setting that fits the persona's demographic and clothing style
- Weave the person's appearance naturally into the scene (do NOT list traits as bullet points)
- Include authentic imperfections: slight hand shake, imperfect framing, natural lighting variance
- Feel like a real person filming a quick social media update, NOT a professional shoot
- Be 3–5 sentences, vivid and specific

Scene rules:
- Camera: arm's-length iPhone front camera, slight wide-angle distortion
- Lighting: natural window light or soft warm indoor light
- Background: hints at personality (modern apartment, cozy café, outdoors, home office) — match the clothing style
- Expression: candid "talking to camera", warm approachable energy
- Props: 1–2 natural props max (coffee cup, phone, earbuds, etc.)

Example of a great output:
"A casual handheld iPhone front-camera selfie vlog. A young woman sits at a tidy desk, filming herself at arm's length (slight wide-angle distortion), natural window light, small imperfections like tiny hand shake and imperfect framing. Modern NYC penthouse apartment vibe in the background (clean lines, big windows, soft daylight, skyline hints), minimal makeup, relaxed hair, comfy-but-stylish outfit. Realistic, candid, 'talking to camera' expression, warm approachable energy — looks like a real creator filming a quick update, not a professional shoot. Coffee cup in hand."

Return ONLY the prompt text. No explanation, no surrounding quotes, no prefix.`;

/**
 * Build a human-readable attribute summary to feed into OpenRouter.
 */
function buildAttributeSummary(attributes: PersonaAttributes): string {
  const skinLabel = hexToSkinToneLabel(attributes.skin_tone);
  const realAccessories = attributes.accessories.filter(
    (a) => a.toLowerCase() !== "none",
  );
  return [
    `Gender: ${GENDER_LABEL[attributes.gender] ?? attributes.gender}`,
    `Age: ${AGE_LABEL[attributes.age] ?? attributes.age}`,
    `Skin tone: ${skinLabel}`,
    `Hair: ${attributes.hair_color} ${attributes.hair_style}`,
    `Eyes: ${attributes.eye_color}`,
    `Body type: ${BODY_TYPE_LABEL[attributes.body_type] ?? attributes.body_type}`,
    `Clothing style: ${attributes.clothing_style}`,
    realAccessories.length > 0 ? `Accessories: ${realAccessories.join(", ")}` : null,
  ].filter(Boolean).join("\n");
}

/**
 * Use OpenRouter to generate a rich UGC scene prompt from persona attributes.
 * Falls back to buildFallbackPrompt() if the LLM call fails.
 */
async function generateScenePrompt(
  attributes: PersonaAttributes,
): Promise<{ prompt: string; generated: boolean }> {
  try {
    const summary = buildAttributeSummary(attributes);
    const prompt = await callOpenRouter(
      [
        { role: "system", content: SCENE_PROMPT_SYSTEM },
        { role: "user", content: `Generate a UGC selfie scene prompt for this persona:\n\n${summary}` },
      ],
      { maxTokens: 300, timeoutMs: 20000 },
    );
    // Strip any accidental surrounding quotes the model might add
    return { prompt: prompt.trim().replace(/^["']|["']$/g, ""), generated: true };
  } catch (err) {
    console.error("Scene prompt generation failed, using fallback:", err);
    return { prompt: buildFallbackPrompt(attributes), generated: false };
  }
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

    // Generate rich UGC scene prompt via OpenRouter (falls back to basic descriptor)
    const { prompt, generated: promptGenerated } = await generateScenePrompt(validAttrs);
    console.log(`Scene prompt (${promptGenerated ? "LLM" : "fallback"}):`, prompt);

    // Generate images via NanoBanana (with retry)
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

    // Persist scene_prompt alongside attributes so generate-video can reuse it
    const attributesToSave = { ...validAttrs, scene_prompt: prompt };

    // Save persona record — UPDATE on regeneration, INSERT on new creation
    let persona;
    if (isRegeneration) {
      const { data, error } = await sb
        .from("personas")
        .update({
          name,
          attributes: attributesToSave,
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
          attributes: attributesToSave,
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
