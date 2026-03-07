import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { validateUrl } from "../_shared/ssrf.ts";
import { rateLimit } from "../_shared/rate-limit.ts";
import { generateBrandSummary, BrandSummary } from "../_shared/brand-summary.ts";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

interface ProductData {
  name: string;
  description: string;
  price: number | null;
  currency: string;
  images: string[];
  category: string | null;
  source: "shopify" | "generic";
}

// ---------------------------------------------------------------------------
// Browser-like headers to bypass basic bot detection (Cloudflare, etc.)
// ---------------------------------------------------------------------------

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

// ---------------------------------------------------------------------------
// safeFetch  -  SSRF-safe fetch that validates redirect targets before
// following them.  Replaces bare fetch() calls throughout this file so that
// an attacker cannot use an open redirect on a legitimate host to reach a
// private IP after validateUrl() has already approved the original URL.
// ---------------------------------------------------------------------------

const MAX_REDIRECTS = 5;

async function safeFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  let currentUrl = url;
  let redirectsFollowed = 0;

  while (true) {
    // Never let fetch follow redirects automatically — we handle them ourselves.
    const res = await fetch(currentUrl, { ...init, redirect: "manual" });

    const isRedirect =
      res.status >= 300 && res.status < 400 && res.headers.has("location");

    if (!isRedirect) {
      // Not a redirect — return the response as-is.
      return res;
    }

    if (redirectsFollowed >= MAX_REDIRECTS) {
      throw new Error("Too many redirects");
    }

    const location = res.headers.get("location")!;

    // Resolve relative Location headers against the current URL.
    let nextUrl: string;
    try {
      nextUrl = new URL(location, currentUrl).toString();
    } catch {
      throw new Error(`Invalid redirect Location header: ${location}`);
    }

    // Validate the redirect target — throws if it resolves to a private IP.
    await validateUrl(nextUrl);

    currentUrl = nextUrl;
    redirectsFollowed++;
  }
}

// ---------------------------------------------------------------------------
// Shopify scraper  -  paginate with limit=30, cap at 50 total products
// ---------------------------------------------------------------------------

async function tryShopify(origin: string): Promise<ProductData[] | null> {
  const MAX_TOTAL = 50;
  const PER_PAGE = 30;
  const allProducts: ProductData[] = [];

  try {
    let page = 1;
    while (allProducts.length < MAX_TOTAL) {
      const res = await safeFetch(
        `${origin}/products.json?limit=${PER_PAGE}&page=${page}`,
        { headers: BROWSER_HEADERS },
      );
      if (!res.ok) return page === 1 ? null : allProducts;

      const body = await res.json();
      if (
        !body.products ||
        !Array.isArray(body.products) ||
        body.products.length === 0
      ) {
        break;
      }

      for (const p of body.products) {
        if (allProducts.length >= MAX_TOTAL) break;
        allProducts.push({
          name: p.title as string,
          description: stripHtml((p.body_html as string) ?? ""),
          price: p.variants
            ? parseFloat(
                ((p.variants as Record<string, unknown>[])[0]
                  ?.price as string) ?? "0",
              )
            : null,
          currency: "USD",
          images: ((p.images as Record<string, string>[]) ?? []).map(
            (i) => i.src,
          ),
          category: (p.product_type as string) || null,
          source: "shopify" as const,
        });
      }

      // If we got fewer than PER_PAGE, there are no more pages
      if (body.products.length < PER_PAGE) break;
      page++;
    }

    return allProducts.length > 0 ? allProducts : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// robots.txt checker
// ---------------------------------------------------------------------------

async function isAllowedByRobots(
  origin: string,
  path: string,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    const res = await safeFetch(`${origin}/robots.txt`, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
    });
    if (!res.ok) return true;
    const text = await res.text();
    const lines = text.split("\n");
    let inDefaultAgent = false;
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.startsWith("user-agent:")) {
        inDefaultAgent = trimmed.includes("*");
      }
      if (inDefaultAgent && trimmed.startsWith("disallow:")) {
        const disallowed = trimmed.replace("disallow:", "").trim();
        if (
          disallowed &&
          (disallowed === "/" || path.startsWith(disallowed))
        ) {
          return false;
        }
      }
    }
    return true;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// JSON-LD parser for generic pages
// ---------------------------------------------------------------------------

function parseJsonLd(html: string): ProductData[] {
  const products: ProductData[] = [];
  const regex =
    /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (
          item["@type"] === "Product" ||
          item["@type"] === "ProductGroup"
        ) {
          products.push({
            name: item.name || "Unknown Product",
            description: stripHtml(String(item.description || "")),
            price: item.offers?.price
              ? parseFloat(item.offers.price)
              : item.offers?.lowPrice
                ? parseFloat(item.offers.lowPrice)
                : null,
            currency: item.offers?.priceCurrency || "USD",
            images: Array.isArray(item.image)
              ? item.image
              : item.image
                ? [item.image]
                : [],
            category: item.category || null,
            source: "generic" as const,
          });
        }
      }
    } catch {
      /* skip invalid JSON-LD */
    }
  }
  return products;
}

// ---------------------------------------------------------------------------
// Generic scraper  -  JSON-LD first, OG tags fallback
// ---------------------------------------------------------------------------

async function scrapeGeneric(
  url: string,
  origin: string,
): Promise<{ products: ProductData[]; blocked_by_robots: boolean }> {
  const parsedUrl = new URL(url);

  // Check robots.txt before fetching
  const allowed = await isAllowedByRobots(origin, parsedUrl.pathname);
  if (!allowed) {
    return { products: [], blocked_by_robots: true };
  }

  const res = await safeFetch(url, {
    headers: BROWSER_HEADERS,
  });

  if (res.status === 403 || res.status === 401 || res.status === 429) {
    throw new Error(
      `This website blocks automated access (HTTP ${res.status}). ` +
      `Try pasting a direct product page URL, or use the manual upload option.`,
    );
  }
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);

  // Validate Content-Type is HTML
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/html")) {
    throw new Error(
      `Unsupported Content-Type: ${ct}. Expected text/html.`,
    );
  }

  const html = await res.text();

  // Try JSON-LD first
  const jsonLdProducts = parseJsonLd(html);
  if (jsonLdProducts.length > 0) {
    return { products: jsonLdProducts, blocked_by_robots: false };
  }

  // Fallback: OG tags / meta tags
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const ogTitleMatch = html.match(
    /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i,
  );
  const name = ogTitleMatch?.[1] || titleMatch?.[1] || "Unknown Product";

  const ogDescMatch = html.match(
    /<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i,
  );
  const metaDescMatch = html.match(
    /<meta[^>]+name="description"[^>]+content="([^"]+)"/i,
  );
  const description = ogDescMatch?.[1] || metaDescMatch?.[1] || "";

  const images: string[] = [];
  const ogImageMatch = html.match(
    /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i,
  );
  if (ogImageMatch) images.push(ogImageMatch[1]);

  const priceMatch = html.match(
    /(?:price|amount)[^>]*>[\s$\u00a3\u20ac]*(\d+[.,]\d{2})/i,
  );

  return {
    products: [
      {
        name: name.trim(),
        description: description.trim(),
        price: priceMatch
          ? parseFloat(priceMatch[1].replace(",", "."))
          : null,
        currency: "USD",
        images,
        category: null,
        source: "generic",
      },
    ],
    blocked_by_robots: false,
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    // Auth is optional for scraping, but affects rate limits and saving.
    // If Authorization is present, enforce it strictly so invalid sessions
    // return 401 instead of silently downgrading to anonymous mode.
    const authHeader = req.headers.get("Authorization");
    const userId = authHeader ? await requireUserId(req) : null;

    const rateLimitKey =
      (userId ?? req.headers.get("x-forwarded-for")) || "anon";
    const limit = userId ? 60 : 10;
    if (!rateLimit(rateLimitKey, limit)) {
      return json(
        { detail: "Rate limit exceeded. Try again later." },
        cors,
        429,
      );
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return json({ detail: "url is required" }, cors, 400);
    }

    const parsed = await validateUrl(url);
    const origin = parsed.origin;

    let products: ProductData[] = [];
    let source: "shopify" | "generic" = "shopify";
    let platform: "shopify" | "generic" = "shopify";
    let blockedByRobots = false;
    let fallbackAvailable = false;

    // Try Shopify first
    const shopifyProducts = await tryShopify(origin);

    if (shopifyProducts && shopifyProducts.length > 0) {
      products = shopifyProducts;
      source = "shopify";
      platform = "shopify";
    } else {
      // Fall back to generic scraping
      source = "generic";
      platform = "generic";
      fallbackAvailable = true;
      const result = await scrapeGeneric(url, origin);
      products = result.products;
      blockedByRobots = result.blocked_by_robots;
    }

    // Generate brand summary from ALL products (graceful degradation)
    let brandSummary: BrandSummary | null = null;
    let brandSummaryError: string | null = null;

    if (products.length > 0) {
      brandSummary = await generateBrandSummary(products);
      if (!brandSummary) {
        brandSummaryError = "Brand summary generation failed or timed out";
      }
    }

    // Save products as unconfirmed if authenticated (no limit check — limits are
    // enforced later in confirm-products when the user actually confirms a brand).
    let savedIds: (string | null)[] = products.map(() => null);
    if (userId && products.length > 0) {
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
      const { data: inserted } = await sb
        .from("products")
        .insert(rows)
        .select("id");
      if (inserted) {
        savedIds = inserted.map((r: { id: string }) => r.id);
      }
    }

    return json(
      {
        data: {
          products: products.map((p, i) => ({
            ...p,
            brand_summary: brandSummary,
            id: savedIds[i],
          })),
          source,
          platform,
          brand_summary: brandSummary,
          brand_summary_error: brandSummaryError,
          blocked_by_robots: blockedByRobots,
          fallback_available: fallbackAvailable,
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
      msg.includes("internal") ||
      msg.includes("Content-Type") ||
      msg.includes("blocks automated") ||
      msg.includes("HTTP 403") ||
      msg.includes("HTTP 401") ||
      msg.includes("HTTP 429")
    ) {
      return json({ detail: msg }, cors, 400);
    }
    console.error("scrape-product error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
