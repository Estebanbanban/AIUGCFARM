# Story 1.2: Shopify Store Scraping

Status: ready-for-dev

## Story

As a **store owner**,
I want to **paste my Shopify store URL and have products automatically imported**,
So that **I don't have to manually enter product information**.

## Acceptance Criteria

1. **Given** a valid Shopify store URL is submitted (e.g., `https://example.myshopify.com`)
   **When** the `scrape-product/` Edge Function is called with `POST { url: string }`
   **Then** it detects the Shopify platform by checking for `/products.json` endpoint
   **And** extracts per product: name, images (primary + variants), description (HTML stripped), price, and category/tags
   **And** returns `{ data: { products: Product[], platform: 'shopify' } }` within 15 seconds for up to 50 products

2. **Given** a URL is submitted
   **When** SSRF validation runs
   **Then** private IPs (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x) are blocked
   **And** internal Supabase URLs are blocked
   **And** only HTTP and HTTPS schemes are allowed
   **And** response size is capped at 5MB
   **And** fetch timeout is enforced at 15 seconds

3. **Given** an unauthenticated caller
   **When** they exceed 10 scrape requests in 1 hour from the same IP
   **Then** the Edge Function returns HTTP 429 with `{ detail: "Too many requests" }`

4. **Given** an authenticated caller
   **When** they make scrape requests
   **Then** the rate limit is 60 requests per hour (keyed by user ID instead of IP)

5. **Given** a URL that is not a valid Shopify store
   **When** the `/products.json` check returns non-JSON or 404
   **Then** the function returns `{ data: { products: [], platform: 'unknown' } }` (generic fallback handled in Story 1.3)

6. **Given** a Shopify store with > 30 products
   **When** the first page of `/products.json` is fetched
   **Then** pagination is handled via `?page=N` until all products fetched (capped at 50 products)

7. **Given** the request body is missing `url` or contains an invalid URL format
   **When** the Edge Function validates the input
   **Then** it returns HTTP 400 with `{ detail: "Valid URL required" }`

## Tasks / Subtasks

- [ ] Create shared Edge Function helpers in `supabase/functions/_shared/` (AC: all)
  - [ ] `cors.ts`  -  `getCorsHeaders(req)` returns CORS headers allowing frontend origin
  - [ ] `response.ts`  -  `json(body, cors, status?)` wraps response with headers
  - [ ] `auth.ts`  -  `requireUserId(req)` throws "Unauthorized" if no valid JWT; `optionalUserId(req)` returns userId or null
  - [ ] `supabase.ts`  -  `getAdminClient()` creates service_role Supabase client using env vars
  - [ ] `ssrf.ts`  -  `validateUrl(url)` validates scheme, resolves hostname, blocks private/reserved IPs, returns validated URL
  - [ ] `rate-limit.ts`  -  in-memory Map-based rate limiter with `checkRateLimit(key, maxRequests, windowMs)` returning boolean
- [ ] Create `supabase/functions/scrape-product/index.ts` (AC: 1, 5, 6, 7)
  - [ ] `Deno.serve()` entrypoint following standard Edge Function pattern
  - [ ] OPTIONS → return CORS
  - [ ] POST only (reject other methods with 405)
  - [ ] Parse and validate `{ url: string }` from request body
  - [ ] `optionalUserId(req)` for optional auth
  - [ ] `validateUrl(url)` for SSRF protection
  - [ ] Rate limit check: 10/hr by IP (unauth) or 60/hr by userId (auth)
  - [ ] Normalize URL: strip trailing slash, ensure scheme
  - [ ] Shopify detection: `fetch(\`${normalizedUrl}/products.json\`)`  -  check for valid JSON with `.products` array
  - [ ] Parse Shopify products: map each to `{ name, images: string[], description: string, price: number, currency: string, category: string, tags: string[] }`
  - [ ] Strip HTML from descriptions using regex (no DOM parser needed for Shopify)
  - [ ] Handle Shopify pagination: loop `?page=N&limit=30` while products returned, cap at 50 total
  - [ ] Return `{ data: { products, platform: 'shopify' } }`
  - [ ] If not Shopify: return `{ data: { products: [], platform: 'unknown' } }`
- [ ] Write unit tests for SSRF validation (AC: 2)
  - [ ] Test: private IPs blocked (10.0.0.1, 172.16.0.1, 192.168.1.1, 127.0.0.1)
  - [ ] Test: localhost/metadata IPs blocked (169.254.169.254)
  - [ ] Test: valid public URLs pass
  - [ ] Test: non-HTTP schemes rejected (ftp://, file://, javascript:)

## Dev Notes

- Every Edge Function follows this exact structure:
  ```typescript
  import { getCorsHeaders } from "../_shared/cors.ts";
  import { optionalUserId } from "../_shared/auth.ts";
  import { json } from "../_shared/response.ts";

  Deno.serve(async (req: Request) => {
    const cors = getCorsHeaders(req);
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

    try {
      const userId = await optionalUserId(req);
      // ... business logic ...
      return json({ data }, cors);
    } catch (e: any) {
      if (e.message === "Rate limited") return json({ detail: "Too many requests" }, cors, 429);
      console.error(e);
      return json({ detail: "Internal error" }, cors, 500);
    }
  });
  ```
- `scrape-product/` auth is **optional**  -  use `optionalUserId()` not `requireUserId()`
- Response format: `{ data: {...} }` on success, `{ detail: "..." }` on error
- Shopify detection: Shopify stores reliably expose `/products.json`  -  this is the simplest and fastest detection method
- Rate limiting is **in-memory** per Edge Function instance  -  acceptable for MVP. State resets on cold start. Upgrade to Redis/KV in Phase 2 if needed
- SSRF: Deno's `fetch()` does DNS resolution  -  we need to validate the **resolved IP**, not just the hostname. Use `Deno.resolveDns()` or validate after initial response headers
- Edge Function timeout: Supabase Edge Functions have ~60s limit. Shopify `/products.json` for 50 products should complete well within 15s
- No `OPENAI_API_KEY` needed yet  -  brand summary added in Story 1.4

### Project Structure Notes

```
supabase/functions/
├── _shared/
│   ├── cors.ts
│   ├── response.ts
│   ├── auth.ts
│   ├── supabase.ts
│   ├── ssrf.ts
│   └── rate-limit.ts
└── scrape-product/
    └── index.ts
```

### References

- [Source: architecture.md#Edge Function Pattern]
- [Source: architecture.md#Endpoints  -  scrape-product/]
- [Source: architecture.md#AD6: SSRF Protection on Scraping]
- [Source: architecture.md#Shared Helpers (_shared/)]
- [Source: PRD#FR1  -  Store URL submission]
- [Source: PRD#FR2  -  Product data extraction]
- [Source: PRD#FR6  -  Shopify as primary target]
- [Source: PRD#NFR1  -  Scraping < 15s]
- [Source: PRD#NFR11  -  Rate limiting]
