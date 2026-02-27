import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { validateUrl } from "../_shared/ssrf.ts";
import { rateLimit } from "../_shared/rate-limit.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

interface ProductData {
  name: string;
  description: string;
  price: number | null;
  currency: string;
  images: string[];
  category: string | null;
  source: "shopify" | "generic";
}

/** Try to extract product data from Shopify's /products.json endpoint. */
async function tryShopify(origin: string): Promise<ProductData[] | null> {
  try {
    const res = await fetch(`${origin}/products.json?limit=10`, {
      headers: { "User-Agent": "CineRads/1.0" },
    });
    if (!res.ok) return null;

    const body = await res.json();
    if (!body.products || !Array.isArray(body.products)) return null;

    return body.products.map(
      (p: Record<string, unknown>) => ({
        name: p.title as string,
        description: (p.body_html as string) ?? "",
        price: p.variants
          ? parseFloat(
              ((p.variants as Record<string, unknown>[])[0]?.price as string) ??
                "0",
            )
          : null,
        currency: "USD",
        images: ((p.images as Record<string, string>[]) ?? []).map(
          (i) => i.src,
        ),
        category: (p.product_type as string) || null,
        source: "shopify" as const,
      }),
    );
  } catch {
    return null;
  }
}

/** Scrape a generic page via HTML and use regex heuristics for product data. */
async function scrapeGeneric(url: string): Promise<ProductData> {
  const res = await fetch(url, {
    headers: { "User-Agent": "CineRads/1.0" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);

  const html = await res.text();

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const ogTitleMatch = html.match(
    /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i,
  );
  const name = ogTitleMatch?.[1] || titleMatch?.[1] || "Unknown Product";

  // Extract description
  const ogDescMatch = html.match(
    /<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i,
  );
  const metaDescMatch = html.match(
    /<meta[^>]+name="description"[^>]+content="([^"]+)"/i,
  );
  const description = ogDescMatch?.[1] || metaDescMatch?.[1] || "";

  // Extract images (og:image + product images)
  const images: string[] = [];
  const ogImageMatch = html.match(
    /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i,
  );
  if (ogImageMatch) images.push(ogImageMatch[1]);

  // Attempt to extract price
  const priceMatch = html.match(
    /(?:price|amount)[^>]*>[\s$£€]*(\d+[.,]\d{2})/i,
  );

  return {
    name: name.trim(),
    description: description.trim(),
    price: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
    currency: "USD",
    images,
    category: null,
    source: "generic",
  };
}

/** Call OpenAI to generate a brand summary from product data. */
async function generateBrandSummary(
  product: ProductData,
): Promise<Record<string, string>> {
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
          content:
            'You are a brand analyst. Given product data, return a JSON object with keys: "tone" (brand voice tone), "target_audience" (who this product is for), "key_selling_points" (array of 3-5 bullet points), "brand_personality" (1-2 sentence summary).',
        },
        {
          role: "user",
          content: `Product name: ${product.name}\nDescription: ${product.description}\nPrice: ${product.price ?? "unknown"} ${product.currency}\nCategory: ${product.category ?? "unknown"}`,
        },
      ],
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("OpenAI brand summary error:", err);
    return { error: "Brand summary generation failed" };
  }

  const body = await res.json();
  try {
    return JSON.parse(body.choices[0].message.content);
  } catch {
    return { raw: body.choices[0].message.content };
  }
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    // Auth is optional for scraping, but affects rate limits and saving
    let userId: string | null = null;
    try {
      userId = await requireUserId(req);
    } catch {
      // unauthenticated — allowed but rate-limited more aggressively
    }

    const rateLimitKey = userId ?? (req.headers.get("x-forwarded-for") || "anon");
    const limit = userId ? 60 : 10;
    if (!rateLimit(rateLimitKey, limit)) {
      return json({ detail: "Rate limit exceeded. Try again later." }, cors, 429);
    }

    const { url, save } = await req.json();
    if (!url || typeof url !== "string") {
      return json({ detail: "url is required" }, cors, 400);
    }

    const parsed = validateUrl(url);
    const origin = parsed.origin;

    // Try Shopify first
    let products: ProductData[] | null = await tryShopify(origin);
    let source: "shopify" | "generic" = "shopify";

    if (!products || products.length === 0) {
      // Fall back to generic scraping
      const single = await scrapeGeneric(url);
      products = [single];
      source = "generic";
    }

    // Generate brand summary for the first product
    const brandSummary = await generateBrandSummary(products[0]);

    // Save to DB if authenticated and requested
    let savedIds: string[] = [];
    if (userId && save !== false) {
      const sb = getAdminClient();
      const rows = products.map((p) => ({
        owner_id: userId,
        store_url: url,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        images: p.images,
        category: p.category,
        brand_summary: brandSummary,
        source,
        confirmed: false,
      }));

      const { data: inserted, error } = await sb
        .from("products")
        .insert(rows)
        .select("id");
      if (error) throw new Error(`DB insert failed: ${error.message}`);
      savedIds = (inserted ?? []).map((r: { id: string }) => r.id);
    }

    return json(
      {
        data: {
          products: products.map((p, i) => ({
            ...p,
            brand_summary: i === 0 ? brandSummary : null,
            id: savedIds[i] ?? null,
          })),
          source,
          saved: savedIds.length > 0,
        },
      },
      cors,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    if (
      msg.includes("URL") ||
      msg.includes("Malformed") ||
      msg.includes("private") ||
      msg.includes("loopback") ||
      msg.includes("internal")
    ) {
      return json({ detail: msg }, cors, 400);
    }
    console.error("scrape-product error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
