import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { withRetry } from "../_shared/retry.ts";
import { generateCompositeFromImages } from "../_shared/nanobanana.ts";

const COMPOSITE_COUNT = 2; // 2×~45s = ~90s, well within Supabase 150s free-tier timeout
const MAX_PRODUCT_REFERENCE_IMAGES = 2; // 2 product refs keeps RAM below WORKER_LIMIT

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    // Per-user daily limit for composite image generations
    const [{ data: profile }, { data: balance }] = await Promise.all([
      sb.from("profiles").select("plan, role").eq("id", userId).single(),
      sb.from("credit_balances").select("remaining").eq("owner_id", userId).maybeSingle(),
    ]);
    const userPlan = profile?.plan ?? "free";
    const isAdmin = profile?.role === "admin";
    const hasCredits = (balance?.remaining ?? 0) > 0;
    // Admin: unlimited. Paid plan or any purchased credits: 50/day. Pure free: 10/day.
    const dailyLimit = isAdmin ? Infinity : (userPlan !== "free" || hasCredits) ? 50 : 10;

    if (isFinite(dailyLimit)) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const { count: todayCount } = await sb
        .from("credit_ledger")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId)
        .eq("reason", "composite_generation")
        .gte("created_at", todayStart.toISOString());

      if ((todayCount ?? 0) >= dailyLimit) {
        return json(
          { detail: `Daily composite generation limit reached (${dailyLimit}/day). Try again tomorrow.` },
          cors,
          429,
        );
      }
    }

    const { product_id, persona_id, format = "9:16", selected_images } = await req.json();

    if (!product_id) return json({ detail: "product_id is required" }, cors, 400);
    if (!persona_id) return json({ detail: "persona_id is required" }, cors, 400);
    if (Array.isArray(selected_images) && selected_images.length > 20) {
      return json({ detail: "selected_images must contain 20 items or fewer" }, cors, 400);
    }
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

    // Product image URLs (multiple references improve output fidelity).
    // If the frontend sent selected_images, use only those (must be a subset of product.images).
    const allImages = ((product.images as string[]) ?? [])
      .filter((img) => typeof img === "string" && img.trim().length > 0);
    const productImagePaths = (
      Array.isArray(selected_images) && selected_images.length > 0
        ? selected_images.filter((img: string) => allImages.includes(img))
        : allImages
    ).slice(0, MAX_PRODUCT_REFERENCE_IMAGES);
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

    // Scene prompt from persona attributes (for context)
    const scenePrompt = (persona.attributes as Record<string, unknown>)
      ?.scene_prompt as string | undefined;

    // Generate composites SEQUENTIALLY and upload each one immediately after generation.
    // Parallel generation keeps multiple large base64 buffers in RAM simultaneously and
    // triggers WORKER_LIMIT on Supabase. Sequential + immediate upload lets the GC reclaim
    // each buffer before the next composite starts.
    const productContext = {
      name: typeof product.name === "string" ? product.name : undefined,
      description: typeof product.description === "string" ? product.description : undefined,
      category: typeof product.category === "string" ? product.category : undefined,
      price: typeof product.price === "number" ? product.price : undefined,
      currency: typeof product.currency === "string" ? product.currency : undefined,
    };
    const uploadedPaths: string[] = [];
    for (let i = 0; i < COMPOSITE_COUNT; i++) {
      console.log(`[generate-composite-images] composite ${i + 1}/${COMPOSITE_COUNT}`);
      try {
        const composite = await withRetry(
          () => generateCompositeFromImages(
            personaSignedUrl,
            resolvedProductImageUrls,
            productContext,
            scenePrompt,
            format as "9:16" | "16:9",
          ),
          3,    // attempts
          1000, // 1s base delay
        );

        // Upload immediately so the buffer can be GC'd before the next composite
        const ext = composite.mimeType.includes("png") ? "png" : "jpg";
        const storagePath = `${userId}/preview/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await sb.storage
          .from("composite-images")
          .upload(storagePath, composite.data, {
            contentType: composite.mimeType,
            upsert: false,
          });
        if (uploadErr) {
          console.error(`Composite ${i + 1} upload failed: ${uploadErr.message}`);
        } else {
          uploadedPaths.push(storagePath);
        }
      } catch (compositeErr) {
        console.error(`Composite ${i + 1} generation failed:`, compositeErr);
      }
    }

    // Batch sign all uploaded composite URLs
    let results: Array<{ path: string; signed_url: string }> = [];
    if (uploadedPaths.length > 0) {
      const { data: signedBatch } = await sb.storage
        .from("composite-images")
        .createSignedUrls(uploadedPaths, 3600);

      if (signedBatch) {
        results = signedBatch
          .filter((s) => s.signedUrl)
          .map((s) => ({ path: s.path!, signed_url: s.signedUrl }));
      }
    }

    if (results.length === 0) {
      throw new Error("All composite image generations failed");
    }

    // Log composite generation for daily limit tracking
    await sb.from("credit_ledger").insert({
      owner_id: userId,
      amount: 0,
      reason: "composite_generation",
    });

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
