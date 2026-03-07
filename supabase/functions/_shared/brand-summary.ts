import { callOpenRouter } from "./openrouter.ts";

export interface BrandSummary {
  tone: string;
  demographic: string;
  selling_points: string[];
}

interface ProductLike {
  name: string;
  description: string;
  price: number | null;
  currency: string;
  category: string | null;
}

export async function generateBrandSummary(
  products: ProductLike[],
): Promise<BrandSummary | null> {
  try {
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

    const content = await callOpenRouter(
      [
        {
          role: "system",
          content:
            'You are a brand analyst. Given product data, return a JSON object with exactly these keys: "tone" (brand voice tone, 1-2 words), "demographic" (who this product is for, 1 sentence), "selling_points" (array of 3-5 bullet point strings). Return ONLY valid JSON, no markdown.',
        },
        {
          role: "user",
          content: productSummaries,
        },
      ],
      { maxTokens: 500, timeoutMs: 10000 },
    );

    const parsed = JSON.parse(content);

    // Validate expected shape
    if (
      typeof parsed.tone !== "string" ||
      typeof parsed.demographic !== "string" ||
      !Array.isArray(parsed.selling_points)
    ) {
      console.error("Brand summary has unexpected shape:", parsed);
      return null;
    }

    return parsed as BrandSummary;
  } catch (e) {
    console.error("Brand summary generation failed:", e);
    return null;
  }
}
