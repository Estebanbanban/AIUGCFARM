# Story 1.8: Scraping Error Handling

Status: ready-for-dev

## Story

As a **store owner**,
I want **clear, actionable feedback when scraping fails or partially succeeds**,
So that **I know exactly what went wrong and what to do next**.

## Acceptance Criteria

1. **Given** the user submits a URL that returns an SSRF validation error
   **When** the Edge Function responds with HTTP 400
   **Then** the frontend displays a toast: "This URL can't be accessed for security reasons. Please try a different URL."
   **And** the URL input is re-enabled

2. **Given** the user has exceeded the rate limit (10/hr unauth, 60/hr auth)
   **When** the Edge Function responds with HTTP 429
   **Then** the frontend displays a toast: "Too many requests. Please wait a few minutes and try again."
   **And** the URL input is re-enabled

3. **Given** the target website is unreachable (DNS failure, timeout, connection refused)
   **When** the Edge Function catches a network error
   **Then** it returns `{ detail: "Unable to reach this website. Please check the URL and try again." }` with HTTP 502
   **And** the frontend displays this message as a toast

4. **Given** the scrape succeeds but robots.txt blocks access
   **When** the response includes `blocked_by_robots: true`
   **Then** the frontend shows an inline message: "This website doesn't allow automated access. You can upload your products manually."
   **And** a "Upload manually" CTA is displayed

5. **Given** a scrape completes but extracts zero products
   **When** the response includes `products: []` with `fallback_available: true`
   **Then** the frontend shows: "We couldn't find product data on this page. Try a different URL or upload manually."
   **And** both "Try another URL" and "Upload manually" CTAs are shown

6. **Given** any unexpected server error occurs in the Edge Function
   **When** the error is caught in the catch block
   **Then** the error is logged to `console.error` with the full stack trace (server-side only)
   **And** the client receives `{ detail: "Something went wrong. Please try again." }` with HTTP 500
   **And** no internal error details or stack traces are exposed to the client

7. **Given** brand summary generation fails but product extraction succeeds
   **When** the response is returned
   **Then** products are displayed normally
   **And** the brand summary section shows a subtle notice: "Brand analysis unavailable — you can add this later"
   **And** the user can still confirm and save products

## Tasks / Subtasks

- [ ] Audit `scrape-product/` Edge Function error handling (AC: 1, 2, 3, 6)
  - [ ] Ensure SSRF errors return HTTP 400 with descriptive detail
  - [ ] Ensure rate limit errors return HTTP 429
  - [ ] Catch `fetch()` failures (DNS, timeout, connection) and return HTTP 502
  - [ ] Ensure the catch-all block returns HTTP 500 with generic message
  - [ ] Verify no stack traces or internal details leak in any error response
- [ ] Add network error handling in `scrape-product/` (AC: 3)
  - [ ] Wrap external `fetch()` calls in try/catch
  - [ ] Distinguish between network errors (502) and parsing errors (500)
  - [ ] Handle Shopify rate limiting (429 from Shopify) — pass through as "Website temporarily unavailable"
- [ ] Update `components/products/scrape-results.tsx` for all error states (AC: 4, 5, 7)
  - [ ] robots.txt blocked state: message + manual upload CTA
  - [ ] Zero products state: message + "Try another URL" + "Upload manually" CTAs
  - [ ] Brand summary failure state: products shown + subtle notice in brand summary area
- [ ] Update `components/products/scrape-form.tsx` for error recovery (AC: 1, 2, 3)
  - [ ] Toast notifications for 400, 429, 502, 500 errors
  - [ ] Re-enable URL input after any error
  - [ ] Allow immediate retry (no artificial delay)
- [ ] Add error boundary for unexpected React rendering errors (AC: 6)
  - [ ] Wrap scrape results section in an error boundary
  - [ ] Fallback UI: "Something went wrong displaying results. Please try again."

## Dev Notes

- **Error response format** is standardized: `{ detail: "Human-readable message" }` — the frontend can always read `.detail` for user-facing text
- **Never expose** internal error messages, API keys, or stack traces in responses. Always use generic messages. Log the real error server-side via `console.error`
- **Toast vs inline messages:** Use toasts for transient errors (network, rate limit) that the user can retry. Use inline messages for states that require user action (empty results, robots.txt block)
- **Shopify rate limiting:** Shopify may return 429 if we fetch `/products.json` too aggressively. Handle this as "Website temporarily unavailable" — the user can retry
- This story is primarily a **polish pass** on error handling introduced in Stories 1.2-1.5. It should not create new endpoints or tables — only improve error handling in existing code
- Test error scenarios manually: submit localhost URLs, submit non-existent domains, submit URLs to sites with restrictive robots.txt

### Error State Matrix

| Scenario | HTTP Status | `detail` / Response Field | Frontend Display |
|----------|------------|--------------------------|------------------|
| SSRF blocked | 400 | "This URL can't be accessed for security reasons" | Toast |
| Rate limited | 429 | "Too many requests" | Toast |
| Website unreachable | 502 | "Unable to reach this website" | Toast |
| robots.txt blocks | 200 | `blocked_by_robots: true` | Inline message + manual upload CTA |
| Zero products found | 200 | `products: [], fallback_available: true` | Inline message + try again/upload CTAs |
| Brand summary failed | 200 | `brand_summary: null, brand_summary_error: "..."` | Subtle notice, products shown normally |
| Server error | 500 | "Something went wrong" | Toast |

### References

- [Source: architecture.md#Error Handling — Edge Functions, Frontend]
- [Source: architecture.md#Response Format — detail field on error]
- [Source: architecture.md#AD6: SSRF Protection on Scraping]
- [Source: PRD#NFR11 — Rate limiting]
- [Source: PRD#DR2 — robots.txt compliance]
