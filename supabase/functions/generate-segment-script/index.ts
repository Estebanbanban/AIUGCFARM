import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { callOpenRouter } from "../_shared/openrouter.ts";
import { withRetry } from "../_shared/retry.ts";

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", ja: "Japanese", zh: "Mandarin Chinese",
  ar: "Arabic", ru: "Russian",
};

type SegmentType = "hook" | "body" | "cta";

const SEGMENT_SYSTEM_PROMPTS: Record<SegmentType, string> = {
  hook: `You are an expert UGC scriptwriter. Write ONE hook segment (2–4 seconds, 5–10 words max).
The hook must STOP THE SCROLL in the first 2 seconds. One punchy sentence. No setup.
First-person, conversational tone. Sound like a friend sharing something genuine, not a brand.
NEVER use: "game-changer", "amazing", "incredible", "life-changing", "must-have".

Available hook angles: pain_point, skeptic_convert, specific_result, pattern_interrupt, direct_address, before_after, social_proof, gatekeeping.

Return ONLY valid JSON:
{"text": "...", "duration_seconds": 3, "variant_label": "pain_point"}`,

  body: `You are an expert UGC scriptwriter. Write ONE body segment (5–9 seconds, 12–22 words max).
Deliver the payoff fast. Cover: what it does → why it works → one proof point.
At 2.5 words/sec: 5s ≈ 12 words, 7s ≈ 17 words, 9s ≈ 22 words.
First-person, conversational tone. Be specific with numbers and details.
NEVER use: "game-changer", "amazing", "incredible", "life-changing", "must-have".

Available body structures: problem_solution, demo_tease, story_beat, social_proof_stack.

Return ONLY valid JSON:
{"text": "...", "duration_seconds": 7, "variant_label": "problem_solution"}`,

  cta: `You are an expert UGC scriptwriter. Write ONE CTA segment (2–4 seconds, 5–10 words max).
One clear action. Low friction. Natural, not pushy. Never just "buy now."
First-person, conversational tone.

Available CTA patterns: link_drop, risk_reversal, urgency_soft, comment_trigger, recommendation.

Return ONLY valid JSON:
{"text": "...", "duration_seconds": 3, "variant_label": "link_drop"}`,
};

function buildUserPrompt(
  product: Record<string, unknown>,
  segmentType: SegmentType,
  variantIndex: number,
  ctaStyle?: string,
  ctaCommentKeyword?: string,
  language = "en",
): string {
  const brandSummary = (product.brand_summary ?? {}) as Record<string, unknown>;
  let base = `Product: ${product.name}
Description: ${product.description}
Price: ${product.price ?? "N/A"}
Brand tone: ${brandSummary.tone ?? "conversational, authentic"}
Target demographic: ${brandSummary.demographic ?? "general adults"}
Key selling points: ${brandSummary.selling_points ?? "N/A"}
Variant index: ${variantIndex + 1} (use a DIFFERENT angle than the most obvious one)`;

  if (segmentType === "cta" && ctaStyle && ctaStyle !== "auto") {
    base += `\nCTA style constraint: ${ctaStyle}`;
    if (ctaStyle === "comment_keyword" && ctaCommentKeyword) {
      base += ` — keyword: "${ctaCommentKeyword}"`;
    }
  }

  if (language !== "en") {
    base += `\n\nWrite ENTIRELY in ${LANGUAGE_NAMES[language]}. No English.`;
  }

  return base;
}

const DURATION_BOUNDS: Record<SegmentType, [number, number]> = {
  hook: [2, 4],
  body: [5, 9],
  cta: [2, 4],
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

    const {
      product_id,
      persona_id,
      segment_type,
      variant_index = 0,
      cta_style,
      cta_comment_keyword,
      language = "en",
    } = await req.json();

    const VALID_LANGUAGES = new Set(["en","es","fr","de","it","pt","ja","zh","ar","ru"]);
    const resolvedLanguage = VALID_LANGUAGES.has(language) ? language : "en";

    if (!product_id) return json({ detail: "product_id is required" }, cors, 400);
    if (!persona_id) return json({ detail: "persona_id is required" }, cors, 400);
    if (!segment_type || !["hook", "body", "cta"].includes(segment_type)) {
      return json({ detail: "segment_type must be 'hook', 'body', or 'cta'" }, cors, 400);
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
      return json({ detail: "Product not found or not confirmed" }, cors, 404);
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
      return json({ detail: "Persona not found or inactive" }, cors, 404);
    }

    const seg = segment_type as SegmentType;
    const [minDur, maxDur] = DURATION_BOUNDS[seg];

    const systemPrompt = resolvedLanguage !== "en"
      ? SEGMENT_SYSTEM_PROMPTS[seg] + `\n\nCRITICAL: Write the script text ENTIRELY in ${LANGUAGE_NAMES[resolvedLanguage]}. No English.`
      : SEGMENT_SYSTEM_PROMPTS[seg];

    const rawContent = await withRetry(() =>
      callOpenRouter(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserPrompt(product, seg, variant_index, cta_style, cta_comment_keyword, resolvedLanguage) },
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
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("generate-segment-script error:", e);
    return json(
      { detail: "Failed to generate segment script. Please try again." },
      cors,
      500,
    );
  }
});
