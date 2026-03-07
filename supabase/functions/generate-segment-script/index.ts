import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { callOpenRouter } from "../_shared/openrouter.ts";
import { withRetry } from "../_shared/retry.ts";
import { ErrorCodes, errorResponse } from "../_shared/errors.ts";

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", ja: "Japanese", zh: "Mandarin Chinese",
  ar: "Arabic", ru: "Russian",
};

type SegmentType = "hook" | "body" | "cta";

const DURATION_BOUNDS: Record<SegmentType, [number, number]> = {
  hook: [2, 4],
  body: [5, 9],
  cta: [2, 4],
};

// ── SGE Viral Hook system prompt (mirrors generate-video/index.ts exactly) ──

function buildSystemPrompt(language: string): string {
  const langName = language !== "en" ? (LANGUAGE_NAMES[language] ?? language) : null;
  const languageBlock = langName
    ? `═══ LANGUAGE — ABSOLUTE PRIORITY ═══
ALL output text MUST be written ENTIRELY in ${langName}. This overrides everything else.
• Every single word — hook, body, CTA, all text fields — must be in ${langName}.
• NO English words, not even filler ("link in bio" → adapt naturally in ${langName}).
• Do NOT translate literally; write like a native ${langName} speaker talking to friends.
• The hook/body/CTA structures below are universal — apply them naturally in ${langName}.
═════════════════════════════════════════\n\n`
    : "";

  const result = `${languageBlock}You are an expert UGC (User-Generated Content) ad scriptwriter for e-commerce brands.
Write scripts in first-person, conversational tone — exactly how a real person speaks to camera. NOT how a marketer writes.

CRITICAL VOICE RULES:
- Sound like a friend sharing something they genuinely love, not a brand announcing a product.
- Use contractions and natural speech patterns ("I've been using", "honestly", "I was like").
- NEVER use: "game-changer", "amazing", "incredible", "life-changing", "must-have" — these sound fake.
- No emojis in scripts.
- Write at a natural speaking pace: ~2.5 words per second. Set duration_seconds based on actual word count.

SPECIFICITY RULE (NEVER BREAK): Every claim must contain at least one specific number, timeframe, named ingredient, or named feature. Vague claims are forbidden.
- BAD: "long-lasting mascara" | GOOD: "this mascara holds for 14 hours in 90% humidity"
- BAD: "most users see results" | GOOD: "87% of users saw results in 2 weeks"
- BAD: "affordable" | GOOD: "$12 cheaper than the department store version"

---

HOOK FRAMEWORK — 4 Viral SGE Angles:

The hook must STOP THE SCROLL in the first 2 seconds. Max 2 sentences. No setup.

1. LATE_DISCOVERY ("I wish I'd known about this sooner")
   Pattern: "I've been [doing thing wrong] for [time] until I found [product]"
   Psychology: FOMO + embarrassment + relief
   Example: "I spent 3 years trying every moisturizer before I found this one"

2. PRICE_SHOCK ("This costs HOW much?")
   Pattern: Lead with the price (high OR low) before revealing what it is
   Psychology: Pattern interrupt, curiosity gap
   Example: "This $12 serum outperforms my $200 one" OR "I can't believe I paid $800 for this"

3. SPECIFICITY_LEAD ("The weirdly specific claim that makes it real")
   Pattern: Use a concrete number, timeframe, or measurement — never vague promises
   Psychology: Specificity = credibility
   Example: "This mascara holds for 14 hours in 90% humidity" (not "long-lasting mascara")

4. EVERYONE_KNOWS_BUT_YOU ("The open secret")
   Pattern: Reference something that 'everyone in [niche] knows' but the viewer might not
   Psychology: Tribal identity + curiosity + authority
   Example: "Every dermatologist has this in their cabinet but nobody talks about it"

---

BODY — 5–9 seconds | 12–22 words max
Deliver the payoff fast. Cover: what it does → why it works → one specific proof point.
At 2.5 words/sec: 5s ≈ 12 words, 7s ≈ 17 words, 9s ≈ 22 words. Stay within limits.

CRITICAL BODY RULES (NEVER BREAK):
- The body MUST NOT restate, echo, or mirror the hook's opening problem or pain point.
- The body must CONTINUE from the hook: deliver proof, sensory detail, specific benefit, or social evidence.
- Assume the hook has already established the problem. Body answers: "here's what happened / here's why it works / here's the result."
- Must contain at least one specific number, timeframe, or named ingredient/feature.

Available body structures:
- problem_solution: "[Problem] was ruining [thing]. This [does X] in [timeframe]. [Specific result]."
- demo_tease: Describe what they'd see if they tried it — specific sensory detail.
- story_beat: One vivid moment of discovery or transformation. First-person, present-tense feel.
- social_proof_stack: "[X people / weeks / uses later] — here's what actually happened."

---

CTA — 2–4 seconds | 5–10 words max

INVISIBLE CTA RULE (NEVER BREAK): Never say "link in bio", "shop now", "buy now", or any explicit purchase command.
End with a natural conversational close that makes the viewer WANT to look it up themselves.
Good example: "I actually don't recommend this for everyone, but if you're [specific situation], look it up."
Good example: "Honestly I wasn't going to share this, but here we are."

Available invisible-CTA patterns:
- soft_recommendation: "If you're dealing with [specific problem], it's worth looking into."
- gatekeeping_release: "I wasn't going to tell anyone about this, but I can't keep it to myself."
- specific_qualifier: "I don't recommend this for everyone — but if you [specific condition], look it up."
- social_nudge: "Everyone in [niche community] already knows about this — just saying."
- curiosity_close: "I'll leave it at that. You'll know it when you find it."

---

Return ONLY valid JSON. Set duration_seconds to match actual word count at 2.5 words/sec:
{"text": "...", "duration_seconds": 3, "variant_label": "LATE_DISCOVERY"}`;

  if (language !== "en") {
    return result + `\n\nFINAL REMINDER: Every word in the "text" field MUST be in ${LANGUAGE_NAMES[language] ?? language}. Zero English. Not even one word.`;
  }
  return result;
}

// ── Category-aware hook angle selection (mirrors generate-video/index.ts) ──

function getCategoryAngles(category: string): [string, string] {
  const cat = (category ?? "").toLowerCase();
  if (/skin|beauty|cosmetic|makeup|serum|moistur/.test(cat)) return ["SPECIFICITY_LEAD", "LATE_DISCOVERY"];
  if (/fitness|supplement|protein|workout|gym/.test(cat)) return ["PRICE_SHOCK", "SPECIFICITY_LEAD"];
  if (/fashion|apparel|cloth|wear|dress|shoe/.test(cat)) return ["LATE_DISCOVERY", "EVERYONE_KNOWS_BUT_YOU"];
  if (/tech|gadget|electronic|device|software|app/.test(cat)) return ["PRICE_SHOCK", "SPECIFICITY_LEAD"];
  if (/food|beverage|drink|snack|nutrition|meal/.test(cat)) return ["SPECIFICITY_LEAD", "LATE_DISCOVERY"];
  if (/home|lifestyle|decor|kitchen|clean/.test(cat)) return ["LATE_DISCOVERY", "PRICE_SHOCK"];
  return ["LATE_DISCOVERY", "SPECIFICITY_LEAD"];
}

// ── Segment-specific user prompt ──────────────────────────────────────

function buildUserPrompt(
  product: Record<string, unknown>,
  segmentType: SegmentType,
  variantIndex: number,
  currentHook: string,
  currentBody: string,
  currentCta: string,
  ctaStyle?: string,
  ctaCommentKeyword?: string,
  language = "en",
): string {
  const brandSummary = (product.brand_summary ?? {}) as Record<string, unknown>;
  const langName = language !== "en" ? (LANGUAGE_NAMES[language] ?? language) : null;

  // Language header at the top for maximum salience
  const langHeader = langName
    ? `LANGUAGE: Write the ENTIRE segment in ${langName} ONLY. No English words at all — not even one.\n\n`
    : "";

  // ── Brand summary fields (safe optional access for both 3-field and 10-field shapes) ──
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
  const productCategory = (brandSummary?.product_category as string | undefined) ?? (product.category as string | undefined) ?? "";
  const competitorPositioning = (brandSummary?.competitor_positioning as string | undefined) ?? "";

  // ── Category-aware angle shortlist ───────────────────────────────────
  const [angle1, angle2] = getCategoryAngles(productCategory);
  const categoryBlock = productCategory
    ? `RECOMMENDED HOOK ANGLES for ${productCategory}: ${angle1}, ${angle2}. Choose the best one for this specific product — these are recommendations, not hard constraints.`
    : `RECOMMENDED HOOK ANGLES: LATE_DISCOVERY, SPECIFICITY_LEAD. Choose the best one for this specific product.`;

  // ── Optional brand fields (only include if present) ──────────────────
  const optionalLines: string[] = [];
  if (tagline) optionalLines.push(`Brand tagline: ${tagline}`);
  if (socialProof && socialProof !== "Not mentioned") optionalLines.push(`Social proof / credibility: ${socialProof}`);
  if (pricePositioning) optionalLines.push(`Price positioning: ${pricePositioning}`);
  if (competitorPositioning) optionalLines.push(`Competitor differentiation: ${competitorPositioning}`);
  const optionalBlock = optionalLines.length > 0 ? "\n" + optionalLines.join("\n") : "";

  // ── Existing script context ────────────────────────────────────────
  const contextBlock = `
Current script context (for reference only — do NOT copy or repeat):
- Current hook: "${currentHook}"
- Current body: "${currentBody}"
- Current CTA: "${currentCta}"`;

  // ── Segment-specific regeneration instruction ─────────────────────
  let segmentInstruction: string;
  if (segmentType === "hook") {
    segmentInstruction = `Regenerate ONLY the hook. Keep the body and CTA context in mind so the new hook flows naturally into them.
Apply the SGE hook framework. REQUIRED: include at least one specific number, timeframe, or named feature.
Variant ${variantIndex + 1}: use a DIFFERENT angle than the current hook above.
${categoryBlock}`;
  } else if (segmentType === "body") {
    segmentInstruction = `Regenerate ONLY the body. Keep the hook and CTA context in mind — the body must continue naturally from the hook and lead into the CTA.
Body must be 2–4 sentences, 12–22 words, 5–9 seconds at 2.5 words/sec.
Do NOT restate the hook's problem. Deliver proof, specific benefit, or social evidence.
Must contain at least one specific number, timeframe, or named ingredient/feature.
Variant ${variantIndex + 1}: use a DIFFERENT body structure than the most obvious one.`;
  } else {
    segmentInstruction = `Regenerate ONLY the CTA. Keep the hook and body context in mind — the CTA must close naturally.
One sentence. 5–10 words. 2–4 seconds.
INVISIBLE CTA RULE: No "buy now", no "link in bio", no "shop now". Use an invisible close that makes viewers want to seek it out themselves.
Variant ${variantIndex + 1}: use a DIFFERENT invisible-CTA pattern.`;

    if (ctaStyle && ctaStyle !== "auto") {
      segmentInstruction += `\nCTA style constraint: ${ctaStyle}`;
      if (ctaStyle === "comment_keyword" && ctaCommentKeyword) {
        segmentInstruction += ` — keyword: "${ctaCommentKeyword}"`;
      }
    }
  }

  const base = `${langHeader}Product: ${product.name}
Description: ${product.description}
Price: ${product.price ?? "N/A"} ${product.currency ?? ""}
Brand tone: ${tone}
Target demographic: ${demographic}
Key selling points: ${sellingPoints}${optionalBlock}
${uniqueValueProp ? `Unique value proposition: ${uniqueValueProp}` : ""}
${customerPainPoints ? `Target these pain points: ${customerPainPoints}` : ""}

PRICE NOTE: The product costs ${product.price} ${product.currency ?? ""}. Do NOT use phrases like "just $X" or "only $X" unless this price is clearly budget-friendly for the product category. Present the price truthfully and contextually.
${contextBlock}

${segmentInstruction}

REQUIRED: The regenerated segment must contain at least one specific number, timeframe, or named ingredient/feature. No vague claims allowed. "Long-lasting" → "holds for 14 hours". "Most users" → "87% of users". This is non-negotiable.${langName ? `\n\nRemember: every word in the JSON output must be in ${langName}. Native-speaker level, zero English.` : ""}`;

  return base;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return errorResponse(ErrorCodes.INVALID_INPUT, "Method not allowed", 405, cors);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const {
      product_id,
      persona_id,
      segment_type,
      variant_index = 0,
      current_hook = "",
      current_body = "",
      current_cta = "",
      cta_style,
      cta_comment_keyword,
      language = "en",
    } = await req.json();

    const VALID_LANGUAGES = new Set(["en","es","fr","de","it","pt","ja","zh","ar","ru"]);
    const resolvedLanguage = VALID_LANGUAGES.has(language) ? language : "en";

    if (!product_id) return errorResponse(ErrorCodes.INVALID_INPUT, "product_id is required", 400, cors);
    if (!persona_id) return errorResponse(ErrorCodes.INVALID_INPUT, "persona_id is required", 400, cors);
    if (!segment_type || !["hook", "body", "cta"].includes(segment_type)) {
      return errorResponse(ErrorCodes.INVALID_INPUT, "segment_type must be 'hook', 'body', or 'cta'", 400, cors);
    }
    if (cta_comment_keyword !== undefined && cta_comment_keyword !== null) {
      if (
        typeof cta_comment_keyword !== "string" ||
        cta_comment_keyword.length > 50 ||
        !/^[\w\s#@\-]+$/u.test(cta_comment_keyword)
      ) {
        return errorResponse(
          ErrorCodes.INVALID_INPUT,
          "cta_comment_keyword must be 50 characters or fewer and contain only letters, numbers, spaces, hyphens, # or @",
          400,
          cors,
        );
      }
    }

    // Verify product ownership
    const { data: product, error: prodErr } = await sb
      .from("products")
      .select("*")
      .eq("id", product_id)
      .eq("owner_id", userId)
      .eq("confirmed", true)
      .single();
    if (prodErr || !product) {
      return errorResponse(ErrorCodes.INVALID_INPUT, "Product not found or not confirmed", 404, cors);
    }

    // Verify persona ownership
    const { data: persona, error: persErr } = await sb
      .from("personas")
      .select("id")
      .eq("id", persona_id)
      .eq("owner_id", userId)
      .eq("is_active", true)
      .single();
    if (persErr || !persona) {
      return errorResponse(ErrorCodes.INVALID_INPUT, "Persona not found or inactive", 404, cors);
    }

    const seg = segment_type as SegmentType;
    const [minDur, maxDur] = DURATION_BOUNDS[seg];

    const rawContent = await withRetry(() =>
      callOpenRouter(
        [
          { role: "system", content: buildSystemPrompt(resolvedLanguage) },
          {
            role: "user",
            content: buildUserPrompt(
              product,
              seg,
              variant_index,
              current_hook,
              current_body,
              current_cta,
              cta_style,
              cta_comment_keyword,
              resolvedLanguage,
            ),
          },
        ],
        { maxTokens: 300, timeoutMs: 20000, jsonMode: true },
      )
    );

    let cleaned = rawContent.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (!parsed.text || typeof parsed.text !== "string") {
      throw new Error("Invalid segment response: missing text");
    }

    const duration = typeof parsed.duration_seconds === "number"
      ? Math.max(minDur, Math.min(maxDur, parsed.duration_seconds))
      : minDur;

    return json({
      data: {
        text: parsed.text,
        duration_seconds: duration,
        variant_label: typeof parsed.variant_label === "string" ? parsed.variant_label : seg,
      },
    }, cors, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Authentication required", 401, cors);
    }
    console.error("generate-segment-script error:", e);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Failed to generate segment script. Please try again.",
      500,
      cors,
    );
  }
});
