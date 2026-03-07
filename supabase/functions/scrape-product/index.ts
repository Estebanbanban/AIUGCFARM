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
  source: "shopify" | "generic" | "saas";
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
// SaaS detection heuristic  -  requires 3+ signals to reduce false positives
// ---------------------------------------------------------------------------

function detectSaaS(html: string): boolean {
  const lower = html.toLowerCase();
  let score = 0;

  if (/pricing|plans?\b/.test(lower)) score++;
  if (/free trial|start for free|try for free/.test(lower)) score++;
  if (/\bdashboard\b|\bapi\b/.test(lower)) score++;
  if (!/<meta[^>]+property="og:price/i.test(html)) score++;
  if (!/"priceCurrency"|"price"\s*:\s*"\d/.test(html)) score++;
  if (!(/([$£€]\s*\d{1,6}(?:[.,]\d{2})?)/.test(html))) score++;

  return score >= 3;
}

// ---------------------------------------------------------------------------
// SaaS multi-page scraper
// ---------------------------------------------------------------------------

const SAAS_SUB_PATHS = ["/pricing", "/features", "/product", "/solutions", "/about"];

async function scrapeSaaS(
  url: string,
  origin: string,
  landingHtml: string,
  signal: AbortSignal,
): Promise<ProductData> {
  const titleMatch = landingHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
  const ogTitleMatch = landingHtml.match(
    /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i,
  );
  const name = (ogTitleMatch?.[1] || titleMatch?.[1] || "Unknown Service").trim();

  const images: string[] = [];
  const ogImageMatch = landingHtml.match(
    /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i,
  );
  if (ogImageMatch) images.push(ogImageMatch[1]);

  // Collect candidate sub-page URLs from landing HTML links — SSRF-safe
  const originUrl = new URL(origin);
  const candidateUrls: string[] = [];
  for (const m of landingHtml.matchAll(/href="([^"]+)"/gi)) {
    const href = m[1];
    let resolved: URL;
    try {
      resolved = new URL(href, origin);
    } catch {
      continue;
    }
    // SSRF guard: only same-origin links
    if (resolved.origin !== originUrl.origin) continue;
    const pathname = resolved.pathname.replace(/\/$/, "").toLowerCase();
    if (SAAS_SUB_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      candidateUrls.push(resolved.toString());
    }
  }

  // Deduplicate, check robots.txt per path, cap at 3
  const seen = new Set<string>();
  const allowedUrls: string[] = [];
  for (const cu of candidateUrls) {
    if (seen.has(cu)) continue;
    seen.add(cu);
    const pathname = new URL(cu).pathname;
    const robotsOk = await isAllowedByRobots(origin, pathname);
    if (robotsOk) allowedUrls.push(cu);
    if (allowedUrls.length >= 3) break;
  }

  // Fetch sub-pages in parallel with per-page 3s timeout
  const subPageTexts: string[] = [stripHtml(landingHtml)];
  if (allowedUrls.length > 0) {
    const results = await Promise.allSettled(
      allowedUrls.map(async (subUrl) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3_000);
        try {
          const res = await safeFetch(subUrl, {
            headers: BROWSER_HEADERS,
            signal: ctrl.signal,
          });
          if (!res.ok) return "";
          const subHtml = await res.text();
          return stripHtml(subHtml);
        } catch {
          return "";
        } finally {
          clearTimeout(timer);
        }
      }),
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) subPageTexts.push(r.value);
    }
  }

  // Concatenate corpus — cap at 3000 chars
  const corpus = subPageTexts.join(" ").replace(/\s+/g, " ").trim().slice(0, 3000);

  // Extract monthly price from corpus
  const priceMatch = corpus.match(/\$(\d+(?:\.\d{2})?)\s*(?:\/\s*mo(?:nth)?|per month)/i);
  const price = priceMatch ? parseFloat(priceMatch[1]) : null;

  if (signal.aborted) throw new Error("SaaS scrape timed out");

  return {
    name,
    description: corpus.slice(0, 800),
    price,
    currency: "USD",
    images,
    category: null,
    source: "saas",
  };
}

// ---------------------------------------------------------------------------
// OG tag fallback helper
// ---------------------------------------------------------------------------

function ogTagFallback(html: string): ProductData {
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
    name: name.trim(),
    description: description.trim(),
    price: priceMatch ? parseFloat(priceMatch[1].replace(",", ".")) : null,
    currency: "USD",
    images,
    category: null,
    source: "generic",
  };
}

// ---------------------------------------------------------------------------
// Generic scraper  -  JSON-LD first, SaaS detection, OG tags fallback
// ---------------------------------------------------------------------------

async function scrapeGeneric(
  url: string,
  origin: string,
): Promise<{ products: ProductData[]; blocked_by_robots: boolean; platform: "generic" | "saas" }> {
  const parsedUrl = new URL(url);

  // Check robots.txt before fetching
  const allowed = await isAllowedByRobots(origin, parsedUrl.pathname);
  if (!allowed) {
    return { products: [], blocked_by_robots: true, platform: "generic" };
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
    return { products: jsonLdProducts, blocked_by_robots: false, platform: "generic" };
  }

  // SaaS detection: run multi-page crawl if it looks like a SaaS site
  if (detectSaaS(html)) {
    const saasController = new AbortController();
    const saasTimer = setTimeout(() => saasController.abort(), 25_000);
    let result: ProductData;
    let detectedPlatform: "generic" | "saas" = "saas";
    try {
      result = await scrapeSaaS(url, origin, html, saasController.signal);
    } catch {
      // Timeout or error — fall back to OG-tag scrape
      result = ogTagFallback(html);
      detectedPlatform = "generic";
    } finally {
      clearTimeout(saasTimer);
    }
    return { products: [result], blocked_by_robots: false, platform: detectedPlatform };
  }

  // Fallback: OG tags / meta tags
  return {
    products: [ogTagFallback(html)],
    blocked_by_robots: false,
    platform: "generic",
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
    let source: "shopify" | "generic" | "saas" = "shopify";
    let platform: "shopify" | "generic" | "saas" = "shopify";
    let blockedByRobots = false;
    let fallbackAvailable = false;

    // Try Shopify first
    const shopifyProducts = await tryShopify(origin);

    if (shopifyProducts && shopifyProducts.length > 0) {
      products = shopifyProducts;
      source = "shopify";
      platform = "shopify";
    } else {
      // Fall back to generic/SaaS scraping
      fallbackAvailable = true;
      const result = await scrapeGeneric(url, origin);
      products = result.products;
      blockedByRobots = result.blocked_by_robots;
      platform = result.platform;
      source = result.platform; // source matches platform for generic/saas
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
