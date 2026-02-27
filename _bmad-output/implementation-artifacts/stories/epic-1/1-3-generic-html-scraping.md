# Story 1.3: Generic HTML Scraping Fallback

Status: ready-for-dev

## Story

As a **store owner on a non-Shopify platform**,
I want the **system to attempt scraping my store using HTML parsing**,
So that **I can still auto-import products without manual entry**.

## Acceptance Criteria

1. **Given** a URL that is not a Shopify store (i.e., `/products.json` returned 404 or invalid JSON)
   **When** the `scrape-product/` Edge Function processes it
   **Then** it fetches the HTML of the provided URL
   **And** attempts to extract product data using (in priority order):
     1. JSON-LD / schema.org `Product` or `ProductGroup` structured data
     2. Open Graph meta tags (`og:title`, `og:image`, `og:description`, `product:price:amount`)
     3. Common microdata attributes (`[itemprop="name"]`, `[itemprop="price"]`, `[itemprop="image"]`)
   **And** returns `{ data: { products: Product[], platform: 'generic' } }`

2. **Given** the HTML parsing extracts zero products
   **When** the response is returned
   **Then** the response includes `{ data: { products: [], platform: 'generic', fallback_available: true } }`
   **And** the frontend can prompt the user to try manual upload (Story 1.7)

3. **Given** the target URL returns non-HTML content (PDF, image, binary)
   **When** the response Content-Type is checked
   **Then** the Edge Function returns `{ data: { products: [], platform: 'unknown', error: 'Page content is not HTML' } }`

4. **Given** the target URL's `robots.txt` disallows the scraping path
   **When** robots.txt is checked before fetching the page
   **Then** the Edge Function returns `{ data: { products: [], blocked_by_robots: true } }`
   **And** the frontend shows a message explaining the site doesn't allow automated access

5. **Given** multiple parsing strategies find overlapping data
   **When** results are merged
   **Then** JSON-LD data takes priority over Open Graph, which takes priority over microdata
   **And** no duplicate products in the final array

## Tasks / Subtasks

- [ ] Add robots.txt checking to `scrape-product/` before HTML fetch (AC: 4)
  - [ ] Fetch `{origin}/robots.txt` with 3s timeout (non-blocking if robots.txt doesn't exist)
  - [ ] Parse for `Disallow` rules matching the target path
  - [ ] If disallowed, return early with `blocked_by_robots: true`
- [ ] Add Content-Type validation after fetching the URL (AC: 3)
  - [ ] Check `Content-Type` header for `text/html`
  - [ ] Return error for non-HTML responses
- [ ] Implement JSON-LD parser (AC: 1, 5)
  - [ ] Extract all `<script type="application/ld+json">` blocks via regex
  - [ ] Parse each as JSON, find objects with `@type: "Product"` or `@type: "ProductGroup"`
  - [ ] Map to `Product` type: name from `name`, price from `offers.price`, image from `image`, description from `description`
- [ ] Implement Open Graph parser (AC: 1, 5)
  - [ ] Extract `<meta property="og:*">` tags via regex
  - [ ] Map `og:title` → name, `og:image` → images[0], `og:description` → description
  - [ ] Extract `product:price:amount` and `product:price:currency` if present
- [ ] Implement microdata parser (AC: 1, 5)
  - [ ] Extract elements with `itemprop` attributes via regex
  - [ ] Map `itemprop="name"` → name, `itemprop="price"` → price, `itemprop="image"` → images
- [ ] Merge and deduplicate results from all parsers (AC: 5)
  - [ ] Priority: JSON-LD > Open Graph > microdata
  - [ ] Deduplicate by product name (case-insensitive)
  - [ ] Normalize all results to the same `Product` type used by Shopify path
- [ ] Handle empty results gracefully (AC: 2)
  - [ ] Return `fallback_available: true` flag so frontend knows to show manual upload CTA

## Dev Notes

- This story **modifies** `supabase/functions/scrape-product/index.ts`  -  do NOT create a new Edge Function
- Deno does not include a full DOM parser. Use **regex-based extraction** for meta tags and script blocks. This is acceptable for MVP  -  JSON-LD is the most reliable source and regex handles `<script>` block extraction well
- Consider importing `deno-dom` if regex becomes unmanageable, but avoid heavy dependencies
- Keep parsing heuristics **simple** for MVP:
  - JSON-LD is the gold standard  -  most modern e-commerce platforms emit it
  - Open Graph is reliable for single-product pages
  - Microdata/itemprop is a last resort
- The generic scraper will **never** be as accurate as Shopify JSON  -  that's expected. Manual upload (Story 1.7) catches what the scraper misses
- robots.txt check should be **non-blocking**  -  if `/robots.txt` returns 404 or times out, proceed with scraping
- Total time budget remains < 15s: ~1s robots.txt + ~3s HTML fetch + ~1s parsing = well within budget
- HTML response size is already capped at 5MB by `validateUrl()` from Story 1.2

### References

- [Source: architecture.md#Endpoints  -  scrape-product/  -  generic HTML fallback]
- [Source: PRD#FR6  -  Shopify-first + generic fallback]
- [Source: PRD#DR2  -  robots.txt compliance]
- [Source: PRD#NFR1  -  < 15s scraping time]
