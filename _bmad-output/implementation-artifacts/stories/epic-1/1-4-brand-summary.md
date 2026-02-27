# Story 1.4: AI Brand Summary Generation

Status: ready-for-dev

## Story

As a **store owner**,
I want an **AI-generated brand summary (tone, target demographic, key selling points) from my scraped products**,
So that **future video scripts automatically match my brand voice without manual input**.

## Acceptance Criteria

1. **Given** the `scrape-product/` Edge Function has successfully extracted at least 1 product
   **When** the product extraction step completes
   **Then** the function calls OpenAI GPT-4o with the product data (names, descriptions, prices, categories)
   **And** uses `response_format: { type: "json_object" }` for structured output
   **And** receives a brand summary containing:
     - `tone`: string (e.g., "casual and playful", "premium and authoritative")
     - `demographic`: string (e.g., "women 25-35, fitness-conscious")
     - `selling_points`: string[] (3-5 key selling points derived from the product catalog)
   **And** the brand summary is included in the final response:
     `{ data: { products: Product[], brand_summary: BrandSummary, platform: string } }`

2. **Given** the OpenAI API call fails (timeout, rate limit, 500 error)
   **When** the scrape response is assembled
   **Then** products are still returned successfully with `brand_summary: null`
   **And** a warning field is included: `brand_summary_error: "Unable to generate brand summary. You can proceed without it."`
   **And** the scraping does **NOT** fail entirely — the user gets their products regardless

3. **Given** only 1 product was scraped
   **When** the brand summary prompt is built
   **Then** the summary is still generated from the available data
   **And** the prompt makes clear that limited data is available

4. **Given** the OpenAI call takes longer than 10 seconds
   **When** the timeout fires
   **Then** the call is aborted and treated as a failure (AC: 2 applies)
   **And** the total scrape response still completes within the 15s NFR1 target

## Tasks / Subtasks

- [ ] Add OpenAI GPT-4o call to `scrape-product/` after product extraction (AC: 1)
  - [ ] Build system prompt: "You are a brand analyst. Given a list of products from an e-commerce store, analyze the brand..."
  - [ ] Build user prompt: include product names, descriptions, prices, categories from scraped data
  - [ ] Request `response_format: { type: "json_object" }` for guaranteed parseable output
  - [ ] Parse response into `BrandSummary` type: `{ tone: string, demographic: string, selling_points: string[] }`
  - [ ] Enforce 10-second timeout on the OpenAI call via `AbortController`
- [ ] Handle OpenAI failure gracefully (AC: 2, 4)
  - [ ] Wrap OpenAI call in try/catch
  - [ ] On failure: set `brand_summary: null` and `brand_summary_error` in response
  - [ ] Log error to console for server-side debugging
  - [ ] Do NOT retry the brand summary call — it's not critical enough to delay the response
- [ ] Add `OPENAI_API_KEY` to Supabase Edge Function secrets (AC: 1)
  - [ ] Document: `supabase secrets set OPENAI_API_KEY=sk-...`
- [ ] Update `lib/types.ts` with `BrandSummary` type definition (AC: 1)
  - [ ] `type BrandSummary = { tone: string; demographic: string; selling_points: string[] }`
  - [ ] Update `ScrapeResponse` type to include `brand_summary: BrandSummary | null`

## Dev Notes

- The brand summary call happens **sequentially AFTER** product extraction — we need product data as input to the prompt
- Time budget: ~5-8s for product extraction + ~5-7s for OpenAI = within 15s target (NFR1)
- Use `response_format: { type: "json_object" }` — this guarantees GPT-4o returns valid JSON, no parsing failures
- The brand summary is **informational** at this stage — it becomes critical input for video script generation in Epic 5 (`generate-video/` uses it to tune script tone)
- Do **NOT** store the brand summary in the database yet — persistence happens in Story 1.5/1.6 when products are confirmed. At this point it's returned in the API response and held in frontend state
- Do **NOT** retry the OpenAI call — brand summary is non-critical and we can't afford to add retry delay to the 15s time budget. The user can proceed without it
- OpenAI API key: set via `supabase secrets set OPENAI_API_KEY=sk-...` — never in code or `.env` files committed to git
- The prompt should be concise — send product summaries, not full descriptions. Truncate long descriptions to ~200 chars each

### Prompt Design

```
System: You are a brand analyst specializing in e-commerce. Given product data from an online store, analyze the brand and return a JSON object with exactly these fields:
- tone: A 2-5 word description of the brand's voice (e.g., "casual and playful")
- demographic: The target audience in one sentence (e.g., "women 25-35, fitness-conscious")
- selling_points: Array of 3-5 key selling points derived from the products

User: Here are the products from the store:
[Product list with name, price, description snippet, category]
```

### References

- [Source: architecture.md#External API Integration Contracts — OpenAI]
- [Source: architecture.md#Endpoints — scrape-product/ step 6]
- [Source: PRD#FR3 — AI brand summary generation]
- [Source: PRD#UJ1.3 — AI brand summary displayed alongside products]
- [Source: PRD#NFR1 — Total scrape < 15s]
