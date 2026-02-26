import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { checkCredits, debitCredit } from "../_shared/credits.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const NANOBANANA_API_KEY = Deno.env.get("NANOBANANA_API_KEY")!;
const NANOBANANA_BASE_URL =
  Deno.env.get("NANOBANANA_BASE_URL") || "https://api.nanobanana.com/v1";
const KLING_API_KEY = Deno.env.get("KLING_API_KEY")!;
const KLING_BASE_URL =
  Deno.env.get("KLING_BASE_URL") || "https://api.klingai.com/v1";

interface ScriptSegment {
  hook: string;
  body: string;
  cta: string;
}

/** Generate a UGC video script via OpenAI. */
async function generateScript(
  product: Record<string, unknown>,
  persona: Record<string, unknown>,
): Promise<ScriptSegment> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You write short UGC-style video scripts. Return JSON with keys: "hook" (attention grabber, 2-3 seconds), "body" (product demo/benefits, 10-15 seconds), "cta" (call to action, 3-5 seconds). Each value is the spoken dialogue for that segment. Keep it natural and conversational.`,
        },
        {
          role: "user",
          content: `Product: ${product.name}\nDescription: ${product.description}\nPrice: ${product.price ?? "N/A"}\nBrand summary: ${JSON.stringify(product.brand_summary ?? {})}\n\nPersona name: ${persona.name}\nPersona attributes: ${JSON.stringify(persona.attributes)}`,
        },
      ],
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Script generation failed: ${err}`);
  }

  const body = await res.json();
  return JSON.parse(body.choices[0].message.content);
}

/** Generate a composite image (persona + product) via NanoBanana. */
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

/** Submit video generation jobs to Kling 3.0 API. */
async function submitKlingJobs(
  compositeImageUrl: string,
  script: ScriptSegment,
): Promise<Record<string, string>> {
  const segments = ["hook", "body", "cta"] as const;
  const jobIds: Record<string, string> = {};

  for (const segment of segments) {
    const res = await fetch(`${KLING_BASE_URL}/videos/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KLING_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "kling-3.0",
        input: {
          image_url: compositeImageUrl,
          prompt: script[segment],
          duration: segment === "body" ? 10 : 5,
        },
        output: {
          format: "mp4",
          resolution: "1080p",
          aspect_ratio: "9:16",
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Kling job submission failed for ${segment}: ${err}`);
    }

    const body = await res.json();
    jobIds[segment] = body.job_id ?? body.id;
  }

  return jobIds;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const { product_id, persona_id, mode } = await req.json();

    if (!product_id) return json({ detail: "product_id is required" }, cors, 400);
    if (!persona_id) return json({ detail: "persona_id is required" }, cors, 400);

    // Check credits
    const remaining = await checkCredits(userId);
    if (remaining < 1) {
      return json(
        { detail: "Insufficient credits. Purchase more or upgrade your plan." },
        cors,
        402,
      );
    }

    // Fetch product
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

    // Fetch persona
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

    // Create generation record
    const { data: generation, error: genErr } = await sb
      .from("generations")
      .insert({
        owner_id: userId,
        product_id,
        persona_id,
        mode: mode || "easy",
        status: "scripting",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (genErr || !generation) {
      throw new Error(`Failed to create generation: ${genErr?.message}`);
    }

    const generationId = generation.id;

    // Debit credit (after generation record exists for reference)
    await debitCredit(userId, generationId);

    try {
      // Step 1: Generate script
      const script = await generateScript(product, persona);

      await sb
        .from("generations")
        .update({ script, status: "generating_image" })
        .eq("id", generationId);

      // Step 2: Generate composite image
      const productImageUrl =
        (product.images as string[])?.[0] ?? "";
      const compositeUrl = await generateCompositeImage(
        persona.selected_image_url,
        productImageUrl,
      );

      // Upload composite to storage
      const compositeRes = await fetch(compositeUrl);
      const compositeBlob = await compositeRes.blob();
      const compositePath = `${userId}/${generationId}/composite.png`;

      await sb.storage
        .from("composite-images")
        .upload(compositePath, compositeBlob, {
          contentType: "image/png",
          upsert: false,
        });

      const {
        data: { publicUrl: storedCompositeUrl },
      } = sb.storage.from("composite-images").getPublicUrl(compositePath);

      await sb
        .from("generations")
        .update({
          composite_image_url: storedCompositeUrl,
          status: "generating_video",
        })
        .eq("id", generationId);

      // Step 3: Submit Kling video jobs
      const jobIds = await submitKlingJobs(storedCompositeUrl, script);

      await sb
        .from("generations")
        .update({ external_job_ids: jobIds })
        .eq("id", generationId);

      return json(
        {
          data: {
            generation_id: generationId,
            status: "generating_video",
            script,
            composite_image_url: storedCompositeUrl,
          },
        },
        cors,
        201,
      );
    } catch (pipelineErr) {
      // Mark generation as failed
      const errMsg =
        pipelineErr instanceof Error ? pipelineErr.message : String(pipelineErr);
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
    return json({ detail: msg || "Internal error" }, cors, 500);
  }
});
