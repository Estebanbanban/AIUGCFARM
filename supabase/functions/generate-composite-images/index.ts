import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { withRetry } from "../_shared/retry.ts";
import { generateCompositeFromImages } from "../_shared/nanobanana.ts";

const COMPOSITE_COUNT = 4;

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const { product_id, persona_id, format = "9:16" } = await req.json();

    if (!product_id) return json({ detail: "product_id is required" }, cors, 400);
    if (!persona_id) return json({ detail: "persona_id is required" }, cors, 400);
    if (format !== "9:16" && format !== "16:9") {
      return json({ detail: "format must be '9:16' or '16:9'" }, cors, 400);
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

    // Verify persona ownership + has selected image
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
      return json({ detail: "Persona has no selected image. Select one first." }, cors, 400);
    }

    // Persona signed URL (10 min)
    const { data: personaSignedUrlData, error: personaSignedUrlErr } = await sb
      .storage
      .from("persona-images")
      .createSignedUrl(persona.selected_image_url, 600);
    if (personaSignedUrlErr || !personaSignedUrlData?.signedUrl) {
      throw new Error(`Failed to sign persona image URL: ${personaSignedUrlErr?.message}`);
    }
    const personaSignedUrl = personaSignedUrlData.signedUrl;

    // Product image URL
    const productImageUrl = (product.images as string[])?.[0] ?? "";
    if (!productImageUrl) throw new Error("Product has no images available");

    let resolvedProductImageUrl = productImageUrl;
    if (!productImageUrl.startsWith("http")) {
      const { data: prodSignedUrlData, error: prodSignedUrlErr } = await sb
        .storage
        .from("product-images")
        .createSignedUrl(productImageUrl, 600);
      if (prodSignedUrlErr || !prodSignedUrlData?.signedUrl) {
        throw new Error(`Failed to sign product image URL: ${prodSignedUrlErr?.message}`);
      }
      resolvedProductImageUrl = prodSignedUrlData.signedUrl;
    }

    // Scene prompt from persona attributes (for context)
    const scenePrompt = (persona.attributes as Record<string, unknown>)
      ?.scene_prompt as string | undefined;

    // Generate COMPOSITE_COUNT composites — staggered to avoid Gemini 500 bursts.
    // Keep retries bounded so the caller never waits indefinitely.
    const staggeredTasks = Array.from({ length: COMPOSITE_COUNT }, (_, i) =>
      new Promise<Awaited<ReturnType<typeof generateCompositeFromImages>>>((resolve, reject) => {
        setTimeout(() => {
          withRetry(
            () => generateCompositeFromImages(
              personaSignedUrl,
              resolvedProductImageUrl,
              scenePrompt,
              format as "9:16" | "16:9",
            ),
            3,   // attempts
            1000, // 1s base → 1s, 2s between retries
          ).then(resolve).catch(reject);
        }, i * 500); // stagger each by 500ms
      })
    );
    const compositeResults = await Promise.allSettled(staggeredTasks);

    // Upload successful composites
    const results: Array<{ path: string; signed_url: string }> = [];

    for (const result of compositeResults) {
      if (result.status === "rejected") {
        console.error("Composite generation failed:", result.reason);
        continue;
      }
      const composite = result.value;
      const ext = composite.mimeType.includes("png") ? "png" : "jpg";
      const storagePath = `${userId}/preview/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await sb.storage
        .from("composite-images")
        .upload(storagePath, composite.data, {
          contentType: composite.mimeType,
          upsert: false,
        });

      if (uploadErr) {
        console.error(`Composite upload failed: ${uploadErr.message}`);
        continue;
      }

      const { data: signedData } = await sb.storage
        .from("composite-images")
        .createSignedUrl(storagePath, 3600); // 1h for user to preview

      if (signedData?.signedUrl) {
        results.push({ path: storagePath, signed_url: signedData.signedUrl });
      }
    }

    if (results.length === 0) {
      throw new Error("All composite image generations failed");
    }

    return json({ data: { images: results } }, cors, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("generate-composite-images error:", e);
    return json(
      { detail: msg || "Failed to generate composite images. Please try again." },
      cors,
      500,
    );
  }
});
