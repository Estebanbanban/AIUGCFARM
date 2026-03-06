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

// 1 credit = $1. Kling v2.6 = ~$0.88/single gen → 5cr. Kling v3 = ~$1.76/single → 10cr.
// Credit costs are fixed. first_video_discount_used tracks the one-time purchase price discount (paywall only).
const COSTS = {
  kling: {
    standard: { single: 5, batch: 15 },
    hd:       { single: 10, batch: 30 },
  },
  sora: {
    hd: { single: 14, batch: 42 },  // ~40% premium over Kling HD
  },
} as const;

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

function buildSystemPrompt(count: number, language: string): string {
  const plural = count > 1 ? "s" : "";
  const hookAngles = count > 1
    ? " Each uses a DIFFERENT angle from the list below."
    : " Use the BEST angle from the list below for this product.";
  const bodyAngles = count > 1
    ? " Each uses a DIFFERENT structure."
    : " Use whichever structure fits best.";
  const ctaAngles = count > 1
    ? " Each uses a DIFFERENT pattern."
    : " Use the most natural-sounding pattern.";

  const result = `You are an expert UGC (User-Generated Content) ad scriptwriter for e-commerce brands.
Write scripts in first-person, conversational tone — exactly how a real person speaks to camera. NOT how a marketer writes.

CRITICAL VOICE RULES:
- Sound like a friend sharing something they genuinely love, not a brand announcing a product.
- Use contractions and natural speech patterns ("I've been using", "honestly", "I was like").
- Be SPECIFIC: "lost 8 lbs in 3 weeks" beats "great results". "$30 cheaper" beats "affordable".
- NEVER use: "game-changer", "amazing", "incredible", "life-changing", "must-have" — these sound fake.
- Write at a natural speaking pace: ~2.5 words per second. Set duration_seconds based on actual word count.

---

HOOK — ${count} variant${plural} | 2–4 seconds each | 5–10 words max${hookAngles}
The hook must STOP THE SCROLL in the first 2 seconds. One punchy sentence. No setup.

Available hook angles:
- pain_point: "I used to [problem] until I found this..."
- skeptic_convert: "I was literally about to return this when..."
- specific_result: "I [specific measurable result] using this one thing."
- pattern_interrupt: Unexpected statement that creates a "wait, what?" moment.
- direct_address: "If you have [exact problem], you need to stop scrolling."
- before_after: "My [thing] before vs. after — I can't believe this is real."
- social_proof: "I've seen this everywhere so I finally caved and... wow."
- gatekeeping: "I've been lowkey hiding this for months but I can't anymore."

---

BODY — ${count} variant${plural} | 5–9 seconds each | 12–22 words max${bodyAngles}
Deliver the payoff fast. Cover: what it does → why it works → one proof point.
At 2.5 words/sec: 5s ≈ 12 words, 7s ≈ 17 words, 9s ≈ 22 words. Stay within limits.

CRITICAL BODY RULES (NEVER BREAK):
- The body MUST NOT restate, echo, or mirror the hook's opening problem or pain point. The viewer already heard the hook.
- Do NOT start the body with another problem statement if the hook already opened with one.
- The body must CONTINUE from the hook: deliver proof, sensory detail, specific benefit, or social evidence.
- Assume the hook has already established the problem. The body should answer: "here's what happened / here's why it works / here's the result."

Available body structures:
- problem_solution: "[Problem] was ruining [thing]. This [does X] in [timeframe]. [Specific result]."
- demo_tease: Describe what they'd see if they tried it — specific sensory detail.
- story_beat: One vivid moment of discovery or transformation. First-person, present-tense feel.
- social_proof_stack: "[X people / weeks / uses later] — here's what actually happened."

---

CTA — ${count} variant${plural} | 2–4 seconds each | 5–10 words max${ctaAngles}
One clear action. Low friction. Natural, not pushy. Never just "buy now."

Available CTA patterns:
- link_drop: "Link's in [bio/comments] — I put the exact one I use."
- risk_reversal: "Try it — if it doesn't work, it's fully returnable."
- urgency_soft: "Grab it before [reason] — [link/where to find it]."
- comment_trigger: "Comment [word] and I'll drop the link — seriously."
- recommendation: "If you're dealing with [problem], just try it. I promise."

---

Return ONLY valid JSON (exactly ${count} item${plural} per array). Set duration_seconds to match actual word count at 2.5 words/sec:
{
  "hooks": [{ "text": "...", "duration_seconds": 3, "variant_label": "pain_point" }${count > 1 ? ", ..." : ""}],
  "bodies": [{ "text": "...", "duration_seconds": 7, "variant_label": "problem_solution" }${count > 1 ? ", ..." : ""}],
  "ctas": [{ "text": "...", "duration_seconds": 3, "variant_label": "link_drop" }${count > 1 ? ", ..." : ""}]
}`;

  if (language !== "en") {
    return result + `\n\nCRITICAL: Write ALL script text ENTIRELY in ${LANGUAGE_NAMES[language]}. Do NOT include any English words or phrases.`;
  }
  return result;
}

function buildUserPrompt(product: Record<string, unknown>, language: string): string {
  const brandSummary = (product.brand_summary ?? {}) as Record<string, unknown>;
  let base = `Product: ${product.name}
Description: ${product.description}
Price: ${product.price ?? "N/A"}
Brand tone: ${brandSummary.tone ?? "conversational, authentic"}
Target demographic: ${brandSummary.demographic ?? "general adults"}
Key selling points: ${brandSummary.selling_points ?? "N/A"}

PRICE NOTE: The product costs ${product.price} ${product.currency}. Do NOT use phrases like "just $X" or "only $X" unless this price is clearly budget-friendly for the product category. Present the price truthfully and contextually.

CALIBRATION INSTRUCTIONS:
- Match the hook to a real pain point this demographic actually feels.
- If price is listed and it's a clear value advantage, you may reference it in the hook or body.
- Mirror the brand tone: if "playful" → be light and fun; if "premium" → be aspirational but still authentic.
- Write scripts AS IF the persona IS the target demographic speaking to their peers.`;

  if (language !== "en") {
    base += `\n\nWrite the script ENTIRELY in ${LANGUAGE_NAMES[language]}. No English.`;
  }
  return base;
}

/** Clamp a number to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Validate and normalize the script structure returned by OpenRouter. */
function validateScript(raw: unknown, expectedCount: number): GeneratedScript {
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
    obj.hooks.length !== expectedCount ||
    obj.bodies.length !== expectedCount ||
    obj.ctas.length !== expectedCount
  ) {
    throw new Error(
      `Invalid script structure: expected exactly ${expectedCount} hooks, bodies, and ctas`,
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
  variantCount: number,
  language: string,
): Promise<GenerateScriptResult> {
  const rawContent = await withRetry(() =>
    callOpenRouter(
      [
        { role: "system", content: buildSystemPrompt(variantCount, language) },
        { role: "user", content: buildUserPrompt(product, language) },
      ],
      { maxTokens: variantCount === 1 ? 600 : 1500, timeoutMs: 30000, jsonMode: true },
    ),
  );

  // Strip markdown code fences if present
  let cleaned = rawContent.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(cleaned);
  const scriptRaw = validateScript(parsed, variantCount);

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
      { maxTokens: variantCount === 1 ? 800 : 2000, timeoutMs: 30000, jsonMode: true },
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
      variantCount,
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
  variantCount: number,
  _language: string,
): GeneratedScript {
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

  for (let i = 0; i < variantCount; i++) {
    hooks.push({
      text: pick(hookTemplates, i, 10),
      duration_seconds: 3,
      variant_label: i === 0 ? "direct_address" : i === 1 ? "social_proof" : "question",
    });
    bodies.push({
      text: pick(bodyTemplates, i, 22),
      duration_seconds: 7,
      variant_label: i === 0 ? "value_prop" : i === 1 ? "storytelling" : "problem_solution",
    });
    ctas.push({
      text: pick(ctaTemplates, i, 10),
      duration_seconds: 3,
      variant_label: i === 0 ? "link_drop" : i === 1 ? "check_description" : "recommendation",
    });
  }

  return { hooks, bodies, ctas };
}

// ── Shared helpers ────────────────────────────────────────────────────

/** Compute credit cost and variant count from mode/quality/provider. */
function computeCosts(resolvedMode: string, resolvedQuality: string, provider: "kling" | "sora" = "kling") {
  const variantCount = resolvedMode === "single" ? 1 : 3;
  const providerCosts = provider === "sora"
    ? COSTS.sora[resolvedQuality as keyof typeof COSTS.sora]
    : COSTS.kling[resolvedQuality as keyof typeof COSTS.kling];
  const creditCost = resolvedMode === "single" ? providerCosts.single : providerCosts.batch;
  const klingModel = KLING_MODEL[resolvedQuality as keyof typeof KLING_MODEL];
  return { variantCount, creditCost, klingModel };
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
  variantCount: number,
): GeneratedScript {
  const toSegments = (
    segs: AdvancedSegmentInput[],
    minDur: number,
    maxDur: number,
  ): ScriptSegment[] =>
    segs.slice(0, variantCount).map((s) => {
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
    hooks: toSegments(advanced.hooks, 2, 4),
    bodies: toSegments(advanced.bodies, 5, 9),
    ctas: toSegments(advanced.ctas, 2, 4),
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

      const { variantCount, creditCost, klingModel } = computeCosts(resolvedMode, resolvedQuality, provider);

      // If override_script provided, validate and save
      let finalScript: GeneratedScript;
      if (override_script) {
        finalScript = validateScript(override_script, variantCount);
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
      await debitCredits(userId, effectiveCost, generation_id);

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

    const { variantCount, creditCost, klingModel } = computeCosts(resolvedMode, resolvedQuality, provider);

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
        const generated = await generateScript(product, variantCount, resolvedLanguage);
        script = generated.script;
        scriptRaw = generated.scriptRaw;
      } catch (scriptErr) {
        // Fallback instead of failing with 500 so users can still review/edit.
        captureException(scriptErr);
        const errMsg = scriptErr instanceof Error ? scriptErr.message : String(scriptErr);
        console.error("generate-video script-only error, using fallback:", errMsg);
        usedFallback = true;
        script = buildFallbackScript(product, variantCount, resolvedLanguage);
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
