import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { checkCredits, debitCredits, refundCredits } from "../_shared/credits.ts";
import { callOpenRouter } from "../_shared/openrouter.ts";
import { submitSoraJob } from "../_shared/sora.ts";
import { captureException } from "../_shared/sentry.ts";
import { ErrorCodes, errorResponse } from "../_shared/errors.ts";

// ── Credit costs per Sora model ──────────────────────────────────────

const CREDIT_COST: Record<string, number> = {
  "sora-2": 5,
  "sora-2-pro": 10,
};

// ── Language support ─────────────────────────────────────────────────

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", ja: "Japanese", zh: "Mandarin Chinese",
  ar: "Arabic", ru: "Russian", ko: "Korean", hi: "Hindi",
  nl: "Dutch",
};

// ── Category-aware hook angle selection ──────────────────────────────

function getCategoryAngles(category: string): [string, string] {
  const cat = (category ?? "").toLowerCase();
  if (/skin|beauty|cosmetic|makeup|serum|moistur/.test(cat)) return ["SPECIFICITY_LEAD", "LATE_DISCOVERY"];
  if (/fitness|supplement|protein|workout|gym/.test(cat)) return ["PRICE_SHOCK", "SPECIFICITY_LEAD"];
  if (/fashion|apparel|cloth|wear|dress|shoe/.test(cat)) return ["LATE_DISCOVERY", "EVERYONE_KNOWS_BUT_YOU"];
  if (/tech|gadget|electronic|device|software|app|saas/.test(cat)) return ["PRICE_SHOCK", "SPECIFICITY_LEAD"];
  if (/food|beverage|drink|snack|nutrition|meal/.test(cat)) return ["SPECIFICITY_LEAD", "LATE_DISCOVERY"];
  if (/home|lifestyle|decor|kitchen|clean/.test(cat)) return ["LATE_DISCOVERY", "PRICE_SHOCK"];
  return ["LATE_DISCOVERY", "SPECIFICITY_LEAD"];
}

// ── Script generation system prompt ──────────────────────────────────

function buildScriptSystemPrompt(language: string): string {
  const langName = language !== "en" ? (LANGUAGE_NAMES[language] ?? language) : null;
  const languageBlock = langName
    ? `═══ LANGUAGE — ABSOLUTE PRIORITY ═══
ALL output text MUST be written ENTIRELY in ${langName}. This overrides everything else.
• Every single word must be in ${langName}. NO English words, not even filler.
• Do NOT translate literally; write like a native ${langName} speaker talking to friends.
═════════════════════════════════════════\n\n`
    : "";

  const prompt = `${languageBlock}You are a real person talking to your phone camera, telling a friend about something you recently started using. You are NOT a copywriter. You are NOT writing an ad. You're just recounting what happened.

This is a SINGLE CONTINUOUS VIDEO (16-20 seconds total). The hook, body, and CTA flow as one natural monologue — no cuts, no edits.

Pick the character voice that fits this product and demographic — stay in it throughout:
- The skeptic who was proven wrong ("I genuinely didn't think this would work for me")
- The accidental discoverer ("I wasn't even looking for this, someone mentioned it offhand")
- The person who wasted time/money before this ("I wish I'd found this two years ago, honestly")
- The quiet recommender ("I don't usually post about stuff but three people asked me this week")
- The convert ("I was using [similar thing] for years before I switched — not going back")

VOICE RULES:
- Use casual human connectors: "lowkey", "honestly", "kind of", "I mean", "like", "tbh", "ngl", "actually"
- Short clipped sentences work: "It just works." / "Three weeks in." / "Not gonna lie."
- Start mid-thought sometimes: "Took me a week to believe it." / "Been using it daily since."
- Contractions always: "I've", "it's", "wasn't", "I'd", "I'm"
- NEVER use: "game-changer", "amazing", "incredible", "life-changing", "must-have", "blew my mind", "changed everything", "that actually works", "here's why", "makes a real difference", "can't imagine going back" — instant AI tells
- No emojis
- ~2.5 words per second. Total script should be 40-50 words for 20s, 32-40 words for 16s.

SPECIFICITY RULE: Personal measurements only — never invented statistics.
- GOOD: "I timed myself the first week" / "third time using it" / "been using it since January"
- BAD: "87% of users saw results" / "affordable" / "long-lasting"

---

HOOK — 2-4 seconds | Stop the scroll. Max 2 sentences. No setup.
Hook angles (pick what fits the product naturally):
- LATE_DISCOVERY: "I've been [doing it the wrong way] for [time] and then I found this"
- PRICE_SHOCK: Lead with the price before saying what it is
- SPECIFICITY_LEAD: Open with a concrete personal detail — a timeframe, a moment
- EVERYONE_KNOWS_BUT_YOU: "Everyone in [niche] already knows about this"

BODY — 10-14 seconds | Continue from the hook — don't restate the problem. Jump to what happened.
CRITICAL: Never echo the hook's emotion. The body is the PAYOFF, not a replay.
Translate features into personal moments — never recite the product description.
- GOOD: "No chalky aftertaste, just mixes clean — I've had it every morning for three weeks"
- BAD: "25 grams of protein per serving with no artificial sweeteners"
One personal specific: a timeframe, a sensory detail, something you actually noticed.

CTA — 2-4 seconds | INVISIBLE CTA. No "link in bio", no "shop now". End naturally.
- "I'll let you find it yourself." / "Not for everyone — but if you're dealing with [thing], worth a look."
- "Anyway. Look it up." / "Half my [group] is using it now."

---

Return ONLY valid JSON:
{ "hook": "...", "body": "...", "cta": "..." }`;

  if (langName) {
    return prompt + `\n\nFINAL REMINDER: Every word must be in ${langName}. Zero English.`;
  }
  return prompt;
}

function buildScriptUserPrompt(
  product: Record<string, unknown> | null,
  persona: Record<string, unknown> | null,
  isSaas: boolean,
  language: string,
): string {
  const langName = language !== "en" ? (LANGUAGE_NAMES[language] ?? language) : null;
  const parts: string[] = [];

  if (langName) {
    parts.push(`LANGUAGE: Write the ENTIRE script in ${langName} ONLY. No English words at all.\n`);
  }

  if (product) {
    const brandSummary = (product.brand_summary ?? {}) as Record<string, unknown>;
    const tone = (brandSummary?.tone as string | undefined) ?? "conversational, authentic";
    const demographic = (brandSummary?.demographic as string | undefined) ?? "general adults";
    const sellingPoints = Array.isArray(brandSummary?.selling_points)
      ? (brandSummary.selling_points as string[]).join(", ")
      : (brandSummary?.selling_points as string | undefined) ?? "N/A";
    const tagline = (brandSummary?.tagline as string | undefined) ?? "";
    const uniqueValueProp = (brandSummary?.unique_value_prop as string | undefined) ?? "";
    const customerPainPoints = Array.isArray(brandSummary?.customer_pain_points)
      ? (brandSummary.customer_pain_points as string[]).join(", ")
      : "";
    const socialProof = (brandSummary?.social_proof as string | undefined) ?? "";
    const pricePositioning = (brandSummary?.price_positioning as string | undefined) ?? "";
    const productCategory = (brandSummary?.product_category as string | undefined) ?? "";
    const competitorPositioning = (brandSummary?.competitor_positioning as string | undefined) ?? "";

    parts.push(`Product: ${product.name ?? ""}`);
    parts.push(`Description: ${product.description ?? ""}`);
    if (product.price) parts.push(`Price: ${product.price} ${product.currency ?? ""}`);
    parts.push(`Brand tone: ${tone}`);
    parts.push(`Target demographic: ${demographic}`);
    parts.push(`Key selling points: ${sellingPoints}`);
    if (tagline) parts.push(`Brand tagline: ${tagline}`);
    if (uniqueValueProp) parts.push(`Unique value proposition: ${uniqueValueProp}`);
    if (customerPainPoints) parts.push(`Target these pain points: ${customerPainPoints}`);
    if (socialProof && socialProof !== "Not mentioned") parts.push(`Social proof: ${socialProof}`);
    if (pricePositioning) parts.push(`Price positioning: ${pricePositioning}`);
    if (competitorPositioning) parts.push(`Competitor differentiation: ${competitorPositioning}`);

    // Category-aware angle recommendation
    const [angle1, angle2] = getCategoryAngles(productCategory);
    parts.push(`\nRECOMMENDED HOOK ANGLES for ${productCategory || "this product"}: ${angle1}, ${angle2}`);

    if (product.price) {
      parts.push(`\nPRICE NOTE: Do NOT use "just $X" or "only $X" unless clearly budget-friendly. Present price truthfully.`);
    }
  }

  if (persona) {
    const attrs = (persona.attributes ?? {}) as Record<string, unknown>;
    parts.push(`\nPersona voice: ${persona.name ?? "UGC creator"}`);
    if (attrs.clothing_style) parts.push(`Style: ${attrs.clothing_style}`);
  }

  if (isSaas) {
    parts.push("\nThis is a SaaS/software product — focus on the workflow improvement, time saved, or frustration eliminated. No physical product to show.");
  }

  if (parts.length === 0) {
    parts.push("Write a generic UGC-style talking-head video script about a product the creator recently discovered.");
  }

  parts.push("\nSPECIFICITY: Use personal measurements — not invented stats. Mirror the brand tone naturally. CTA must be invisible.");

  return parts.join("\n");
}

// ── Sora video prompt builder ────────────────────────────────────────

function buildSoraVideoPrompt(
  scriptText: string,
  persona: Record<string, unknown> | null,
  isSaas: boolean,
): string {
  const parts: string[] = [];

  // Core: what's happening in the video
  parts.push("A UGC creator speaking directly to camera in a single continuous take.");

  // Persona appearance (from attributes)
  if (persona) {
    const attrs = (persona.attributes ?? {}) as Record<string, unknown>;
    const appearanceParts: string[] = [];
    if (attrs.gender) appearanceParts.push(String(attrs.gender));
    if (attrs.age) appearanceParts.push(`approximately ${attrs.age} years old`);
    if (attrs.ethnicity) appearanceParts.push(String(attrs.ethnicity));
    if (attrs.hair_color && attrs.hair_style) {
      appearanceParts.push(`${attrs.hair_color} ${attrs.hair_style} hair`);
    } else if (attrs.hair_color) {
      appearanceParts.push(`${attrs.hair_color} hair`);
    }
    if (attrs.clothing_style) appearanceParts.push(`wearing ${attrs.clothing_style}`);
    if (appearanceParts.length > 0) {
      parts.push(`The creator is a ${appearanceParts.join(", ")}.`);
    }

    // Scene from persona
    const scenePrompt = attrs.scene_prompt as string | undefined;
    if (scenePrompt) {
      parts.push(scenePrompt);
    }
  }

  // The speech content
  parts.push(`They say: "${scriptText}"`);

  // Emotion and delivery
  parts.push("Natural delivery with genuine emotion — not rehearsed or performative. Micro-expressions shift between curiosity, conviction, and casual warmth.");

  // Camera and aesthetic
  if (isSaas) {
    parts.push("Casual home office or modern workspace setting. Soft natural lighting from a window. Talking-head framing, upper body visible, slight handheld movement for authenticity.");
  } else {
    parts.push("Casual handheld selfie POV, slightly shaky for authenticity. Natural lighting, warm tones. Upper body in frame, maintaining eye contact with camera.");
  }

  // Technical directives for Sora
  parts.push("Continuous single shot — no cuts, no transitions. Subtle head movements and hand gestures throughout. Photorealistic, cinematic shallow depth of field.");

  return parts.join(" ");
}

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return errorResponse(ErrorCodes.INVALID_INPUT, "Method not allowed", 405, cors);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const body = await req.json();
    const { phase } = body;

    // ══════════════════════════════════════════════════════════════════
    // PHASE "script" — Generate or accept a script, create generation
    // ══════════════════════════════════════════════════════════════════
    if (phase === "script") {
      const {
        script_format,
        product_id,
        persona_id,
        is_saas,
        language,
        freeform_prompt,
        structured_script,
      } = body;

      // Validate script_format
      if (script_format !== "structured" && script_format !== "freeform") {
        return errorResponse(
          ErrorCodes.INVALID_INPUT,
          "script_format must be 'structured' or 'freeform'",
          400,
          cors,
        );
      }

      // ── Load product data (optional — includes brand_summary) ──
      let productData: Record<string, unknown> | null = null;
      if (product_id) {
        const { data: product, error: prodErr } = await sb
          .from("products")
          .select("*")
          .eq("id", product_id)
          .eq("owner_id", userId)
          .eq("confirmed", true)
          .single();
        if (prodErr || !product) {
          return errorResponse(
            ErrorCodes.INVALID_INPUT,
            "Product not found or not confirmed",
            404,
            cors,
          );
        }
        productData = product as Record<string, unknown>;
      }

      // ── Load persona data (optional — includes attributes) ─────
      let personaData: Record<string, unknown> | null = null;
      if (persona_id) {
        const { data: persona, error: persErr } = await sb
          .from("personas")
          .select("*")
          .eq("id", persona_id)
          .eq("owner_id", userId)
          .eq("is_active", true)
          .single();
        if (persErr || !persona) {
          return errorResponse(
            ErrorCodes.INVALID_INPUT,
            "Persona not found or inactive",
            404,
            cors,
          );
        }
        personaData = persona as Record<string, unknown>;
      }

      let script: { hooks: { text: string }[]; bodies: { text: string }[]; ctas: { text: string }[] } | null = null;
      let freeformPromptValue: string | null = null;

      if (script_format === "structured") {
        if (structured_script && structured_script.hook && structured_script.body && structured_script.cta) {
          // User-provided script — use directly
          script = {
            hooks: [{ text: structured_script.hook }],
            bodies: [{ text: structured_script.body }],
            ctas: [{ text: structured_script.cta }],
          };
        } else {
          // Generate script via OpenRouter with rich brand context
          const systemPrompt = buildScriptSystemPrompt(language || "en");
          const userPrompt = buildScriptUserPrompt(
            productData,
            personaData,
            is_saas || false,
            language || "en",
          );

          const llmResponse = await callOpenRouter(
            [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            { maxTokens: 500, jsonMode: true },
          );

          let parsed: { hook: string; body: string; cta: string };
          try {
            parsed = JSON.parse(llmResponse);
          } catch {
            return errorResponse(
              ErrorCodes.INTERNAL_ERROR,
              "Failed to parse generated script",
              500,
              cors,
            );
          }

          if (!parsed.hook || !parsed.body || !parsed.cta) {
            return errorResponse(
              ErrorCodes.INTERNAL_ERROR,
              "Generated script missing required fields",
              500,
              cors,
            );
          }

          script = {
            hooks: [{ text: parsed.hook }],
            bodies: [{ text: parsed.body }],
            ctas: [{ text: parsed.cta }],
          };
        }
      } else {
        // Freeform format
        if (freeform_prompt && typeof freeform_prompt === "string" && freeform_prompt.trim()) {
          // User-provided freeform prompt
          freeformPromptValue = freeform_prompt.trim();
        } else {
          // Auto-generate a freeform video prompt via OpenRouter
          const freeformSystemPrompt = `You are a creative video director writing a single prompt for an AI video generator (Sora 2).
Write one detailed, vivid paragraph describing a UGC-style talking-head video scene.
Include: the person's energy/emotion, what they're saying (paraphrased, not scripted word-for-word), the setting, lighting, camera movement, and overall mood.
The output should read like a cinematic scene description, NOT a script.
Keep it under 100 words. Return ONLY the prompt text, no JSON, no quotes.`;

          const freeformUserParts: string[] = [];
          if (productData) {
            const bs = (productData.brand_summary ?? {}) as Record<string, unknown>;
            freeformUserParts.push(`Product: ${productData.name ?? ""}`);
            freeformUserParts.push(`Description: ${productData.description ?? ""}`);
            if (bs.tone) freeformUserParts.push(`Brand tone: ${bs.tone}`);
            if (bs.selling_points) {
              const sp = Array.isArray(bs.selling_points) ? (bs.selling_points as string[]).join(", ") : String(bs.selling_points);
              freeformUserParts.push(`Key selling points: ${sp}`);
            }
          }
          if (personaData) {
            freeformUserParts.push(`Persona: ${personaData.name ?? "UGC creator"}`);
          }
          if (is_saas) freeformUserParts.push("This is a SaaS product — use a screen demo / workspace setting.");
          if (freeformUserParts.length === 0) {
            freeformUserParts.push("Create a generic UGC-style product review video scene.");
          }
          freeformUserParts.push("\nWrite a single vivid video prompt for this product.");

          const freeformLlmResponse = await callOpenRouter(
            [
              { role: "system", content: freeformSystemPrompt },
              { role: "user", content: freeformUserParts.join("\n") },
            ],
            { maxTokens: 200 },
          );

          freeformPromptValue = freeformLlmResponse.trim();
        }
      }

      // ── Create generation record ─────────────────────────────────
      const { data: generation, error: insertErr } = await sb
        .from("generations")
        .insert({
          owner_id: userId,
          type: "single-video",
          status: "awaiting_approval",
          product_id: product_id || null,
          persona_id: persona_id || null,
          is_saas: is_saas || false,
          language: language || "en",
          script: script,
          freeform_prompt: freeformPromptValue,
        })
        .select("id")
        .single();

      if (insertErr || !generation) {
        console.error("Failed to create generation:", insertErr);
        return errorResponse(
          ErrorCodes.INTERNAL_ERROR,
          "Failed to create generation record",
          500,
          cors,
        );
      }

      // Default credit estimate (sora-2)
      const creditsToCharge = CREDIT_COST["sora-2"];

      // Return flat script format for frontend consumption
      const flatScript = script
        ? {
            hook: script.hooks[0]?.text ?? "",
            body: script.bodies[0]?.text ?? "",
            cta: script.ctas[0]?.text ?? "",
            full_text: [
              script.hooks[0]?.text,
              script.bodies[0]?.text,
              script.ctas[0]?.text,
            ]
              .filter(Boolean)
              .join(" "),
          }
        : undefined;

      return json(
        {
          data: {
            generation_id: generation.id,
            status: "awaiting_approval",
            script: flatScript,
            freeform_prompt: freeformPromptValue,
            credits_to_charge: creditsToCharge,
          },
        },
        cors,
        200,
      );
    }

    // ══════════════════════════════════════════════════════════════════
    // PHASE "full" — Approve and kick off video generation
    // ══════════════════════════════════════════════════════════════════
    if (phase === "full") {
      const {
        generation_id,
        sora_model,
        duration,
        reference_type,
        reference_image_path,
        composite_image_path,
      } = body;

      if (!generation_id) {
        return errorResponse(ErrorCodes.INVALID_INPUT, "generation_id is required", 400, cors);
      }

      const validModels = ["sora-2", "sora-2-pro"];
      if (!sora_model || !validModels.includes(sora_model)) {
        return errorResponse(ErrorCodes.INVALID_INPUT, "sora_model must be 'sora-2' or 'sora-2-pro'", 400, cors);
      }

      const validDurations = [4, 8, 12];
      if (!duration || !validDurations.includes(duration)) {
        return errorResponse(ErrorCodes.INVALID_INPUT, "duration must be 4, 8, or 12", 400, cors);
      }

      const validRefTypes = ["composite", "persona", "custom", "none"];
      if (!reference_type || !validRefTypes.includes(reference_type)) {
        return errorResponse(
          ErrorCodes.INVALID_INPUT,
          "reference_type must be 'composite', 'persona', 'custom', or 'none'",
          400,
          cors,
        );
      }

      // ── 1. Load generation, verify ownership and status ──────────
      const { data: gen, error: genErr } = await sb
        .from("generations")
        .select("*")
        .eq("id", generation_id)
        .eq("owner_id", userId)
        .single();

      if (genErr || !gen) {
        return errorResponse(ErrorCodes.INVALID_INPUT, "Generation not found", 404, cors);
      }

      if (gen.status !== "awaiting_approval") {
        return errorResponse(
          ErrorCodes.INVALID_INPUT,
          `Generation is in status '${gen.status}', expected 'awaiting_approval'`,
          409,
          cors,
        );
      }

      // ── 2. Atomic lock: set status to "locking" ─────────────────
      const { data: locked, error: lockErr } = await sb
        .from("generations")
        .update({ status: "locking" })
        .eq("id", generation_id)
        .eq("status", "awaiting_approval")
        .select("id")
        .single();

      if (lockErr || !locked) {
        return errorResponse(
          ErrorCodes.INVALID_INPUT,
          "Generation already being processed (race condition)",
          409,
          cors,
        );
      }

      // ── 3. Compute credit cost and check/debit ──────────────────
      const creditCost = CREDIT_COST[sora_model] ?? 5;

      const remaining = await checkCredits(userId);
      if (remaining < creditCost) {
        // Unlock
        await sb
          .from("generations")
          .update({ status: "awaiting_approval" })
          .eq("id", generation_id);
        return errorResponse(
          ErrorCodes.INSUFFICIENT_CREDITS,
          `Need ${creditCost} credits, have ${remaining}`,
          402,
          cors,
        );
      }

      await debitCredits(userId, creditCost, generation_id);

      try {
        // ── 4. Load persona for rich Sora prompt ────────────────
        let fullPersonaData: Record<string, unknown> | null = null;
        if (gen.persona_id) {
          const { data: persona } = await sb
            .from("personas")
            .select("*")
            .eq("id", gen.persona_id)
            .single();
          if (persona) fullPersonaData = persona as Record<string, unknown>;
        }

        // ── 5. Build the Sora prompt ──────────────────────────────
        let soraPrompt: string;

        if (gen.freeform_prompt) {
          // Freeform: wrap with visual context if persona available
          soraPrompt = buildSoraVideoPrompt(
            gen.freeform_prompt,
            fullPersonaData,
            gen.is_saas || false,
          );
        } else if (gen.script) {
          // Structured: concatenate hook + body + cta
          const script = gen.script as {
            hooks: { text: string }[];
            bodies: { text: string }[];
            ctas: { text: string }[];
          };
          const hook = script.hooks?.[0]?.text || "";
          const bodyText = script.bodies?.[0]?.text || "";
          const cta = script.ctas?.[0]?.text || "";
          const fullScript = [hook, bodyText, cta].filter(Boolean).join(" ");
          soraPrompt = buildSoraVideoPrompt(
            fullScript,
            fullPersonaData,
            gen.is_saas || false,
          );
        } else {
          throw new Error("Generation has neither script nor freeform_prompt");
        }

        // ── 6. Resolve reference image blob ───────────────────────
        let inputReferenceBlob: Blob | undefined;

        if (reference_type === "composite") {
          if (!composite_image_path) {
            throw new Error("composite_image_path is required for composite reference type");
          }
          const { data: signedUrl, error: urlErr } = await sb.storage
            .from("composite-images")
            .createSignedUrl(composite_image_path, 7200);
          if (urlErr || !signedUrl?.signedUrl) {
            throw new Error(`Failed to sign composite image: ${urlErr?.message}`);
          }
          const imgRes = await fetch(signedUrl.signedUrl);
          if (!imgRes.ok) throw new Error(`Failed to download composite image: HTTP ${imgRes.status}`);
          inputReferenceBlob = await imgRes.blob();
        } else if (reference_type === "persona") {
          // Load persona to get selected_image_url (a storage path, not a full URL)
          if (!gen.persona_id) {
            throw new Error("No persona_id on generation for persona reference type");
          }
          const { data: persona, error: persErr } = await sb
            .from("personas")
            .select("selected_image_url")
            .eq("id", gen.persona_id)
            .single();
          if (persErr || !persona?.selected_image_url) {
            throw new Error("Persona or selected_image_url not found");
          }
          // selected_image_url is a storage path like "userId/uuid.jpg" — sign it
          const { data: personaSignedUrl, error: personaUrlErr } = await sb.storage
            .from("persona-images")
            .createSignedUrl(persona.selected_image_url, 7200);
          if (personaUrlErr || !personaSignedUrl?.signedUrl) {
            throw new Error(`Failed to sign persona image: ${personaUrlErr?.message}`);
          }
          const imgRes = await fetch(personaSignedUrl.signedUrl);
          if (!imgRes.ok) throw new Error(`Failed to download persona image: HTTP ${imgRes.status}`);
          inputReferenceBlob = await imgRes.blob();
        } else if (reference_type === "custom") {
          if (!reference_image_path) {
            throw new Error("reference_image_path is required for custom reference type");
          }
          const { data: signedUrl, error: urlErr } = await sb.storage
            .from("reference-images")
            .createSignedUrl(reference_image_path, 7200);
          if (urlErr || !signedUrl?.signedUrl) {
            throw new Error(`Failed to sign reference image: ${urlErr?.message}`);
          }
          const imgRes = await fetch(signedUrl.signedUrl);
          if (!imgRes.ok) throw new Error(`Failed to download reference image: HTTP ${imgRes.status}`);
          inputReferenceBlob = await imgRes.blob();
        }
        // reference_type === "none" → no blob

        // ── 7. Resize reference image to match Sora's required dimensions ──
        // Sora requires input_reference to exactly match the target size.
        const targetSize = sora_model === "sora-2-pro" ? "1080x1920" : "720x1280";
        const [targetW, targetH] = targetSize.split("x").map(Number);

        if (inputReferenceBlob) {
          try {
            const bitmap = await createImageBitmap(inputReferenceBlob);
            if (bitmap.width !== targetW || bitmap.height !== targetH) {
              console.log(`Resizing reference image from ${bitmap.width}x${bitmap.height} to ${targetW}x${targetH}`);
              const canvas = new OffscreenCanvas(targetW, targetH);
              const ctx = canvas.getContext("2d")!;
              // Cover-fit: scale to fill, crop excess
              const scale = Math.max(targetW / bitmap.width, targetH / bitmap.height);
              const scaledW = bitmap.width * scale;
              const scaledH = bitmap.height * scale;
              const offsetX = (targetW - scaledW) / 2;
              const offsetY = (targetH - scaledH) / 2;
              ctx.drawImage(bitmap, offsetX, offsetY, scaledW, scaledH);
              const resizedBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
              inputReferenceBlob = resizedBlob;
            }
            bitmap.close();
          } catch (resizeErr) {
            // If OffscreenCanvas is not available in this Deno runtime, skip reference image
            console.warn("Image resize failed, submitting without reference image:", resizeErr);
            inputReferenceBlob = undefined;
          }
        }

        // ── 8. Submit Sora job ────────────────────────────────────
        const soraResult = await submitSoraJob({
          prompt: soraPrompt,
          model: sora_model as "sora-2" | "sora-2-pro",
          seconds: duration,
          size: targetSize,
          input_reference_blob: inputReferenceBlob,
        });

        // ── 7. Update generation with job info ────────────────────
        const { error: updateErr } = await sb
          .from("generations")
          .update({
            external_job_ids: { video: soraResult.job_id },
            sora_model: sora_model,
            duration: duration,
            reference_type: reference_type,
            reference_image_path: reference_image_path || composite_image_path || null,
            status: "generating_segments",
            started_at: new Date().toISOString(),
          })
          .eq("id", generation_id);

        if (updateErr) {
          throw new Error(`Failed to update generation: ${updateErr.message}`);
        }

        return json(
          {
            data: {
              generation_id,
              status: "generating_segments",
              credits_charged: creditCost,
            },
          },
          cors,
          200,
        );
      } catch (err) {
        // Refund credits on failure
        console.error("Full phase failed, refunding credits:", err);
        captureException(err);

        try {
          await refundCredits(userId, creditCost, generation_id);
        } catch (refundErr) {
          console.error("Credit refund failed:", refundErr);
          captureException(refundErr);
        }

        // Set status to failed
        await sb
          .from("generations")
          .update({
            status: "failed",
            error_message: err instanceof Error ? err.message : String(err),
          })
          .eq("id", generation_id);

        return errorResponse(
          ErrorCodes.VIDEO_GENERATION_FAILED,
          err instanceof Error ? err.message : "Video generation failed",
          500,
          cors,
        );
      }
    }

    // Unknown phase
    return errorResponse(
      ErrorCodes.INVALID_INPUT,
      "phase must be 'script' or 'full'",
      400,
      cors,
    );
  } catch (err) {
    console.error("generate-single-video error:", err);
    captureException(err);

    if (err instanceof Error && err.message === "Unauthorized") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Unauthorized", 401, cors);
    }

    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      err instanceof Error ? err.message : "Internal server error",
      500,
      cors,
    );
  }
});
