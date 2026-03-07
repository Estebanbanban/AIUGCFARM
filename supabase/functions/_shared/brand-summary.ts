import { callOpenRouter } from "./openrouter.ts";

export interface BrandSummary {
  // Original 3
  tone: string;               // e.g. "bold, confident, direct"
  demographic: string;        // e.g. "women 25-35 interested in skincare"
  selling_points: string[];   // 3-5 bullet points

  // New 7
  tagline: string;                    // short punchy brand tagline (1 sentence)
  unique_value_prop: string;          // what makes this product uniquely better
  customer_pain_points: string[];     // 2-4 pains the product solves
  social_proof: string;               // key credibility signals (reviews, awards, etc.)
  price_positioning: string;          // "premium", "affordable", "mid-market" + rationale
  product_category: string;           // e.g. "skincare", "fitness equipment", "SaaS tool"
  competitor_positioning: string;     // how it differentiates from alternatives
}

interface ProductLike {
  name: string;
  description: string;
  price: number | null;
  currency: string;
  category: string | null;
}

const BRAND_SUMMARY_TIMEOUT_MS = 15000;

async function attemptGenerateBrandSummary(
  productSummaries: string,
): Promise<BrandSummary | null> {
  // Wrap the OpenRouter call in an explicit race-based timeout so that a
  // hanging network request never blocks the caller indefinitely.
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Brand summary timed out")),
      BRAND_SUMMARY_TIMEOUT_MS,
    )
  );

  const callPromise = callOpenRouter(
    [
      {
        role: "system",
        content:
          'You are a brand analyst. Given product data, return a JSON object with exactly these 10 keys:\n' +
          '- "product_category": the product category (e.g. "skincare", "fitness equipment", "SaaS tool") — identify this first\n' +
          '- "tone": brand voice tone, 2-4 descriptive words (e.g. "bold, confident, direct")\n' +
          '- "demographic": who this product is for, 1 sentence (e.g. "women 25-35 interested in skincare")\n' +
          '- "selling_points": array of 3-5 key selling point strings\n' +
          '- "tagline": short punchy brand tagline, 1 sentence\n' +
          '- "unique_value_prop": what makes this product uniquely better than alternatives, 1-2 sentences\n' +
          '- "customer_pain_points": array of 2-4 strings describing pains this product solves\n' +
          '- "social_proof": key credibility signals such as reviews, awards, or certifications extracted from the product description; write "Not mentioned" if none are present\n' +
          '- "price_positioning": infer from the price and context — one of "premium", "mid-market", or "affordable", followed by a brief rationale\n' +
          '- "competitor_positioning": how this product differentiates itself from alternatives, 1-2 sentences\n' +
          'Return ONLY valid JSON, no markdown, no code fences.',
      },
      {
        role: "user",
        content: productSummaries,
      },
    ],
    { maxTokens: 800, timeoutMs: BRAND_SUMMARY_TIMEOUT_MS },
  );

  const content = await Promise.race([callPromise, timeoutPromise]);

  const parsed = JSON.parse(content);

  // Validate required original fields
  if (
    typeof parsed.tone !== "string" ||
    typeof parsed.demographic !== "string" ||
    !Array.isArray(parsed.selling_points)
  ) {
    console.error("Brand summary has unexpected shape:", parsed);
    return null;
  }

  // Build result with defaults for any missing new fields
  const result: BrandSummary = {
    tone: parsed.tone,
    demographic: parsed.demographic,
    selling_points: parsed.selling_points,
    tagline: typeof parsed.tagline === "string" ? parsed.tagline : "",
    unique_value_prop: typeof parsed.unique_value_prop === "string" ? parsed.unique_value_prop : "",
    customer_pain_points: Array.isArray(parsed.customer_pain_points) ? parsed.customer_pain_points : [],
    social_proof: typeof parsed.social_proof === "string" ? parsed.social_proof : "Not mentioned",
    price_positioning: typeof parsed.price_positioning === "string" ? parsed.price_positioning : "",
    product_category: typeof parsed.product_category === "string" ? parsed.product_category : "",
    competitor_positioning: typeof parsed.competitor_positioning === "string" ? parsed.competitor_positioning : "",
  };

  return result;
}

export async function generateBrandSummary(
  products: ProductLike[],
): Promise<BrandSummary | null> {
  // Build product summary from ALL products, truncating descriptions
  const productSummaries = products
    .map((p, i) => {
      const desc =
        p.description.length > 200
          ? p.description.slice(0, 200) + "..."
          : p.description;
      return `Product ${i + 1}: ${p.name}\nDescription: ${desc}\nPrice: ${p.price ?? "unknown"} ${p.currency}\nCategory: ${p.category ?? "unknown"}`;
    })
    .join("\n\n");

  // First attempt
  try {
    const result = await attemptGenerateBrandSummary(productSummaries);
    if (result !== null) return result;
  } catch (e) {
    const isTimeout =
      e instanceof Error && e.message.includes("timed out");
    if (!isTimeout) {
      console.error("Brand summary generation failed:", e);
      return null;
    }
    console.warn("Brand summary timed out on first attempt, retrying once...");
  }

  // Single retry (only reached on timeout or null result from first attempt)
  try {
    const result = await attemptGenerateBrandSummary(productSummaries);
    if (result !== null) return result;
    console.error("Brand summary returned null on retry");
    return null;
  } catch (e) {
    console.error("Brand summary generation failed on retry:", e);
    return null;
  }
}
