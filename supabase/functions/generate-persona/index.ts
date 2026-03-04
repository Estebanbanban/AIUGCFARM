import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { withRetry } from "../_shared/retry.ts";
import { callOpenRouter } from "../_shared/openrouter.ts";
import { generateImagesFromPrompt, type GeneratedImage } from "../_shared/nanobanana.ts";

const PERSONA_LIMITS: Record<string, number> = {
  free: 1,
  starter: 1,
  growth: 3,
  scale: 10,
};

// Free-tier: max regeneration attempts per persona (2 images/call × 5 calls = 10 images)
const FREE_REGEN_LIMIT = 4; // 4 regen calls after initial creation = 10 total images

/* ------------------------------------------------------------------ */
/*  Attribute validation                                              */
/* ------------------------------------------------------------------ */

const VALID_GENDERS = new Set(["male", "female", "non_binary"]);
const VALID_AGE_RANGES = new Set(["18_25", "25_35", "35_45", "45_55", "55_plus"]);
const VALID_BODY_TYPES = new Set(["slim", "average", "athletic", "curvy", "plus_size"]);

const REQUIRED_ATTRIBUTE_KEYS = [
  "gender",
  "age",
  "hair_color",
  "hair_style",
  "eye_color",
  "body_type",
  "clothing_style",
  "accessories",
] as const;
// ethnicity is preferred; skin_tone is the legacy fallback — at least one must be present

interface PersonaAttributes {
  gender: string;
  ethnicity?: string; // preferred — descriptive label like "East Asian", "Black / African"
  skin_tone?: string; // legacy — hex colour (#C68642) or free-text; used when ethnicity absent
  age: string;
  hair_color: string;
  hair_style: string;
  eye_color: string;
  body_type: string;
  clothing_style: string;
  accessories: string[];
}

const FALLBACK_ATTRIBUTES: PersonaAttributes = {
  gender: "female",
  age: "25_35",
  ethnicity: "mixed",
  hair_color: "brown",
  hair_style: "casual straight",
  eye_color: "brown",
  body_type: "average",
  clothing_style: "casual modern",
  accessories: [],
};

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

  // Require either ethnicity (new) or skin_tone (legacy)
  const hasEthnicity = typeof attrs.ethnicity === "string" && !!attrs.ethnicity;
  const hasSkinTone = typeof attrs.skin_tone === "string" && !!attrs.skin_tone;
  if (!hasEthnicity && !hasSkinTone) {
    return "Either ethnicity or skin_tone is required";
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

/**
 * Parse a free-form persona description into structured attributes via OpenRouter.
 */
async function descriptionToAttributes(description: string): Promise<PersonaAttributes> {
  const prompt = `Convert this persona description into a JSON object with EXACTLY these fields. Choose the closest valid value for each field:

{
  "gender": "male" | "female" | "non_binary",
  "age": "18_25" | "25_35" | "35_45" | "45_55" | "55_plus",
  "ethnicity": "<descriptive label: 'East Asian', 'Black / African', 'Hispanic / Latino', 'South Asian', 'White / European', 'Middle Eastern', 'Mixed', etc.>",
  "hair_color": "<color as string>",
  "hair_style": "<style as string>",
  "eye_color": "<color as string>",
  "body_type": "slim" | "average" | "athletic" | "curvy" | "plus_size",
  "clothing_style": "<style description>",
  "accessories": []
}

Description: "${description.replace(/"/g, '\\"')}"

Return ONLY valid JSON, no explanation, no markdown.`;

  const response = await callOpenRouter(
    [{ role: "user", content: prompt }],
    { maxTokens: 400, timeoutMs: 25000 },
  );

  // Strip markdown code blocks if present
  const cleaned = response.trim().replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
  const parsed = JSON.parse(cleaned);

  // Ensure accessories is always an array
  if (!Array.isArray(parsed.accessories)) parsed.accessories = [];

  return parsed as PersonaAttributes;
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
  const ethnicityLabel = resolveEthnicityLabel(attributes);
  const realAccessories = attributes.accessories.filter(
    (a) => a.toLowerCase() !== "none",
  );

  const parts = [
    "Casual iPhone front-camera selfie vlog, talking to camera, UGC creator style",
    `${genderLabel} person of ${ethnicityLabel} ethnicity`,
    ageLabel,
    bodyLabel,
    `${attributes.hair_color} ${attributes.hair_style.toLowerCase()} hair`,
    `${attributes.eye_color.toLowerCase()} eyes`,
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

Given a persona's attributes, write a scene description for an AI image generator. Your job is to describe ONLY the setting, background, lighting, and vibe — NOT the person's appearance. Physical traits are provided separately and will be prepended to your output.

Your scene description must:
- Describe a casual handheld iPhone front-camera selfie vlog aesthetic
- Set a believable background/setting that fits the persona's demographic and clothing style
- Include authentic imperfections: slight hand shake, imperfect framing, natural lighting variance
- Feel like a real person filming a quick social media update, NOT a professional shoot
- Be 2–3 sentences focused purely on scene, setting, and mood

Scene rules:
- Camera: arm's-length iPhone front camera, slight wide-angle distortion
- Lighting: natural window light or soft warm indoor light
- Background: hints at personality (modern apartment, cozy café, outdoors, home office) — match the clothing style
- Expression hint: candid "talking to camera", warm approachable energy
- Props: 1–2 natural props max (coffee cup, phone, earbuds, etc.)

CRITICAL: Do NOT mention hair color, eye color, skin tone, or any specific physical appearance in your output. Those are handled separately.

Example of a great output:
"Casual handheld iPhone front-camera selfie, filming at arm's length with slight wide-angle distortion and natural window light. Modern apartment in the background — clean lines, soft daylight, lived-in feel. Candid talking-to-camera energy, slight hand shake, looks like a real creator filming a quick update."

Return ONLY the scene description. No explanation, no surrounding quotes, no prefix.`;

/** Resolve the best ethnicity/skin description from attributes. */
function resolveEthnicityLabel(attributes: PersonaAttributes): string {
  if (attributes.ethnicity) return attributes.ethnicity;
  if (attributes.skin_tone) return hexToSkinToneLabel(attributes.skin_tone) + " skin tone";
  return "natural skin tone";
}

/**
 * Build a human-readable attribute summary to feed into OpenRouter.
 */
function buildAttributeSummary(attributes: PersonaAttributes): string {
  const ethnicityLabel = resolveEthnicityLabel(attributes);
  const realAccessories = attributes.accessories.filter(
    (a) => a.toLowerCase() !== "none",
  );
  return [
    `Gender: ${GENDER_LABEL[attributes.gender] ?? attributes.gender}`,
    `Age: ${AGE_LABEL[attributes.age] ?? attributes.age}`,
    `Ethnicity: ${ethnicityLabel}`,
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
    const cleaned = prompt.trim().replace(/^["']|["']$/g, "");
    // If LLM returned empty content, fall back
    if (!cleaned) {
      return { prompt: buildFallbackPrompt(attributes), generated: false };
    }
    return { prompt: cleaned, generated: true };
  } catch (err) {
    console.error("Scene prompt generation failed, using fallback:", err);
    return { prompt: buildFallbackPrompt(attributes), generated: false };
  }
}

/**
 * Build the final Gemini image prompt with physical attributes FIRST.
 * Placing mandatory appearance at the top ensures Gemini honours every
 * trait — hair colour, eye colour, skin tone, etc. — before reading the
 * scene description, which only sets background/lighting/vibe.
 */
function buildImagePrompt(attributes: PersonaAttributes, scenePrompt: string): string {
  const genderLabel = GENDER_LABEL[attributes.gender] ?? attributes.gender;
  const ageLabel = AGE_LABEL[attributes.age] ?? attributes.age;
  const bodyLabel = BODY_TYPE_LABEL[attributes.body_type] ?? attributes.body_type;
  const realAccessories = attributes.accessories.filter(
    (a) => a.toLowerCase() !== "none",
  );

  const ethnicityLabel = resolveEthnicityLabel(attributes);

  // Physical appearance block — listed first so Gemini weights it highest.
  const appearanceBlock = [
    `MANDATORY SUBJECT APPEARANCE — render EXACTLY as specified below. Every attribute is NON-NEGOTIABLE. Do NOT substitute, alter, or omit any trait:`,
    `• Gender: ${genderLabel.toUpperCase()}`,
    `• Age: ${ageLabel}`,
    `• Ethnicity: ${ethnicityLabel.toUpperCase()} — REQUIRED, render with correct facial features and skin tone for this ethnicity`,
    `• Body: ${bodyLabel}`,
    `• Hair: ${attributes.hair_color.toUpperCase()} ${attributes.hair_style} hair — this colour is REQUIRED`,
    `• Eyes: ${attributes.eye_color.toUpperCase()} eyes — this colour is REQUIRED`,
    `• Clothing: ${attributes.clothing_style} style`,
    ...(realAccessories.length > 0 ? [`• Accessories: ${realAccessories.join(", ")}`] : []),
  ].join("\n");

  return `${appearanceBlock}\n\nScene / setting (background and lighting only — do NOT change the person's appearance):\n${scenePrompt}`;
}

/* ------------------------------------------------------------------ */
/*  NanoBanana API                                                    */
/* ------------------------------------------------------------------ */

/** Generate persona images via Gemini (NanoBanana 2), single attempt (no retry). */
function generateImages(prompt: string, count = 2): Promise<GeneratedImage[]> {
  return withRetry(() => generateImagesFromPrompt(prompt, count), 1, 0);
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

    const req_body = await req.json();
    const { name, attributes, description, persona_id } = req_body;
    // 0 = init-only (create persona + resolve attributes, no image generation)
    // 1 = generate a single image (used for parallel calls from the frontend)
    // 2 = generate two images sequentially (Visual Builder / legacy)
    const imageCount = typeof req_body.image_count === "number"
      ? Math.min(Math.max(0, req_body.image_count), 2)
      : 2;

    // Description mode: use OpenRouter to parse free-form description into structured attributes
    const t0 = Date.now();
    let resolvedAttributes = attributes;
    if (description && typeof description === "string" && description.trim().length > 0) {
      if (!resolvedAttributes || Object.keys(resolvedAttributes ?? {}).length === 0) {
        try {
          resolvedAttributes = await descriptionToAttributes(description.trim());
          console.log(`[generate-persona] description→attrs: ${Date.now() - t0}ms`);
          // Validate after parsing and fall back if invalid
          const valErr = validateAttributes(resolvedAttributes as Record<string, unknown>);
          if (valErr) {
            console.warn("descriptionToAttributes returned invalid attrs:", valErr, "using fallback");
            resolvedAttributes = { ...FALLBACK_ATTRIBUTES };
          }
        } catch (err) {
          console.error("Failed to parse description, using fallback:", err);
          resolvedAttributes = { ...FALLBACK_ATTRIBUTES };
        }
      }
    }

    if (!name || typeof name !== "string") {
      return json({ detail: "name is required" }, cors, 400);
    }
    if (!resolvedAttributes || typeof resolvedAttributes !== "object" || Array.isArray(resolvedAttributes)) {
      return json({ detail: "Either 'attributes' or 'description' is required" }, cors, 400);
    }

    // Validate attributes — fix missing/invalid fields with fallback values instead of 400
    const validationError = validateAttributes(resolvedAttributes as Record<string, unknown>);
    if (validationError) {
      console.warn("Attribute validation failed:", validationError, "— merging with fallback");
      resolvedAttributes = { ...FALLBACK_ATTRIBUTES, ...resolvedAttributes };
      // Re-validate after merge; if still invalid, use pure fallback
      const revalidationError = validateAttributes(resolvedAttributes as Record<string, unknown>);
      if (revalidationError) {
        console.warn("Re-validation still failed:", revalidationError, "— using pure fallback");
        resolvedAttributes = { ...FALLBACK_ATTRIBUTES };
      }
    }

    const validAttrs = resolvedAttributes as PersonaAttributes;
    const hasPersonaId = typeof persona_id === "string" && persona_id.length > 0;
    const isProgressiveAppend = hasPersonaId && imageCount === 1;
    const isRegeneration = hasPersonaId && !isProgressiveAppend;

    // Fetch profile once — used for slot limit + regen rate limit
    const { data: profile } = await sb
      .from("profiles")
      .select("plan, role")
      .eq("id", userId)
      .single();
    const plan = profile?.plan ?? "free";
    const isAdmin = profile?.role === "admin";

    // If regenerating or appending, verify the persona exists and belongs to the user
    let existingRegenCount = 0;
    let existingGeneratedImages: string[] = [];
    if (hasPersonaId) {
      // Try with regen_count first; fall back to query without it if the column
      // hasn't been added yet (migration 20260228000002 not applied).
      let existing: Record<string, unknown> | null = null;
      const { data: d1, error: e1 } = await sb
        .from("personas")
        .select("id, owner_id, regen_count, generated_images")
        .eq("id", persona_id)
        .single();
      if (e1 && e1.message?.includes("regen_count")) {
        // Column doesn't exist yet — query without it
        console.warn("regen_count column not found, querying without it");
        const { data: d2 } = await sb
          .from("personas")
          .select("id, owner_id, generated_images")
          .eq("id", persona_id)
          .single();
        existing = d2 as Record<string, unknown> | null;
      } else {
        existing = d1 as Record<string, unknown> | null;
      }
      if (!existing || existing.owner_id !== userId) {
        return json({ detail: "Persona not found" }, cors, 404);
      }
      existingRegenCount = (existing.regen_count as number) ?? 0;
      existingGeneratedImages = Array.isArray(existing.generated_images)
        ? (existing.generated_images as string[])
        : [];
      // Free-tier rate limit: cap at FREE_REGEN_LIMIT regenerations per persona
      if (!isAdmin && plan === "free" && existingRegenCount >= FREE_REGEN_LIMIT) {
        return json(
          {
            detail:
              "You've reached the free-tier image limit for this persona. " +
              "Upgrade to regenerate more images.",
          },
          cors,
          429,
        );
      }
    }

    // Check plan persona slots (skip for regeneration/progressive append — not creating a new slot)
    if (!isRegeneration && !isProgressiveAppend) {
      const maxPersonas = PERSONA_LIMITS[plan] ?? 0;

      if (!isAdmin) {
        const { count: currentCount } = await sb
          .from("personas")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId)
          .eq("is_active", true);

        if ((currentCount ?? 0) >= maxPersonas) {
          return json(
            {
              detail:
                plan === "free"
                  ? `You can create 1 persona on the free plan. Upgrade to add more.`
                  : `Your ${plan} plan allows up to ${maxPersonas} persona(s). Upgrade to add more.`,
            },
            cors,
            403,
          );
        }
      }
    }

    // Reuse scene_prompt if already stored in attributes (avoids redundant OpenRouter call on
    // progressive-append and regeneration requests). Only generate when absent.
    const cachedScenePrompt = typeof (validAttrs as Record<string, unknown>).scene_prompt === "string"
      ? (validAttrs as Record<string, unknown>).scene_prompt as string
      : null;

    let scenePrompt: string;
    if (cachedScenePrompt) {
      scenePrompt = cachedScenePrompt;
      console.log(`[generate-persona] scene prompt: reused cached (${Date.now() - t0}ms total)`);
    } else {
      const { prompt, generated } = await generateScenePrompt(validAttrs);
      scenePrompt = prompt;
      console.log(`[generate-persona] scene prompt (${generated ? "LLM" : "fallback"}): ${Date.now() - t0}ms`);
    }

    // Persist scene_prompt alongside attributes so parallel / follow-up calls can reuse it
    const attributesToSave = { ...validAttrs, scene_prompt: scenePrompt };

    // ── Init mode (image_count: 0) ──────────────────────────────────────────
    // Create the persona record with resolved attributes but no images yet.
    // The frontend will then fire parallel image-generation calls using the
    // returned persona_id + attributes.
    if (imageCount === 0 && !hasPersonaId) {
      let initPersona;
      const { data: d1, error: e1 } = await sb
        .from("personas")
        .insert({
          owner_id: userId,
          name,
          attributes: attributesToSave,
          generated_images: [],
          selected_image_url: null,
          is_active: true,
          regen_count: 0,
        })
        .select("id, name, attributes")
        .single();
      if (e1 && e1.message?.includes("regen_count")) {
        // regen_count column not yet added — retry without it
        console.warn("regen_count column not found, inserting without it");
        const { data: d2, error: e2 } = await sb
          .from("personas")
          .insert({
            owner_id: userId,
            name,
            attributes: attributesToSave,
            generated_images: [],
            selected_image_url: null,
            is_active: true,
          })
          .select("id, name, attributes")
          .single();
        if (e2) throw new Error(`DB insert failed: ${e2.message}`);
        initPersona = d2;
      } else if (e1) {
        throw new Error(`DB insert failed: ${e1.message}`);
      } else {
        initPersona = d1;
      }
      console.log(`[generate-persona] init done: ${Date.now() - t0}ms`);
      return json({ data: { id: initPersona!.id, attributes: validAttrs } }, cors, 201);
    }

    // Build final image prompt: scene context + explicit physical attributes pinned
    // This guarantees Gemini renders the correct skin tone, gender, hair, etc.
    const imagePrompt = buildImagePrompt(validAttrs, scenePrompt);
    console.log("Image prompt:", imagePrompt);

    // Generate and upload images one at a time to stay within edge-function memory limits.
    // Generating in parallel (Promise.all) keeps multiple large base64 buffers in RAM
    // simultaneously and triggers WORKER_LIMIT on Supabase's free/pro tiers.
    const storagePaths: string[] = [];
    let failedCount = 0;
    for (let i = 0; i < imageCount; i++) {
      console.log(`[generate-persona] Gemini image ${i + 1}/${imageCount}: ${Date.now() - t0}ms`);
      try {
        const [image] = await generateImages(imagePrompt, 1);
        console.log(`[generate-persona] Gemini image ${i + 1} done: ${Date.now() - t0}ms`);

        // Upload immediately so the buffer can be GC'd before the next image
        const ext = image.mimeType.includes("png") ? "png" : "jpg";
        const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await sb.storage
          .from("persona-images")
          .upload(storagePath, image.data, {
            contentType: image.mimeType,
            upsert: false,
          });
        if (uploadErr) {
          console.error(`Persona image ${i + 1} upload failed: ${uploadErr.message}`);
          failedCount++;
        } else {
          storagePaths.push(storagePath);
        }
      } catch (imgErr) {
        console.error(`Persona image ${i + 1} generation failed:`, imgErr);
        failedCount++;
      }
    }

    if (failedCount === imageCount) {
      throw new Error(`All ${imageCount} image generation(s) failed`);
    }
    console.log(`[generate-persona] all images done: ${Date.now() - t0}ms`);

    // Save persona record — atomic RPC append on progressive, UPDATE on regen, INSERT on new
    if (isProgressiveAppend) {
      // Atomic append: avoids the read-modify-write race condition when two parallel
      // edge function calls append images to the same persona simultaneously.
      const { error: rpcError } = await sb.rpc("append_persona_image", {
        p_persona_id: persona_id,
        p_owner_id: userId,
        p_image_path: storagePaths[0],
      });
      if (rpcError) {
        // If the RPC function doesn't exist yet (migration not applied), fall back to manual update
        if (rpcError.message?.includes("append_persona_image") || rpcError.code === "42883") {
          console.warn("append_persona_image RPC not found, falling back to manual update");
          const { data: cur } = await sb
            .from("personas")
            .select("generated_images")
            .eq("id", persona_id)
            .eq("owner_id", userId)
            .single();
          const currentImages = Array.isArray(cur?.generated_images) ? cur.generated_images : [];
          const { error: updateErr } = await sb
            .from("personas")
            .update({ generated_images: [...currentImages, storagePaths[0]] })
            .eq("id", persona_id)
            .eq("owner_id", userId);
          if (updateErr) throw new Error(`DB append fallback failed: ${updateErr.message}`);
        } else {
          throw new Error(`DB append failed: ${rpcError.message}`);
        }
      }

      // Sign just the new image — the frontend merges responses from parallel calls
      const { data: signedData } = await sb.storage
        .from("persona-images")
        .createSignedUrls(storagePaths, 3600);
      const signedUrls = (signedData ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];

      return json(
        { data: { id: persona_id, generated_image_urls: signedUrls, attributes: validAttrs } },
        cors,
        201,
      );
    }

    // Regen / new-insert paths: sign all generated images and save record
    const { data: signedData } = await sb.storage
      .from("persona-images")
      .createSignedUrls(storagePaths, 3600);
    const signedUrls = (signedData ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];

    let persona;
    const selectCols = "id, name, attributes, generated_images, selected_image_url, regen_count";
    const selectColsNoRegen = "id, name, attributes, generated_images, selected_image_url";
    if (isRegeneration) {
      const { data, error } = await sb
        .from("personas")
        .update({
          name,
          attributes: attributesToSave,
          generated_images: storagePaths,
          selected_image_url: null,
          regen_count: existingRegenCount + 1,
        })
        .eq("id", persona_id)
        .eq("owner_id", userId)
        .select(selectCols)
        .single();
      if (error && error.message?.includes("regen_count")) {
        console.warn("regen_count column not found, updating without it");
        const { data: d2, error: e2 } = await sb
          .from("personas")
          .update({
            name,
            attributes: attributesToSave,
            generated_images: storagePaths,
            selected_image_url: null,
          })
          .eq("id", persona_id)
          .eq("owner_id", userId)
          .select(selectColsNoRegen)
          .single();
        if (e2) throw new Error(`DB update failed: ${e2.message}`);
        persona = d2;
      } else if (error) {
        throw new Error(`DB update failed: ${error.message}`);
      } else {
        persona = data;
      }
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
          regen_count: 1,
        })
        .select(selectCols)
        .single();
      if (error && error.message?.includes("regen_count")) {
        console.warn("regen_count column not found, inserting without it");
        const { data: d2, error: e2 } = await sb
          .from("personas")
          .insert({
            owner_id: userId,
            name,
            attributes: attributesToSave,
            generated_images: storagePaths,
            selected_image_url: null,
            is_active: true,
          })
          .select(selectColsNoRegen)
          .single();
        if (e2) throw new Error(`DB insert failed: ${e2.message}`);
        persona = d2;
      } else if (error) {
        throw new Error(`DB insert failed: ${error.message}`);
      } else {
        persona = data;
      }
    }

    return json(
      { data: { ...persona, generated_image_urls: signedUrls, attributes: validAttrs } },
      cors,
      201,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }

    // Return actionable messages for known upstream/config failures so the UI
    // can show the real cause instead of a generic 500.
    if (
      msg.includes("NANOBANANA_API_KEY") ||
      msg.includes("NanoBanana") ||
      msg.includes("OpenRouter")
    ) {
      console.error("generate-persona upstream/config error:", e);
      return json({ detail: msg }, cors, 502);
    }

    console.error("generate-persona error:", e);
    return json({ detail: msg || "Failed to generate persona. Please try again." }, cors, 500);
  }
});
