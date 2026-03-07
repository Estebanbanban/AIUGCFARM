import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { checkCredits, debitCredits, refundCredits } from "../_shared/credits.ts";
import { callOpenRouter } from "../_shared/openrouter.ts";
import { withRetry } from "../_shared/retry.ts";
import { submitKlingJob } from "../_shared/kling.ts";
import { submitSoraJob } from "../_shared/sora.ts";
import { captureException } from "../_shared/sentry.ts";
import { ErrorCodes, errorResponse } from "../_shared/errors.ts";

// Kling model name per quality tier
const KLING_MODEL = {
  standard: "kling-v2-6",
  hd: "kling-v3",
} as const;

// ── Script types ──────────────────────────────────────────────────────

interface ScriptSegment {
  text: string;
  duration_seconds: number;
  variant_label: string;
}

interface GeneratedScript {
  hooks: ScriptSegment[];
  bodies: ScriptSegment[];
  ctas: ScriptSegment[];
}

// ── Advanced Mode input types ─────────────────────────────────────────

interface AdvancedSegmentInput {
  script_text: string;
  global_emotion: string;
  global_intensity: number;
  action_description?: string;
  image_path?: string;
}

interface AdvancedSegmentsInput {
  hooks: AdvancedSegmentInput[];
  bodies: AdvancedSegmentInput[];
  ctas: AdvancedSegmentInput[];
}

// ── Emotion utilities ─────────────────────────────────────────────────

const EMOTION_TAG_REGEX = /\[e:(\w+):(\w+)\]/gi;

interface EmotionTag {
  emotion: string;
  intensity: number;
}

function parseEmotionTags(text: string): EmotionTag[] {
  const tags: EmotionTag[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(EMOTION_TAG_REGEX.source, "gi");
  while ((match = regex.exec(text)) !== null) {
    const emotion = match[1].toLowerCase();
    const intensityStr = match[2].toLowerCase();
    const intensityMap: Record<string, number> = { low: 1, "1": 1, medium: 2, "2": 2, high: 3, "3": 3 };
    const intensity = intensityMap[intensityStr] ?? 2;
    tags.push({ emotion, intensity });
  }
  return tags;
}

function stripEmotionTags(text: string): string {
  return text.replace(new RegExp(EMOTION_TAG_REGEX.source, "gi"), "").replace(/\s{2,}/g, " ").trim();
}

const EMOTION_DIRECTIVES: Record<string, string> = {
  happy: "warm smile, relaxed energy, genuine happiness",
  excited: "enthusiastic, animated gestures, high energy, bright eyes",
  surprised: "eyes wide, mouth slightly open, genuine shock and disbelief",
  serious: "composed, direct eye contact, focused expression",
  neutral: "",
};

const INTENSITY_WORDS: Record<number, string> = { 1: "subtly", 2: "noticeably", 3: "intensely" };

function buildKlingPrompt(params: {
  cleanedText: string;
  globalEmotion?: string;
  globalIntensity?: number;
  inlineTags?: EmotionTag[];
  actionDescription?: string;
}): string {
  const { cleanedText, globalEmotion, globalIntensity, inlineTags, actionDescription } = params;

  let prompt = `A UGC creator speaking directly to camera, saying: "${cleanedText}" Natural, authentic talking-head style, casual handheld selfie aesthetic.`;

  // Global emotion directive
  if (globalEmotion && globalEmotion !== "neutral") {
    const directive = EMOTION_DIRECTIVES[globalEmotion];
    if (directive) {
      const intensityWord = INTENSITY_WORDS[globalIntensity ?? 2] ?? "noticeably";
      prompt += ` Throughout the video: ${intensityWord} ${directive}.`;
    }
  }

  // Inline emotion tags
  if (inlineTags && inlineTags.length > 0) {
    const inlineDirectives = inlineTags
      .map((t) => {
        const directive = EMOTION_DIRECTIVES[t.emotion];
        if (!directive) return null;
        const intensityWord = INTENSITY_WORDS[t.intensity] ?? "noticeably";
        return `${intensityWord} ${directive}`;
      })
      .filter(Boolean)
      .join("; ");
    if (inlineDirectives) {
      prompt += ` At moments of emphasis: ${inlineDirectives}.`;
    }
  }

  // Action description
  if (actionDescription && actionDescription.trim()) {
    prompt += ` Action: ${actionDescription.trim()}.`;
  }

  return prompt;
}

// ── Language support ───────────────────────────────────────────────────

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", ja: "Japanese", zh: "Mandarin Chinese",
  ar: "Arabic", ru: "Russian",
};

// ── Script generation via OpenRouter ──────────────────────────────────

function buildSystemPrompt(
  hooksCount: number,
  bodiesCount: number,
  ctasCount: number,
  language: string,
): string {
  // Use the maximum count for the plural/angle selectors so they're consistent.
  const count = Math.max(hooksCount, bodiesCount, ctasCount);
  const hookAngles = hooksCount > 1
    ? " Each uses a DIFFERENT angle from the SGE framework below."
    : " Use the BEST angle from the SGE framework below for this product.";
  const bodyAngles = bodiesCount > 1
    ? " Each uses a DIFFERENT structure."
    : " Use whichever structure fits best.";
  const ctaAngles = ctasCount > 1
    ? " Each uses a DIFFERENT invisible-CTA pattern."
    : " Use the most natural-sounding invisible-CTA pattern.";

  // Language block goes FIRST so the model sees it before any English-language style rules.
  const langName = language !== "en" ? (LANGUAGE_NAMES[language] ?? language) : null;
  const languageBlock = langName
    ? `═══ LANGUAGE — ABSOLUTE PRIORITY ═══
ALL output text MUST be written ENTIRELY in ${langName}. This overrides everything else.
• Every single word — hooks, bodies, CTAs, all text fields — must be in ${langName}.
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

${hooksCount} variant${hooksCount > 1 ? "s" : ""}${hookAngles}
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

BODY — ${bodiesCount} variant${bodiesCount > 1 ? "s" : ""} | 5–9 seconds each | 12–22 words max${bodyAngles}
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

CTA — ${ctasCount} variant${ctasCount > 1 ? "s" : ""} | 2–4 seconds each | 5–10 words max${ctaAngles}

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

Return ONLY valid JSON (exactly ${hooksCount} hook${hooksCount > 1 ? "s" : ""}, ${bodiesCount} bod${bodiesCount > 1 ? "ies" : "y"}, ${ctasCount} CTA${ctasCount > 1 ? "s" : ""}). Set duration_seconds to match actual word count at 2.5 words/sec:
{
  "hooks": [{ "text": "...", "duration_seconds": 3, "variant_label": "LATE_DISCOVERY" }${hooksCount > 1 ? ", ..." : ""}],
  "bodies": [{ "text": "...", "duration_seconds": 7, "variant_label": "problem_solution" }${bodiesCount > 1 ? ", ..." : ""}],
  "ctas": [{ "text": "...", "duration_seconds": 3, "variant_label": "soft_recommendation" }${ctasCount > 1 ? ", ..." : ""}]
}`;

  if (language !== "en") {
    // Reminder at the end too — LLMs pay attention to both start and end of the prompt.
    return result + `\n\nFINAL REMINDER: Every word in "text" fields MUST be in ${LANGUAGE_NAMES[language] ?? language}. Zero English. Not even one word.`;
  }
  return result;
}

// ── Category-aware hook angle selection ───────────────────────────────

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

function buildUserPrompt(product: Record<string, unknown>, language: string): string {
  const brandSummary = (product.brand_summary ?? {}) as Record<string, unknown>;
  const langName = language !== "en" ? (LANGUAGE_NAMES[language] ?? language) : null;

  // Language instruction at the TOP of the user message for maximum salience.
  const langHeader = langName
    ? `LANGUAGE: Write the ENTIRE script in ${langName} ONLY. No English words at all — not even one.\n\n`
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

  const base = `${langHeader}Product: ${product.name}
Description: ${product.description}
Price: ${product.price ?? "N/A"} ${product.currency ?? ""}
Brand tone: ${tone}
Target demographic: ${demographic}
Key selling points: ${sellingPoints}${optionalBlock}
${uniqueValueProp ? `Unique value proposition: ${uniqueValueProp}` : ""}
${customerPainPoints ? `Target these pain points: ${customerPainPoints}` : ""}

PRICE NOTE: The product costs ${product.price} ${product.currency ?? ""}. Do NOT use phrases like "just $X" or "only $X" unless this price is clearly budget-friendly for the product category. Present the price truthfully and contextually.

${categoryBlock}

REQUIRED: Every hook and body sentence must contain at least one specific number, timeframe, or named ingredient/feature. No vague claims allowed. "Long-lasting" → "holds for 14 hours". "Most users" → "87% of users". This is non-negotiable.

CALIBRATION INSTRUCTIONS:
- Match the hook angle to a real pain point this demographic actually feels.
- If price is listed and it's a clear value advantage, you may reference it in the hook or body.
- Mirror the brand tone: if "playful" → be light and fun; if "premium" → be aspirational but still authentic.
- Write scripts AS IF the persona IS the target demographic speaking to their peers.
- CTA must be invisible — no "link in bio", no "shop now", no "buy now". End with a natural close that makes viewers want to seek it out themselves.${langName ? `\n\nRemember: every word in the JSON output must be in ${langName}. Native-speaker level, zero English.` : ""}`;

  return base;
}

/** Clamp a number to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Validate and normalize the script structure returned by OpenRouter.
 *  Accepts either a single expectedCount (applied to all three) or separate per-section counts.
 */
function validateScript(
  raw: unknown,
  expectedHooks: number,
  expectedBodies?: number,
  expectedCtas?: number,
): GeneratedScript {
  const hooksExp = expectedHooks;
  const bodiesExp = expectedBodies ?? expectedHooks;
  const ctasExp = expectedCtas ?? expectedHooks;
  const obj = raw as Record<string, unknown>;

  if (
    !obj ||
    !Array.isArray(obj.hooks) ||
    !Array.isArray(obj.bodies) ||
    !Array.isArray(obj.ctas)
  ) {
    throw new Error("Invalid script structure: missing hooks, bodies, or ctas array");
  }

  if (
    obj.hooks.length !== hooksExp ||
    obj.bodies.length !== bodiesExp ||
    obj.ctas.length !== ctasExp
  ) {
    throw new Error(
      `Invalid script structure: expected ${hooksExp} hooks, ${bodiesExp} bodies, ${ctasExp} ctas`,
    );
  }

  const validateSegments = (
    segments: unknown[],
    minDur: number,
    maxDur: number,
  ): ScriptSegment[] =>
    segments.map((s) => {
      const seg = s as Record<string, unknown>;
      if (!seg.text || typeof seg.text !== "string") {
        throw new Error("Invalid script segment: missing text");
      }
      return {
        text: seg.text,
        duration_seconds: clamp(
          typeof seg.duration_seconds === "number" ? seg.duration_seconds : minDur,
          minDur,
          maxDur,
        ),
        variant_label: typeof seg.variant_label === "string" ? seg.variant_label : "",
      };
    });

  return {
    hooks: validateSegments(obj.hooks, 2, 4),
    bodies: validateSegments(obj.bodies, 5, 9),
    ctas: validateSegments(obj.ctas, 2, 4),
  };
}

interface GenerateScriptResult {
  script: GeneratedScript;
  scriptRaw: GeneratedScript;
}

async function generateScript(
  product: Record<string, unknown>,
  hooksCount: number,
  bodiesCount: number,
  ctasCount: number,
  language: string,
): Promise<GenerateScriptResult> {
  const totalSegments = hooksCount + bodiesCount + ctasCount;
  const rawContent = await withRetry(() =>
    callOpenRouter(
      [
        { role: "system", content: buildSystemPrompt(hooksCount, bodiesCount, ctasCount, language) },
        { role: "user", content: buildUserPrompt(product, language) },
      ],
      { maxTokens: totalSegments <= 3 ? 600 : 1500, timeoutMs: 30000, jsonMode: true },
    ),
  );

  // Strip markdown code fences if present
  let cleaned = rawContent.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(cleaned);
  const scriptRaw = validateScript(parsed, hooksCount, bodiesCount, ctasCount);

  // ── Coherence review pass ───────────────────────────────────────────
  try {
    const reviewContent = await callOpenRouter(
      [
        {
          role: "system",
          content:
            "You are a script editor for short-form UGC ads. Review this Hook+Body+CTA combo. " +
            "Score on: non-repetition (0-25), flow (0-25), claim-realism (0-25), cta-fit (0-25). Total 0-100. " +
            "If score < 70, rewrite each segment to fix issues. Return JSON only: " +
            '{ "score": number, "review": string, "revised_hooks": ScriptSegment[], "revised_bodies": ScriptSegment[], "revised_ctas": ScriptSegment[] }. ' +
            "If score >= 70, return originals in revised arrays unchanged.",
        },
        { role: "user", content: JSON.stringify(scriptRaw) },
      ],
      { maxTokens: totalSegments <= 3 ? 800 : 2000, timeoutMs: 30000, jsonMode: true },
    );

    let reviewCleaned = reviewContent.trim();
    if (reviewCleaned.startsWith("```")) {
      reviewCleaned = reviewCleaned
        .replace(/^```(?:json)?\s*/, "")
        .replace(/\s*```$/, "");
    }

    const reviewParsed = JSON.parse(reviewCleaned) as {
      score: number;
      review: string;
      revised_hooks: unknown[];
      revised_bodies: unknown[];
      revised_ctas: unknown[];
    };

    console.log(
      `Coherence review score: ${reviewParsed.score} — ${reviewParsed.review}`,
    );

    const revisedScript = validateScript(
      {
        hooks: reviewParsed.revised_hooks,
        bodies: reviewParsed.revised_bodies,
        ctas: reviewParsed.revised_ctas,
      },
      hooksCount,
      bodiesCount,
      ctasCount,
    );

    return { script: revisedScript, scriptRaw };
  } catch (reviewErr) {
    console.error("Coherence review failed, using raw draft:", reviewErr);
    return { script: scriptRaw, scriptRaw };
  }
}

function trimToWords(input: string, maxWords: number): string {
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function buildFallbackScript(
  product: Record<string, unknown>,
  hooksCount: number,
  bodiesCount: number,
  ctasCount: number,
  _language: string,
): GeneratedScript {
  const variantCount = Math.max(hooksCount, bodiesCount, ctasCount);
  const productNameRaw =
    typeof product.name === "string" && product.name.trim().length > 0
      ? product.name.trim()
      : "this product";
  const productName = trimToWords(productNameRaw, 4);
  const description =
    typeof product.description === "string" ? product.description : "";
  const primaryBenefit =
    description
      .split(/[.!?]/)
      .map((part) => part.trim())
      .find((part) => part.length > 0) ?? "It solves a real day-to-day problem";
  const benefitShort = trimToWords(primaryBenefit, 12);

  const hookTemplates = [
    `If you've struggled with this, try ${productName}.`,
    `I didn't expect ${productName} to work this well.`,
    `Quick review: ${productName} is actually worth it.`,
  ];
  const bodyTemplates = [
    `${productName} is straightforward to use, and ${benefitShort.toLowerCase()}.`,
    `I've been using ${productName}, and the difference was clear within days.`,
    `What I like most about ${productName} is how simple and reliable it feels.`,
  ];
  const ctaTemplates = [
    `Link in bio if you want the same one.`,
    `Check the description for the exact product.`,
    `If this fits you, grab ${productName} today.`,
  ];

  const pick = (templates: string[], i: number, maxWords: number) =>
    trimToWords(templates[i % templates.length], maxWords);

  const hooks: ScriptSegment[] = [];
  const bodies: ScriptSegment[] = [];
  const ctas: ScriptSegment[] = [];

  for (let i = 0; i < hooksCount; i++) {
    hooks.push({
      text: pick(hookTemplates, i, 10),
      duration_seconds: 3,
      variant_label: i === 0 ? "direct_address" : i === 1 ? "social_proof" : "question",
    });
  }
  for (let i = 0; i < bodiesCount; i++) {
    bodies.push({
      text: pick(bodyTemplates, i, 22),
      duration_seconds: 7,
      variant_label: i === 0 ? "value_prop" : i === 1 ? "storytelling" : "problem_solution",
    });
  }
  for (let i = 0; i < ctasCount; i++) {
    ctas.push({
      text: pick(ctaTemplates, i, 10),
      duration_seconds: 3,
      variant_label: i === 0 ? "link_drop" : i === 1 ? "check_description" : "recommendation",
    });
  }

  return { hooks, bodies, ctas };
}

// ── Shared helpers ────────────────────────────────────────────────────

/** Compute credit cost from total segments, quality, and provider.
 *  Per-segment rates are derived from the 9-segment (3+3+3) batch baseline:
 *    standard: 15/9 = 5/3 per seg, hd: 30/9 = 10/3, sora: 42/9 = 14/3
 *  Examples: single (1+1+1=3) std → ceil(3×5/3)=5 ✓; triple (3+3+3=9) std → ceil(9×5/3)=15 ✓
 */
function computeCosts(
  resolvedQuality: string,
  provider: "kling" | "sora" = "kling",
  totalSegments: number,
) {
  const perSegmentRate =
    provider === "sora" ? 14 / 3 :
    resolvedQuality === "hd" ? 10 / 3 :
    5 / 3;
  const creditCost = Math.ceil(totalSegments * perSegmentRate);
  const klingModel = KLING_MODEL[resolvedQuality as keyof typeof KLING_MODEL];
  return { creditCost, klingModel };
}

/** Estimate minimum video duration needed for the given text at ~2.5 words/sec. */
function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).length;
  const seconds = Math.ceil(words / 2.5);
  return seconds <= 5 ? 5 : 10;
}

/** Submit Kling or Sora jobs for all script segments and return job IDs map + actual model used. */
async function submitAllKlingJobs(
  script: GeneratedScript,
  signedImageUrl: string,
  klingModel: string,
  provider: "kling" | "sora" = "kling",
  compositeImageBlob?: Blob,
  language = "en",
): Promise<{ jobIds: Record<string, string>; modelUsed: string }> {
  const jobEntries: Array<[string, string]> = [];
  const jobModels: string[] = [];
  const SEG_KEY = { hooks: "hook", bodies: "body", ctas: "cta" } as const;
  const segmentTypes = ["hooks", "bodies", "ctas"] as const;
  const jobSubmissions = segmentTypes.flatMap((segType) =>
    script[segType].map((segment, i) => {
      const jobKey = `${SEG_KEY[segType]}_${i + 1}`;
      // When script is non-English, include a language hint so Kling's voice synthesis
      // uses the correct language and accent instead of defaulting to English.
      const langName = language !== "en" ? (LANGUAGE_NAMES[language] ?? null) : null;
      const speakingHint = langName ? `, speaking ${langName}` : "";
      const prompt = `A UGC creator speaking directly to camera${speakingHint}, saying: "${segment.text}" Natural, authentic talking-head style, casual handheld selfie aesthetic.`;
      const textDuration = estimateDuration(segment.text);
      const scriptDuration = segment.duration_seconds <= 5 ? 5 : 10;
      const duration = Math.max(textDuration, scriptDuration);

      if (provider === "sora") {
        if (!compositeImageBlob) throw new Error("compositeImageBlob required for Sora provider");
        return withRetry(() =>
          submitSoraJob({ composite_image_blob: compositeImageBlob, prompt, duration })
        ).then((result) => {
          jobModels.push(result.model_name);
          return [jobKey, result.job_id] as [string, string];
        });
      }

      return withRetry(() =>
        submitKlingJob({
          image_url: signedImageUrl,
          script: prompt,
          duration,
          mode: "pro",
          sound: "on",
          model_name: klingModel,
        })
      ).then((result) => {
        if (result.model_name) jobModels.push(result.model_name);
        return [jobKey, result.job_id] as [string, string];
      });
    })
  );

  const settled = await Promise.allSettled(jobSubmissions);
  let successCount = 0;
  for (const result of settled) {
    if (result.status === "fulfilled") {
      jobEntries.push(result.value);
      successCount++;
    } else {
      console.error("[generate-video] job submission failed:", result.reason instanceof Error ? result.reason.message : result.reason);
    }
  }
  if (successCount === 0) {
    throw new Error("All video job submissions failed. The AI service may be temporarily overloaded — please try again in a moment.");
  }
  return { jobIds: Object.fromEntries(jobEntries), modelUsed: jobModels[0] || klingModel };
}

/** Build a GeneratedScript from advanced segment inputs (strip emotion tags, estimate duration). */
function buildScriptFromAdvanced(
  advanced: AdvancedSegmentsInput,
  hooksCount: number,
  bodiesCount: number,
  ctasCount: number,
): GeneratedScript {
  const toSegments = (
    segs: AdvancedSegmentInput[],
    limit: number,
    minDur: number,
    maxDur: number,
  ): ScriptSegment[] =>
    segs.slice(0, limit).map((s) => {
      const cleanedText = stripEmotionTags(s.script_text);
      const wordCount = cleanedText.split(/\s+/).filter(Boolean).length;
      const estimated = Math.round(wordCount / 2.5);
      return {
        text: cleanedText,
        duration_seconds: clamp(estimated || minDur, minDur, maxDur),
        variant_label: "advanced",
      };
    });

  return {
    hooks: toSegments(advanced.hooks, hooksCount, 2, 4),
    bodies: toSegments(advanced.bodies, bodiesCount, 5, 9),
    ctas: toSegments(advanced.ctas, ctasCount, 2, 4),
  };
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
    const { phase, generation_id, override_script, video_provider, video_quality: quality_override } = body;
    const provider = (video_provider === "sora" ? "sora" : "kling") as "kling" | "sora";
    const VALID_LANGUAGES = new Set(["en","es","fr","de","it","pt","ja","zh","ar","ru"]);

    // ══════════════════════════════════════════════════════════════════
    // PHASE "full" — Approve an existing awaiting_approval generation
    // ══════════════════════════════════════════════════════════════════
    if (generation_id) {
      // Look up generation
      const { data: gen, error: genLookupErr } = await sb
        .from("generations")
        .select("*")
        .eq("id", generation_id)
        .single();

      if (genLookupErr || !gen) {
        return errorResponse(ErrorCodes.INVALID_INPUT, "Generation not found", 404, cors);
      }

      // Auth check: owner must match authenticated user
      if (gen.owner_id !== userId) {
        return errorResponse(ErrorCodes.UNAUTHORIZED, "Access denied", 403, cors);
      }

      // Atomic status lock: transition awaiting_approval → locking in a single UPDATE.
      // This prevents concurrent double-approvals from both passing the status check
      // before either one debits credits.
      const { data: lockRows, error: lockErr } = await sb
        .from("generations")
        .update({ status: "locking" })
        .eq("id", generation_id)
        .eq("owner_id", userId)
        .eq("status", "awaiting_approval")
        .select("id");

      if (lockErr || !lockRows || lockRows.length === 0) {
        // Another request may have already transitioned the status.
        // If it's already in progress/completed, treat as idempotent success.
        const { data: currentGen } = await sb
          .from("generations")
          .select("status")
          .eq("id", generation_id)
          .eq("owner_id", userId)
          .maybeSingle();

        const currentStatus = currentGen?.status as string | undefined;
        const inFlightStatuses = new Set([
          "locking",
          "submitting_jobs",
          "generating_segments",
          "stitching",
          "completed",
        ]);

        if (currentStatus && inFlightStatuses.has(currentStatus)) {
          return json(
            {
              data: {
                generation_id,
                status: currentStatus,
                deduplicated: true,
              },
            },
            cors,
            200,
          );
        }

        return errorResponse(
          ErrorCodes.INVALID_INPUT,
          "Generation is no longer awaiting approval (already processing or completed).",
          409,
          cors,
        );
      }

      const resolvedMode = gen.mode as string;
      const generationLanguageRaw = typeof gen.language === "string" ? gen.language : "en";
      const approvedLanguage = VALID_LANGUAGES.has(generationLanguageRaw)
        ? generationLanguageRaw
        : "en";
      // Allow the client to override quality (e.g. user switched standard → HD before approving)
      const resolvedQuality = (quality_override === "hd" || quality_override === "standard")
        ? quality_override
        : gen.video_quality as string;

      // Validate Sora only supports HD
      if (provider === "sora" && resolvedQuality !== "hd") {
        await sb.from("generations").update({ status: "awaiting_approval" }).eq("id", generation_id);
        return errorResponse(ErrorCodes.INVALID_INPUT, "Sora only supports HD quality. Please select HD quality to use Sora.", 400, cors);
      }

      // If quality changed, persist the updated value before charging credits
      if (resolvedQuality !== gen.video_quality) {
        await sb.from("generations").update({ video_quality: resolvedQuality }).eq("id", generation_id);
      }

      // Read stored segment counts from the generation row (fall back to mode-based defaults).
      const genHooksCount = Number.isInteger(gen.hooks_count) && gen.hooks_count >= 1 ? gen.hooks_count : (resolvedMode === "single" ? 1 : 3);
      const genBodiesCount = Number.isInteger(gen.bodies_count) && gen.bodies_count >= 1 ? gen.bodies_count : (resolvedMode === "single" ? 1 : 3);
      const genCtasCount = Number.isInteger(gen.ctas_count) && gen.ctas_count >= 1 ? gen.ctas_count : (resolvedMode === "single" ? 1 : 3);
      const genTotalSegments = genHooksCount + genBodiesCount + genCtasCount;
      const { creditCost, klingModel } = computeCosts(resolvedQuality, provider, genTotalSegments);

      // If override_script provided, validate and save
      let finalScript: GeneratedScript;
      if (override_script) {
        finalScript = validateScript(override_script, genHooksCount, genBodiesCount, genCtasCount);
        await sb
          .from("generations")
          .update({ script: finalScript })
          .eq("id", generation_id);
      } else {
        finalScript = gen.script as GeneratedScript;
      }

      if (!finalScript) {
        // Unlock: revert status so user can retry
        await sb
          .from("generations")
          .update({ status: "awaiting_approval" })
          .eq("id", generation_id);
        return errorResponse(ErrorCodes.INVALID_INPUT, "Generation has no script to approve", 400, cors);
      }

      // ── Plan-based validation for approve flow ──────────────────
      const { data: profileData } = await sb
        .from("profiles")
        .select("plan, role, first_video_discount_used")
        .eq("id", userId)
        .single();

      const approveIsAdmin = profileData?.role === "admin";

      // ── Compute effective cost + check credits ──────────────────
      // first_video_discount_used is a paywall conversion tracking flag only.
      // It tracks whether the user has ever approved a generation, so the paywall
      // can show a "first video" discounted price. No credit reduction is applied here.
      const isFirstVideo = profileData?.first_video_discount_used === false;
      const effectiveCost = creditCost;

      const remaining = await checkCredits(userId);
      if (remaining < effectiveCost) {
        // Unlock: revert status so user can top up and retry
        await sb
          .from("generations")
          .update({ status: "awaiting_approval" })
          .eq("id", generation_id);
        return errorResponse(
          ErrorCodes.INSUFFICIENT_CREDITS,
          `Insufficient credits. You need ${effectiveCost} credits but have ${remaining}. Purchase more or upgrade your plan.`,
          402,
          cors,
        );
      }

      // ── Debit credits ───────────────────────────────────────────
      // Wrapped in try-catch: if debit fails, revert to "awaiting_approval"
      // so the user can retry, instead of being stuck in "locking" forever.
      try {
        await debitCredits(userId, effectiveCost, generation_id);
      } catch (debitErr) {
        captureException(debitErr);
        await sb
          .from("generations")
          .update({ status: "awaiting_approval" })
          .eq("id", generation_id);
        return errorResponse(
          ErrorCodes.INTERNAL_ERROR,
          "Failed to process credits. Your credits were not charged — please try again.",
          500,
          cors,
        );
      }

      if (isFirstVideo) {
        await sb
          .from("profiles")
          .update({ first_video_discount_used: true })
          .eq("id", userId);
      }

      try {
        // ── Update status to submitting_jobs ───────────────────────
        await sb
          .from("generations")
          .update({ status: "submitting_jobs" })
          .eq("id", generation_id);

        const compositePath = gen.composite_image_url as string;

        // ── Generate signed URL for composite image ────────────────
        const { data: klingCompositeUrl, error: klingUrlErr } = await sb.storage
          .from("composite-images")
          .createSignedUrl(compositePath, 7200);

        if (klingUrlErr || !klingCompositeUrl?.signedUrl) {
          throw new Error(
            `Failed to generate signed URL for composite image: ${klingUrlErr?.message}`,
          );
        }

        // ── Download image blob if using Sora (requires file upload) ──
        let compositeImageBlob: Blob | undefined;
        if (provider === "sora") {
          const imgRes = await fetch(klingCompositeUrl.signedUrl);
          if (!imgRes.ok) throw new Error(`Failed to download composite image for Sora: HTTP ${imgRes.status}`);
          compositeImageBlob = await imgRes.blob();
        }

        // ── Submit video jobs ─────────────────────────────────────
        const { jobIds, modelUsed } = await submitAllKlingJobs(
          finalScript,
          klingCompositeUrl.signedUrl,
          klingModel,
          provider,
          compositeImageBlob,
          approvedLanguage,
        );

        // ── Update generation with job IDs and provider ───────────
        const { error: jobUpdateErr } = await sb
          .from("generations")
          .update({
            external_job_ids: jobIds,
            kling_model: modelUsed,
            video_provider: provider,
            status: "generating_segments",
          })
          .eq("id", generation_id);

        if (jobUpdateErr) {
          throw new Error(`Failed to update generation with job IDs: ${jobUpdateErr.message}`);
        }

        return json(
          {
            data: {
              generation_id,
              status: "generating_segments",
              first_video_discount_applied: isFirstVideo,
              credits_charged: effectiveCost,
            },
          },
          cors,
          200,
        );
      } catch (pipelineErr) {
        captureException(pipelineErr);
        const errMsg =
          pipelineErr instanceof Error ? pipelineErr.message : String(pipelineErr);
        console.error("generate-video approval pipeline error:", errMsg);

        try {
          await refundCredits(userId, effectiveCost, generation_id);
          if (isFirstVideo) {
            await sb
              .from("profiles")
              .update({ first_video_discount_used: false })
              .eq("id", userId);
          }
        } catch (refundErr) {
          console.error("Credit refund failed:", refundErr);
        }

        await sb
          .from("generations")
          .update({ status: "failed", error_message: errMsg })
          .eq("id", generation_id);

        throw pipelineErr;
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // New generation: either phase="script" (script-only) or default
    // ══════════════════════════════════════════════════════════════════

    const { product_id, persona_id, mode, quality, composite_image_path, advanced_segments, language = "en" } = body as {
      product_id: string;
      persona_id: string;
      mode?: string;
      quality?: string;
      composite_image_path: string;
      advanced_segments?: AdvancedSegmentsInput;
      language?: string;
    };

    const resolvedLanguage = VALID_LANGUAGES.has(language) ? language : "en";

    if (!product_id) return errorResponse(ErrorCodes.INVALID_INPUT, "product_id is required", 400, cors);
    if (!persona_id) return errorResponse(ErrorCodes.INVALID_INPUT, "persona_id is required", 400, cors);
    if (!composite_image_path) return errorResponse(ErrorCodes.INVALID_INPUT, "composite_image_path is required", 400, cors);
    if (
      typeof composite_image_path !== "string" ||
      composite_image_path.includes("..") ||
      composite_image_path.split("/")[0] !== userId
    ) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Access denied for this composite image", 403, cors);
    }

    const resolvedMode = mode || "single";
    if (resolvedMode !== "single" && resolvedMode !== "triple") {
      return errorResponse(ErrorCodes.INVALID_INPUT, "mode must be 'single' or 'triple'", 400, cors);
    }

    const resolvedQuality = quality || "standard";
    if (resolvedQuality !== "standard" && resolvedQuality !== "hd") {
      return errorResponse(ErrorCodes.INVALID_INPUT, "quality must be 'standard' or 'hd'", 400, cors);
    }

    // Validate Sora only supports HD quality
    if (provider === "sora" && resolvedQuality !== "hd") {
      return errorResponse(ErrorCodes.INVALID_INPUT, "Sora only supports HD quality. Please select HD quality to use Sora.", 400, cors);
    }

    // Segment counts (1–5 per slot; single always 1/1/1; triple defaults to 3/3/3)
    const rawHooks = body.hooks_count;
    const rawBodies = body.bodies_count;
    const rawCtas = body.ctas_count;

    const isSingleMode = resolvedMode === "single";
    const hooksCount = isSingleMode ? 1 : Math.min(5, Math.max(1, Number.isInteger(rawHooks) ? rawHooks : 3));
    const bodiesCount = isSingleMode ? 1 : Math.min(5, Math.max(1, Number.isInteger(rawBodies) ? rawBodies : 3));
    const ctasCount = isSingleMode ? 1 : Math.min(5, Math.max(1, Number.isInteger(rawCtas) ? rawCtas : 3));

    // Validate range explicitly (return 400 if user passed an invalid value intentionally)
    if (!isSingleMode) {
      const invalid = [rawHooks, rawBodies, rawCtas].filter(v => v !== undefined && (!Number.isInteger(v) || v < 1 || v > 5));
      if (invalid.length > 0) {
        return json({ detail: "hooks_count, bodies_count, ctas_count must each be integers between 1 and 5" }, cors, 400);
      }
    }

    const totalSegments = hooksCount + bodiesCount + ctasCount;
    const { creditCost, klingModel } = computeCosts(resolvedQuality, provider, totalSegments);

    // ── 1b. Fetch profile for plan-based validation ────────────────
    const { data: planProfile } = await sb
      .from("profiles")
      .select("plan, role")
      .eq("id", userId)
      .single();

    const userPlan = (planProfile?.plan as string) ?? "free";
    const isAdmin = planProfile?.role === "admin";
    const ADVANCED_PLANS = new Set(["growth", "scale"]);

    // ── 1d. Enforce advanced mode restriction ──────────────────────
    if (advanced_segments && !isAdmin && !ADVANCED_PLANS.has(userPlan)) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Advanced script editor requires Growth or Scale plan. Upgrade to unlock.", 403, cors);
    }

    // ── 2. Verify product ownership (confirmed = true) ────────────

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

    // ── 3. Verify persona ownership (is_active, has selected_image_url)

    const { data: persona, error: persErr } = await sb
      .from("personas")
      .select("*")
      .eq("id", persona_id)
      .eq("owner_id", userId)
      .eq("is_active", true)
      .single();
    if (persErr || !persona) {
      return errorResponse(ErrorCodes.INVALID_INPUT, "Persona not found or inactive", 404, cors);
    }

    if (!persona.selected_image_url) {
      return errorResponse(ErrorCodes.INVALID_INPUT, "Persona has no selected image. Select one first.", 400, cors);
    }

    // ── 4. Security: validate per-segment image paths ─────────────

    if (advanced_segments) {
      for (const segType of ["hooks", "bodies", "ctas"] as const) {
        for (const seg of advanced_segments[segType]) {
          if (seg.image_path && (seg.image_path.includes("..") || seg.image_path.split("/")[0] !== userId)) {
            return errorResponse(ErrorCodes.UNAUTHORIZED, "Access denied for segment image path", 403, cors);
          }
        }
      }
    }

    // ── 5. Compute effective cost (for both script-only and default) ─

    const { data: profileData } = await sb
      .from("profiles")
      .select("first_video_discount_used")
      .eq("id", userId)
      .single();

    const isFirstVideo = profileData?.first_video_discount_used === false;
    const effectiveCost = creditCost;

    // ══════════════════════════════════════════════════════════════════
    // PHASE "script" — Generate script only, no credit debit
    // ══════════════════════════════════════════════════════════════════
    if (phase === "script") {
      // ── Rate limit: max 30 script generations per hour ────────────
      const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
      const { count: recentScripts } = await sb
        .from("generations")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .gte("started_at", oneHourAgo);
      if ((recentScripts ?? 0) >= 30) {
        return errorResponse(
          ErrorCodes.INVALID_INPUT,
          "Rate limit: maximum 30 script generations per hour. Please wait before generating more.",
          429,
          cors,
        );
      }

      // ── Create generation record with awaiting_approval status ───
      const { data: generation, error: genErr } = await sb
        .from("generations")
        .insert({
          owner_id: userId,
          product_id,
          persona_id,
          mode: resolvedMode,
          video_quality: resolvedQuality,
          composite_image_url: composite_image_path,
          language: resolvedLanguage,
          hooks_count: hooksCount,
          bodies_count: bodiesCount,
          ctas_count: ctasCount,
          status: "awaiting_approval",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (genErr || !generation) {
        throw new Error(`Failed to create generation: ${genErr?.message}`);
      }

      const generationId = generation.id;

      let script: GeneratedScript;
      let scriptRaw: GeneratedScript;
      let usedFallback = false;

      try {
        // ── Generate script (with coherence review) ─────────────────
        const generated = await generateScript(product, hooksCount, bodiesCount, ctasCount, resolvedLanguage);
        script = generated.script;
        scriptRaw = generated.scriptRaw;
      } catch (scriptErr) {
        // Fallback instead of failing with 500 so users can still review/edit.
        captureException(scriptErr);
        const errMsg = scriptErr instanceof Error ? scriptErr.message : String(scriptErr);
        console.error("generate-video script-only error, using fallback:", errMsg);
        usedFallback = true;
        script = buildFallbackScript(product, hooksCount, bodiesCount, ctasCount, resolvedLanguage);
        scriptRaw = script;
      }

      // ── Save script to generation record ────────────────────────
      const { error: updateErr } = await sb
        .from("generations")
        .update({ script, script_raw: scriptRaw })
        .eq("id", generationId);

      if (updateErr) {
        throw new Error(`Failed to update generation: ${updateErr.message}`);
      }

      return json(
        {
          data: {
            generation_id: generationId,
            status: "awaiting_approval",
            script,
            credits_to_charge: effectiveCost,
            fallback_used: usedFallback,
          },
        },
        cors,
        201,
      );
    }

    // ══════════════════════════════════════════════════════════════════
    // All generation requests must go through the two-phase review
    // flow: phase:"script" first, then approve with generation_id.
    // The legacy single-call path has been removed to enforce user
    // approval before any credits are debited or video jobs are sent.
    // ══════════════════════════════════════════════════════════════════
    return errorResponse(
      ErrorCodes.INVALID_INPUT,
      "Direct generation is not supported. Generate a script first (phase: 'script'), review it, then approve with generation_id.",
      400,
      cors,
    );

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Authentication required", 401, cors);
    }
    captureException(e);
    console.error("generate-video error:", e);
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Something went wrong generating your content. Please try again.",
      500,
      cors,
    );
  }
});
