import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { withRetry } from "../_shared/retry.ts";
import { generateCompositeFromImages } from "../_shared/nanobanana.ts";
import type { ProductReferenceContext } from "../_shared/nanobanana.ts";

const MAX_PRODUCT_REFERENCE_IMAGES = 4;

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    const { product_id, persona_id, format = "9:16", custom_scene_prompt, pose_variant } = await req.json();

    // pose_variant: optional 1 | 2 | 3 — only the body pose hint varies; nothing else changes
    const resolvedPoseVariant: 1 | 2 | 3 | undefined =
      pose_variant === 1 || pose_variant === 2 || pose_variant === 3 ? pose_variant : undefined;

    if (!product_id) return json({ detail: "product_id is required" }, cors, 400);
    if (!persona_id) return json({ detail: "persona_id is required" }, cors, 400);
    if (format !== "9:16" && format !== "16:9") {
      return json({ detail: "format must be '9:16' or '16:9'" }, cors, 400);
    }

    // Verify product + persona ownership in parallel
    const [productResult, personaResult] = await Promise.all([
      sb.from("products").select("*").eq("id", product_id).eq("owner_id", userId).eq("confirmed", true).single(),
      sb.from("personas").select("*").eq("id", persona_id).eq("owner_id", userId).eq("is_active", true).single(),
    ]);
    const { data: product, error: prodErr } = productResult;
    if (prodErr || !product) {
      return json({ detail: "Product not found or not confirmed" }, cors, 404);
    }
    const { data: persona, error: persErr } = personaResult;
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

    // Product image URLs
    const productImagePaths = ((product.images as string[]) ?? [])
      .filter((img) => typeof img === "string" && img.trim().length > 0)
      .slice(0, MAX_PRODUCT_REFERENCE_IMAGES);
    if (productImagePaths.length === 0) {
      throw new Error("Product has no images available");
    }

    // Batch sign product image URLs
    const httpUrls = productImagePaths.filter((p) => p.startsWith("http"));
    const storagePaths = productImagePaths.filter((p) => !p.startsWith("http"));

    let signedStorageUrls: string[] = [];
    if (storagePaths.length > 0) {
      const { data: batchSigned, error: batchErr } = await sb
        .storage
        .from("product-images")
        .createSignedUrls(storagePaths, 600);
      if (batchErr || !batchSigned) {
        throw new Error(`Failed to batch sign product image URLs: ${batchErr?.message}`);
      }
      signedStorageUrls = batchSigned.map((s) => s.signedUrl);
    }
    const resolvedProductImageUrls = [...httpUrls, ...signedStorageUrls];

    // Scene prompt: use custom if provided, else fall back to persona attributes
    const scenePrompt = custom_scene_prompt ||
      ((persona.attributes as Record<string, unknown>)?.scene_prompt as string | undefined);

    const productContext: ProductReferenceContext = {
      name: typeof product.name === "string" ? product.name : undefined,
      description: typeof product.description === "string" ? product.description : undefined,
      category: typeof product.category === "string" ? product.category : undefined,
      price: typeof product.price === "number" ? product.price : undefined,
      currency: typeof product.currency === "string" ? product.currency : undefined,
    };

    // Generate one composite image (with optional pose variant)
    const composite = await withRetry(
      () => generateCompositeFromImages(
        personaSignedUrl,
        resolvedProductImageUrls,
        productContext,
        scenePrompt,
        format as "9:16" | "16:9",
        resolvedPoseVariant,
      ),
      5,
      1000,
    );

    const ext = composite.mimeType.includes("png") ? "png" : "jpg";
    const storagePath = `${userId}/segment/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await sb.storage
      .from("composite-images")
      .upload(storagePath, composite.data, {
        contentType: composite.mimeType,
        upsert: false,
      });

    if (uploadErr) {
      throw new Error(`Composite upload failed: ${uploadErr.message}`);
    }

    // 2h signed URL — survives an Advanced Mode config session
    const { data: signedData } = await sb.storage
      .from("composite-images")
      .createSignedUrl(storagePath, 7200);

    if (!signedData?.signedUrl) {
      throw new Error("Failed to create signed URL for segment composite");
    }

    return json(
      { data: { image: { path: storagePath, signed_url: signedData.signedUrl } } },
      cors,
      200,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("generate-segment-composite error:", e);
    return json(
      { detail: msg || "Failed to generate segment image. Please try again." },
      cors,
      500,
    );
  }
});
