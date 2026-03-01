/**
 * NanoBanana (Google Gemini image generation) helper.
 *
 * NanoBanana 2 = gemini-3.1-flash-image-preview
 * API key env:  NANOBANANA_API_KEY (Google Gemini API key)
 * API docs:     https://ai.google.dev/gemini-api/docs/image-generation
 */

/** Safely convert a large Uint8Array to base64 without hitting call-stack limits. */
function uint8ArrayToBase64(buf: Uint8Array): string {
  const chunkSize = 8192;
  const chunks: string[] = [];
  for (let i = 0; i < buf.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...buf.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(""));
}

const GEMINI_API_KEY = Deno.env.get("NANOBANANA_API_KEY");
// NanoBanana 2 image generation model (Gemini API)
// Docs: https://ai.google.dev/gemini-api/docs/image-generation
const GEMINI_MODEL = "gemini-3.1-flash-image-preview";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface GeneratedImage {
  data: Uint8Array;
  mimeType: string; // e.g. "image/png"
}

export interface ProductReferenceContext {
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  currency?: string;
}

function endpoint(): string {
  if (!GEMINI_API_KEY) throw new Error("NANOBANANA_API_KEY (Gemini API key) is not configured");
  return `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
}

/** Call Gemini with a text prompt, return a single generated image. */
async function generateSingleImage(prompt: string): Promise<GeneratedImage> {
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini image generation failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] =
    data.candidates?.[0]?.content?.parts ?? [];

  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart?.inlineData) {
    throw new Error(`Gemini returned no image. Response: ${JSON.stringify(data).slice(0, 300)}`);
  }

  const { mimeType, data: b64 } = imagePart.inlineData;
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return { data: binary, mimeType };
}

/**
 * Generate `count` images from a text prompt in parallel.
 * Returns raw image buffers — caller uploads to storage.
 */
export async function generateImagesFromPrompt(
  prompt: string,
  count = 4,
): Promise<GeneratedImage[]> {
  return Promise.all(Array.from({ length: count }, () => generateSingleImage(prompt)));
}

/**
 * Generate a composite image (persona + product) for video generation.
 * Downloads persona + product reference images, sends to Gemini as multimodal input.
 * Returns raw image buffer.
 */
export async function generateCompositeFromImages(
  personImageUrl: string,
  productImageUrls: string[],
  productContext?: ProductReferenceContext,
  scenePrompt?: string,
  aspectRatio: "9:16" | "16:9" = "9:16",
): Promise<GeneratedImage> {
  if (!Array.isArray(productImageUrls) || productImageUrls.length === 0) {
    throw new Error("At least one product reference image is required");
  }

  const [personRes, ...productResponses] = await Promise.all([
    fetch(personImageUrl),
    ...productImageUrls.map((url) => fetch(url)),
  ]);
  if (!personRes.ok) throw new Error(`Failed to download persona image: ${personRes.status}`);
  for (let i = 0; i < productResponses.length; i++) {
    if (!productResponses[i].ok) {
      throw new Error(
        `Failed to download product image ${i + 1}: ${productResponses[i].status}`,
      );
    }
  }

  const [personBuf, ...productBuffers] = await Promise.all([
    personRes.arrayBuffer(),
    ...productResponses.map((res) => res.arrayBuffer()),
  ]);

  const personB64 = uint8ArrayToBase64(new Uint8Array(personBuf));
  const personMime = personRes.headers.get("content-type") || "image/jpeg";
  const productInlineParts = productBuffers.map((buf, idx) => ({
    inlineData: {
      mimeType: productResponses[idx].headers.get("content-type") || "image/jpeg",
      data: uint8ArrayToBase64(new Uint8Array(buf)),
    },
  }));

  const formatHint = aspectRatio === "9:16"
    ? "Vertical 9:16 portrait format for mobile/phone screen."
    : "Horizontal 16:9 landscape format for widescreen.";

  // CRITICAL FRAMING RULE: head-and-shoulders POV selfie ONLY — no waist, legs, or feet.
  const framingRule = "IMPORTANT: Tight upper-body frame — show ONLY the person's head, neck, shoulders, and upper chest. NO waist, legs, or feet. The bottom edge of the image must cut off at the chest/collarbone level. This is a close-up phone selfie, not a full-body photo.";
  const productContextPrompt = [
    productContext?.name ? `Product name: ${productContext.name}.` : "",
    productContext?.description ? `Product description: ${productContext.description}.` : "",
    productContext?.category ? `Category: ${productContext.category}.` : "",
    typeof productContext?.price === "number"
      ? `Price: ${productContext.currency ?? "USD"} ${productContext.price}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const multiImageInstruction =
    "Use all provided product reference images to preserve exact product packaging, color, materials, shape, logo placement, and label details.";

  const compositePrompt = scenePrompt
    ? `${framingRule} ${multiImageInstruction} ${productContextPrompt} ${scenePrompt} The person is filming themselves POV-style (arm extended, front-camera angle, slight wide-angle distortion), naturally holding and showcasing the product which is clearly visible in frame. iPhone selfie aesthetic, talking-to-camera energy. ${formatHint}`
    : `${framingRule} ${multiImageInstruction} ${productContextPrompt} UGC phone selfie: extreme close-up POV, front-camera angle, arm extended at selfie distance, slight wide-angle distortion. The person looks directly into the lens while naturally holding the product near their upper chest — the product is clearly visible in frame. Natural window lighting, authentic imperfections, talking-to-camera energy. ${formatHint}`;

  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: compositePrompt },
          { inlineData: { mimeType: personMime, data: personB64 } },
          ...productInlineParts,
        ],
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini composite generation failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] =
    data.candidates?.[0]?.content?.parts ?? [];

  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart?.inlineData) {
    throw new Error(`Gemini returned no composite image. Response: ${JSON.stringify(data).slice(0, 300)}`);
  }

  const { mimeType, data: b64 } = imagePart.inlineData;
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return { data: binary, mimeType };
}

/**
 * Edit an existing composite image using natural-language instructions.
 * Uses the reference image as inline input so identity/product framing is preserved.
 */
export async function editCompositeFromReference(
  referenceImageUrl: string,
  editPrompt: string,
  aspectRatio: "9:16" | "16:9" = "9:16",
): Promise<GeneratedImage> {
  const refRes = await fetch(referenceImageUrl);
  if (!refRes.ok) {
    throw new Error(`Failed to download reference image: ${refRes.status}`);
  }

  const refBuf = await refRes.arrayBuffer();
  const refB64 = uint8ArrayToBase64(new Uint8Array(refBuf));
  const refMime = refRes.headers.get("content-type") || "image/jpeg";

  const formatHint = aspectRatio === "9:16"
    ? "Keep vertical 9:16 portrait format."
    : "Keep horizontal 16:9 landscape format.";

  const prompt = [
    "Edit this UGC selfie ad image according to the user's instruction.",
    "Preserve the same person identity and product unless explicitly changed.",
    "Maintain photorealistic iPhone selfie style with natural lighting and details.",
    "Do not add text overlays, logos, captions, or watermarks.",
    `User instruction: ${editPrompt}`,
    formatHint,
  ].join(" ");

  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: refMime, data: refB64 } },
        ],
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini image edit failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] =
    data.candidates?.[0]?.content?.parts ?? [];

  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart?.inlineData) {
    throw new Error(`Gemini returned no edited image. Response: ${JSON.stringify(data).slice(0, 300)}`);
  }

  const { mimeType, data: b64 } = imagePart.inlineData;
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return { data: binary, mimeType };
}
