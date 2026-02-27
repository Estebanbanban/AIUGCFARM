/**
 * NanoBanana API helper.
 *
 * Handles both synchronous responses ({ images: [{ url }] })
 * and asynchronous job responses ({ taskId }) with polling.
 *
 * Base URL env: NANOBANANA_BASE_URL (default: https://api.nanobanana.com/v1)
 * Auth env:     NANOBANANA_API_KEY
 */

const NANOBANANA_API_KEY = Deno.env.get("NANOBANANA_API_KEY");
const NANOBANANA_BASE_URL =
  Deno.env.get("NANOBANANA_BASE_URL") || "https://api.nanobanana.com/v1";

/** Poll interval and max wait */
const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 30; // ~2 minutes

function authHeaders(): Record<string, string> {
  if (!NANOBANANA_API_KEY) throw new Error("NANOBANANA_API_KEY is not configured");
  return {
    Authorization: `Bearer ${NANOBANANA_API_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Poll /record-info (or /generate/status) until done, return image URLs. */
async function pollForImages(taskId: string): Promise<string[]> {
  // Try both common polling endpoint patterns
  const pollUrl = `${NANOBANANA_BASE_URL}/generate/status?taskId=${taskId}`;
  const altPollUrl = `${NANOBANANA_BASE_URL.replace(/\/v1$/, "")}/api/v1/nanobanana/record-info?taskId=${taskId}`;

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    // Try primary poll URL
    const res = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${NANOBANANA_API_KEY}` },
    });

    if (res.ok) {
      const data = await res.json();

      // successFlag: 1 = done, 2/3 = failed
      if (data.successFlag === 1) {
        const urls: string[] = data.imageUrls ?? data.images?.map((img: { url: string }) => img.url) ?? [];
        if (urls.length > 0) return urls;
      }
      if (data.successFlag === 2 || data.successFlag === 3) {
        throw new Error(`NanoBanana generation failed: ${JSON.stringify(data).slice(0, 200)}`);
      }

      // status-based response (status: "completed" / "pending")
      if (data.status === "completed") {
        const urls: string[] = data.imageUrls ?? data.images?.map((img: { url: string }) => img.url) ?? [];
        if (urls.length > 0) return urls;
      }
      if (data.status === "failed") {
        throw new Error(`NanoBanana generation failed: ${JSON.stringify(data).slice(0, 200)}`);
      }
      // Still pending → keep polling
    } else {
      // Try alt URL on next iteration if primary fails
      const altRes = await fetch(altPollUrl, {
        headers: { Authorization: `Bearer ${NANOBANANA_API_KEY}` },
      });
      if (altRes.ok) {
        const data = await altRes.json();
        if (data.successFlag === 1) {
          const urls: string[] = data.imageUrls ?? [];
          if (urls.length > 0) return urls;
        }
      }
    }
  }
  throw new Error(`NanoBanana timed out after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s`);
}

/**
 * Resolve a NanoBanana response to image URLs.
 * Handles sync ({ images }) and async ({ taskId }) responses.
 */
async function resolveImages(data: Record<string, unknown>): Promise<string[]> {
  // Synchronous response: images returned directly
  if (Array.isArray(data.images) && (data.images as unknown[]).length > 0) {
    return (data.images as { url: string }[]).map((img) => img.url);
  }
  if (Array.isArray(data.imageUrls) && (data.imageUrls as unknown[]).length > 0) {
    return data.imageUrls as string[];
  }

  // Async response: poll for result
  const taskId = (data.taskId ?? data.task_id) as string | undefined;
  if (taskId) return pollForImages(taskId);

  throw new Error(`NanoBanana returned no images or taskId: ${JSON.stringify(data).slice(0, 200)}`);
}

/**
 * Generate N images from a text prompt.
 */
export async function generateImagesFromPrompt(
  prompt: string,
  imageCount = 4,
): Promise<string[]> {
  const res = await fetch(`${NANOBANANA_BASE_URL}/images/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      prompt,
      num_images: imageCount,
      // Also include async-style params in case the API uses them
      generationType: "TEXTTOIMAGE",
      imageCount,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NanoBanana generate failed (${res.status}): ${err.slice(0, 300)}`);
  }

  return resolveImages(await res.json());
}

/**
 * Generate a composite image: persona + product.
 */
export async function generateCompositeFromImages(
  personImageUrl: string,
  productImageUrl: string,
  prompt?: string,
): Promise<string> {
  const compositePrompt = prompt ??
    "Person naturally holding and showcasing the product, UGC-style talking-to-camera selfie, authentic, natural lighting";

  const res = await fetch(`${NANOBANANA_BASE_URL}/images/composite`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      person_image_url: personImageUrl,
      product_image_url: productImageUrl,
      prompt: compositePrompt,
      style: "ugc_natural",
      // Async-style params
      generationType: "IMAGETOIMAGE",
      imageCount: 1,
      personImage: personImageUrl,
      productImage: productImageUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NanoBanana composite failed (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json();

  // Sync: { image_url: string }
  if (typeof data.image_url === "string") return data.image_url;

  const urls = await resolveImages(data);
  if (!urls[0]) throw new Error("NanoBanana returned no composite image URL");
  return urls[0];
}
