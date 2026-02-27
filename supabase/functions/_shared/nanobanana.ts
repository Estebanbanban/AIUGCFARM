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
      generationConfig: { responseModalities: ["IMAGE"] },
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
 * Downloads both source images, sends to Gemini as multimodal input.
 * Returns raw image buffer.
 */
export async function generateCompositeFromImages(
  personImageUrl: string,
  productImageUrl: string,
  scenePrompt?: string,
): Promise<GeneratedImage> {
  const [personRes, productRes] = await Promise.all([
    fetch(personImageUrl),
    fetch(productImageUrl),
  ]);

  if (!personRes.ok) throw new Error(`Failed to download persona image: ${personRes.status}`);
  if (!productRes.ok) throw new Error(`Failed to download product image: ${productRes.status}`);

  const [personBuf, productBuf] = await Promise.all([
    personRes.arrayBuffer(),
    productRes.arrayBuffer(),
  ]);

  const personB64 = uint8ArrayToBase64(new Uint8Array(personBuf));
  const productB64 = uint8ArrayToBase64(new Uint8Array(productBuf));
  const personMime = personRes.headers.get("content-type") || "image/jpeg";
  const productMime = productRes.headers.get("content-type") || "image/jpeg";

  const compositePrompt = scenePrompt
    ? `${scenePrompt} The person is naturally holding and showcasing the product, which is clearly visible in frame. Composite the person and product naturally in a UGC selfie-style image.`
    : "Create a UGC-style composite image of this person naturally holding and using this product while talking to camera. Natural lighting, authentic, selfie aesthetic.";

  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: compositePrompt },
          { inlineData: { mimeType: personMime, data: personB64 } },
          { inlineData: { mimeType: productMime, data: productB64 } },
        ],
      }],
      generationConfig: { responseModalities: ["IMAGE"] },
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
