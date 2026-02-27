import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { checkCredits, debitCredits, refundCredits } from "../_shared/credits.ts";
import { callOpenRouter } from "../_shared/openrouter.ts";
import { withRetry } from "../_shared/retry.ts";
import { submitKlingJob } from "../_shared/kling.ts";

// Credits per segment set  -  HD (kling-v3) costs 2× standard (kling-v2-6)
const COSTS = {
  standard: { single: 3, batch: 9 },
  hd:       { single: 6, batch: 18 },
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

// ── Script generation via OpenRouter ──────────────────────────────────

function buildSystemPrompt(count: number): string {
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

  return `You are an expert UGC (User-Generated Content) ad scriptwriter for e-commerce brands.
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
}

function buildUserPrompt(product: Record<string, unknown>): string {
  const brandSummary = (product.brand_summary ?? {}) as Record<string, unknown>;
  return `Product: ${product.name}
Description: ${product.description}
Price: ${product.price ?? "N/A"}
Brand tone: ${brandSummary.tone ?? "conversational, authentic"}
Target demographic: ${brandSummary.demographic ?? "general adults"}
Key selling points: ${brandSummary.selling_points ?? "N/A"}

CALIBRATION INSTRUCTIONS:
- Match the hook to a real pain point this demographic actually feels.
- If price is listed and it's a clear value advantage, you may reference it in the hook or body.
- Mirror the brand tone: if "playful" → be light and fun; if "premium" → be aspirational but still authentic.
- Write scripts AS IF the persona IS the target demographic speaking to their peers.`;
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

async function generateScript(
  product: Record<string, unknown>,
  variantCount: number,
): Promise<GeneratedScript> {
  const rawContent = await withRetry(() =>
    callOpenRouter(
      [
        { role: "system", content: buildSystemPrompt(variantCount) },
        { role: "user", content: buildUserPrompt(product) },
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
  return validateScript(parsed, variantCount);
}

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    // ── 1. Validate input ──────────────────────────────────────────

    const { product_id, persona_id, mode, quality, composite_image_path } = await req.json();

    if (!product_id) return json({ detail: "product_id is required" }, cors, 400);
    if (!persona_id) return json({ detail: "persona_id is required" }, cors, 400);
    if (!composite_image_path) return json({ detail: "composite_image_path is required" }, cors, 400);

    const resolvedMode = mode || "single";
    if (resolvedMode !== "single" && resolvedMode !== "triple") {
      return json({ detail: "mode must be 'single' or 'triple'" }, cors, 400);
    }

    const resolvedQuality = quality || "standard";
    if (resolvedQuality !== "standard" && resolvedQuality !== "hd") {
      return json({ detail: "quality must be 'standard' or 'hd'" }, cors, 400);
    }

    const variantCount = resolvedMode === "single" ? 1 : 3;
    const creditCost = resolvedMode === "single"
      ? COSTS[resolvedQuality as keyof typeof COSTS].single
      : COSTS[resolvedQuality as keyof typeof COSTS].batch;
    const klingModel = KLING_MODEL[resolvedQuality as keyof typeof KLING_MODEL];

    // ── 2. Verify product ownership (confirmed = true) ────────────

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

    // ── 3. Verify persona ownership (is_active, has selected_image_url)

    const { data: persona, error: persErr } = await sb
      .from("personas")
      .select("*")
      .eq("id", persona_id)
      .eq("owner_id", userId)
      .eq("is_active", true)
      .single();
    if (persErr || !persona) {
      return json({ detail: "Persona not found or inactive" }, cors, 404);
    }

    if (!persona.selected_image_url) {
      return json(
        { detail: "Persona has no selected image. Select one first." },
        cors,
        400,
      );
    }

    // ── 4. Check credits ───────────────────────────────────────────

    const remaining = await checkCredits(userId);
    if (remaining < creditCost) {
      return json(
        {
          detail: `Insufficient credits. You need ${creditCost} credits but have ${remaining}. Purchase more or upgrade your plan.`,
        },
        cors,
        402,
      );
    }

    // ── 5. Create generation record ────────────────────────────────

    const { data: generation, error: genErr } = await sb
      .from("generations")
      .insert({
        owner_id: userId,
        product_id,
        persona_id,
        mode: resolvedMode,
        video_quality: resolvedQuality,
        status: "scripting",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (genErr || !generation) {
      throw new Error(`Failed to create generation: ${genErr?.message}`);
    }

    const generationId = generation.id;

    // ── 6. Debit credits atomically ────────────────────────────────

    await debitCredits(userId, creditCost, generationId);

    try {
      // ── 7. Generate script ──────────────────────────────────────────

      const script = await generateScript(product, variantCount);

      // ── 8. Save script + composite path, update status ─────────────

      const { error: updateErr } = await sb
        .from("generations")
        .update({
          script,
          composite_image_url: composite_image_path, // pre-generated by user
          status: "submitting_jobs",
        })
        .eq("id", generationId);

      if (updateErr) {
        throw new Error(`Failed to update generation: ${updateErr.message}`);
      }

      // ── 9. Generate signed URL for Kling (2h expiry) ───────────────

      const { data: klingCompositeUrl, error: klingUrlErr } = await sb.storage
        .from("composite-images")
        .createSignedUrl(composite_image_path, 7200);

      if (klingUrlErr || !klingCompositeUrl?.signedUrl) {
        throw new Error(
          `Failed to generate Kling-accessible signed URL: ${klingUrlErr?.message}`,
        );
      }

      // ── 14. Submit 9 Kling video generation jobs ──────────────────

      // Build all 9 job submissions and run in parallel
      const jobEntries: Array<[string, string]> = [];
      const SEG_KEY = { hooks: "hook", bodies: "body", ctas: "cta" } as const;
      const segmentTypes = ["hooks", "bodies", "ctas"] as const;
      const jobSubmissions = segmentTypes.flatMap((segType) =>
        script[segType].map((segment, i) => {
          const jobKey = `${SEG_KEY[segType]}_${i + 1}`; // hook_1, body_1, cta_1, etc.
          return withRetry(() =>
            submitKlingJob({
              image_url: klingCompositeUrl.signedUrl,
              script: segment.text,
              duration: segment.duration_seconds <= 5 ? 5 : 10, // Kling only accepts 5 or 10
              mode: "std",
              model_name: klingModel,
            })
          ).then((result) => [jobKey, result.job_id] as [string, string]);
        })
      );

      jobEntries.push(...await Promise.all(jobSubmissions));
      const jobIds: Record<string, string> = Object.fromEntries(jobEntries);

      // ── 15. Update generation with job IDs and status ─────────────

      const { error: jobUpdateErr } = await sb
        .from("generations")
        .update({
          external_job_ids: jobIds,
          status: "generating_segments",
        })
        .eq("id", generationId);

      if (jobUpdateErr) {
        throw new Error(`Failed to update generation with job IDs: ${jobUpdateErr.message}`);
      }

      // ── 16. Return response ───────────────────────────────────────

      return json(
        {
          data: {
            generation_id: generationId,
            status: "generating_segments",
          },
        },
        cors,
        201,
      );
    } catch (pipelineErr) {
      // ── Failure after credit debit: refund + mark failed ─────────
      const errMsg =
        pipelineErr instanceof Error ? pipelineErr.message : String(pipelineErr);

      console.error("generate-batch pipeline error:", errMsg);

      // Refund credits
      try {
        await refundCredits(userId, creditCost, generationId);
      } catch (refundErr) {
        console.error("Credit refund failed:", refundErr);
      }

      // Mark generation as failed
      await sb
        .from("generations")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", generationId);

      throw pipelineErr;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("generate-video error:", e);
    return json(
      { detail: "Something went wrong generating your content. Please try again." },
      cors,
      500,
    );
  }
});
