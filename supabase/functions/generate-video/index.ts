import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { checkCredits, debitCredits, refundCredits } from "../_shared/credits.ts";
import { callOpenRouter } from "../_shared/openrouter.ts";
import { withRetry } from "../_shared/retry.ts";
import { submitKlingJob } from "../_shared/kling.ts";

const NANOBANANA_API_KEY = Deno.env.get("NANOBANANA_API_KEY")!;
const NANOBANANA_BASE_URL =
  Deno.env.get("NANOBANANA_BASE_URL") || "https://api.nanobanana.com/v1";

// Credits per segment set — HD (kling-v3) costs 2× standard (kling-v2-6)
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
  return `You are an expert UGC (User-Generated Content) ad scriptwriter for e-commerce brands.
Write scripts in first-person, casual, authentic tone — as if a real person is speaking directly to camera.
Write SPOKEN DIALOGUE ONLY. No stage directions, no camera notes.

Generate:
- ${count} HOOK variant${plural} (3-5 seconds each, ~2.5 words/second): Opening line${plural} that stop the scroll.${count > 1 ? " Each uses a DIFFERENT persuasion angle." : ""}
- ${count} BODY variant${plural} (5-10 seconds each): Product benefits and proof.${count > 1 ? " Each uses a DIFFERENT angle." : ""}
- ${count} CTA variant${plural} (3-5 seconds each): Urgency-driven close.${count > 1 ? " Each uses a DIFFERENT angle." : ""}

Return ONLY valid JSON matching this exact structure (exactly ${count} item${plural} in each array):
{
  "hooks": [{ "text": "...", "duration_seconds": 5, "variant_label": "curiosity" }${count > 1 ? ", ..." : ""}],
  "bodies": [{ "text": "...", "duration_seconds": 8, "variant_label": "benefits" }${count > 1 ? ", ..." : ""}],
  "ctas": [{ "text": "...", "duration_seconds": 4, "variant_label": "urgency" }${count > 1 ? ", ..." : ""}]
}`;
}

function buildUserPrompt(product: Record<string, unknown>): string {
  const brandSummary = (product.brand_summary ?? {}) as Record<string, unknown>;
  return `Product: ${product.name}
Description: ${product.description}
Price: ${product.price ?? "N/A"}
Brand tone: ${brandSummary.tone ?? "N/A"}
Target demographic: ${brandSummary.demographic ?? "N/A"}
Key selling points: ${brandSummary.selling_points ?? "N/A"}`;
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
    hooks: validateSegments(obj.hooks, 3, 5),
    bodies: validateSegments(obj.bodies, 5, 10),
    ctas: validateSegments(obj.ctas, 3, 5),
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

// ── Composite image via NanoBanana ───────────────────────────────────

async function generateCompositeImage(
  personaImageUrl: string,
  productImageUrl: string,
): Promise<string> {
  const res = await fetch(`${NANOBANANA_BASE_URL}/images/composite`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NANOBANANA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      person_image_url: personaImageUrl,
      product_image_url: productImageUrl,
      style: "ugc_natural",
      width: 768,
      height: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Composite image generation failed: ${err}`);
  }

  const body = await res.json();
  return body.image_url;
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

    const { product_id, persona_id, mode, quality } = await req.json();

    if (!product_id) return json({ detail: "product_id is required" }, cors, 400);
    if (!persona_id) return json({ detail: "persona_id is required" }, cors, 400);

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
      // ── 7. Generate persona signed URL (storage path -> signed URL)

      const { data: personaSignedUrlData, error: personaSignedUrlErr } = await sb
        .storage
        .from("persona-images")
        .createSignedUrl(persona.selected_image_url, 600); // 10 min expiry

      if (personaSignedUrlErr || !personaSignedUrlData?.signedUrl) {
        throw new Error(
          `Failed to generate signed URL for persona image: ${personaSignedUrlErr?.message}`,
        );
      }

      const personaSignedUrl = personaSignedUrlData.signedUrl;

      // ── 8. Product image URL ──────────────────────────────────────

      const productImageUrl = (product.images as string[])?.[0] ?? "";
      if (!productImageUrl) {
        throw new Error("Product has no images available");
      }

      // Generate signed URL for product image if it's a storage path
      let resolvedProductImageUrl = productImageUrl;
      if (!productImageUrl.startsWith("http")) {
        const { data: prodSignedUrlData, error: prodSignedUrlErr } = await sb
          .storage
          .from("product-images")
          .createSignedUrl(productImageUrl, 600);

        if (prodSignedUrlErr || !prodSignedUrlData?.signedUrl) {
          throw new Error(
            `Failed to generate signed URL for product image: ${prodSignedUrlErr?.message}`,
          );
        }
        resolvedProductImageUrl = prodSignedUrlData.signedUrl;
      }

      // ── 9. Run script + composite in parallel ────────────────────

      const [script, compositeExternalUrl] = await Promise.all([
        generateScript(product, variantCount),
        withRetry(() =>
          generateCompositeImage(personaSignedUrl, resolvedProductImageUrl),
        ),
      ]);

      // ── 10. Upload composite image to Supabase Storage ───────────

      const compositeRes = await fetch(compositeExternalUrl);
      if (!compositeRes.ok) {
        throw new Error("Failed to download composite image from NanoBanana");
      }
      const compositeBlob = await compositeRes.blob();
      const compositeStoragePath = `${userId}/${generationId}/composite.png`;

      const { error: uploadErr } = await sb.storage
        .from("composite-images")
        .upload(compositeStoragePath, compositeBlob, {
          contentType: "image/png",
          upsert: false,
        });
      if (uploadErr) {
        throw new Error(`Composite image upload failed: ${uploadErr.message}`);
      }

      // ── 11. Generate signed URL for the response ─────────────────

      const { data: compositeSignedData, error: compositeSignedErr } = await sb
        .storage
        .from("composite-images")
        .createSignedUrl(compositeStoragePath, 3600); // 1 hour expiry

      if (compositeSignedErr || !compositeSignedData?.signedUrl) {
        throw new Error(
          `Failed to generate signed URL for composite: ${compositeSignedErr?.message}`,
        );
      }

      // ── 12. Save script + composite, update status to submitting_jobs ──

      const { error: updateErr } = await sb
        .from("generations")
        .update({
          script,
          composite_image_url: compositeStoragePath, // store PATH, not signed URL
          status: "submitting_jobs",
        })
        .eq("id", generationId);

      if (updateErr) {
        throw new Error(`Failed to update generation: ${updateErr.message}`);
      }

      // ── 13. Generate signed URL for Kling to access composite ────

      const { data: klingCompositeUrl, error: klingUrlErr } = await sb.storage
        .from("composite-images")
        .createSignedUrl(compositeStoragePath, 7200); // 2h for Kling to access

      if (klingUrlErr || !klingCompositeUrl?.signedUrl) {
        throw new Error(
          `Failed to generate Kling-accessible signed URL: ${klingUrlErr?.message}`,
        );
      }

      // ── 14. Submit 9 Kling video generation jobs ──────────────────

      // Build all 9 job submissions and run in parallel
      const jobEntries: Array<[string, string]> = [];
      const segmentTypes = ["hooks", "bodies", "ctas"] as const;
      const jobSubmissions = segmentTypes.flatMap((segType) =>
        script[segType].map((segment, i) => {
          const jobKey = `${segType.slice(0, -1)}_${i + 1}`; // hook_1, body_1, cta_1, etc.
          return withRetry(() =>
            submitKlingJob({
              image_url: klingCompositeUrl.signedUrl,
              script: segment.text,
              duration: segment.duration_seconds,
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
