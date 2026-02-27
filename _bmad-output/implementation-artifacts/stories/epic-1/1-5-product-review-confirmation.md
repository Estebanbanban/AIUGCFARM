# Story 1.5: Product Review and Confirmation

Status: ready-for-dev

## Story

As a **store owner viewing scraped products**,
I want to **review, inline-edit, and confirm my imported product data**,
So that **I can correct any scraping inaccuracies before using the data for video generation**.

## Acceptance Criteria

1. **Given** the `scrape-product/` Edge Function returns products
   **When** the landing page displays results
   **Then** each product is shown as a card with: image (first from array), name, price, and truncated description
   **And** the AI brand summary is displayed above the product grid showing tone badge, demographic, and selling points list
   **And** a loading skeleton is shown during the scrape request

2. **Given** an authenticated user is viewing scraped products
   **When** they click an "Edit" icon on a product card
   **Then** the product name, description, and price fields become inline-editable
   **And** a "Save" / "Cancel" control appears on the card

3. **Given** the user has reviewed products (with or without edits) and clicks "Confirm All"
   **When** the `confirm-products/` Edge Function is called
   **Then** each product is inserted into the `products` table with `confirmed = true` and the correct `source` value (`shopify` or `generic`)
   **And** the brand summary is stored in the `brand_summary` JSONB column on each product
   **And** `owner_id` is set to the authenticated user's ID
   **And** a success toast is shown: "Products saved successfully!"

4. **Given** an unauthenticated user views the scrape results
   **When** they attempt to confirm/save products
   **Then** a prompt appears: "Sign up to save your products" with a CTA to the auth flow
   **And** the scraped data persists in browser state so it's not lost during signup

5. **Given** the scrape returns zero products
   **When** the results section renders
   **Then** a friendly empty state message is shown: "We couldn't find products on this page"
   **And** a "Upload manually" CTA links to the manual upload form (Story 1.6)

6. **Given** the scrape request fails (network error, 429 rate limit, SSRF block)
   **When** the error response is received
   **Then** a toast notification displays the error message from the `detail` field
   **And** the URL input is re-enabled for retry

## Tasks / Subtasks

- [ ] Create database migration `supabase/migrations/001_initial_schema.sql` (AC: 3)
  - [ ] `products` table per architecture.md schema:
    ```sql
    CREATE TABLE products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      store_url TEXT,
      name TEXT NOT NULL,
      description TEXT,
      price DECIMAL(10,2),
      currency TEXT DEFAULT 'USD',
      category TEXT,
      images JSONB NOT NULL DEFAULT '[]',
      brand_summary JSONB,
      source TEXT NOT NULL CHECK (source IN ('shopify', 'generic', 'manual')),
      confirmed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ```
  - [ ] RLS policy: `auth.uid() = owner_id` for all operations
  - [ ] Index on `owner_id`
  - [ ] Create shared `update_updated_at()` trigger function (reused by future tables)
  - [ ] Apply `updated_at` trigger to `products`
- [ ] Create `supabase/functions/confirm-products/index.ts` (AC: 3)
  - [ ] Accept POST `{ products: Product[], brand_summary: BrandSummary | null }`
  - [ ] Auth: **required** (`requireUserId`)
  - [ ] For each product: insert into `products` table with `owner_id`, `confirmed = true`, `brand_summary`
  - [ ] Return `{ data: { confirmed_count: number } }`
- [ ] Create Supabase browser client `lib/supabase.ts` (AC: all)
  - [ ] `createBrowserClient` using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Create API wrapper `lib/api.ts` (AC: all)
  - [ ] `callEdge<T>(fn, { method?, body?, token? })` generic helper
  - [ ] `scrapeProduct(url: string, token?: string)` — calls `scrape-product/`
  - [ ] `confirmProducts(products: Product[], brandSummary: BrandSummary | null, token: string)` — calls `confirm-products/`
- [ ] Build `components/products/scrape-form.tsx` (AC: 1, 6)
  - [ ] URL input + submit button (replaces static input from Story 1.1)
  - [ ] Loading state with disabled input during request
  - [ ] Error handling with toast on failure
- [ ] Build `components/products/product-card.tsx` (AC: 1, 2)
  - [ ] Display mode: image, name, price, truncated description
  - [ ] Edit mode: inline editable name (Input), price (Input), description (Textarea)
  - [ ] Edit/Save/Cancel controls
- [ ] Build `components/products/scrape-results.tsx` (AC: 1, 2, 3, 4, 5)
  - [ ] Product grid using `ProductCard` components
  - [ ] Brand summary display above grid (tone badge, demographic text, selling points as pills)
  - [ ] "Confirm All" button (visible only if authenticated)
  - [ ] "Sign up to save" prompt (visible if unauthenticated)
  - [ ] Empty state with manual upload CTA
- [ ] Integrate into landing page hero section (AC: all)
  - [ ] Replace static URL input with `ScrapeForm`
  - [ ] Show `ScrapeResults` below hero after successful scrape
- [ ] Install shadcn toast component and wire error handling (AC: 6)

## Dev Notes

- The `products` table schema is defined in architecture.md — use it exactly
- This migration also creates the shared `update_updated_at()` trigger function — it will be reused by `personas`, `subscriptions`, `credit_balances` tables in later epics
- `confirm-products/` receives the **full product array from the frontend** (which may include edits). It does NOT re-fetch from the scraper. The frontend is the source of truth after editing
- Auth is **required** for `confirm-products/` but **optional** for `scrape-product/`. The UI should show different CTAs based on auth state
- Until Epic 2 is built, test `confirm-products/` with Supabase-issued tokens via CLI: `supabase functions invoke confirm-products --body '...' --token <jwt>`
- The Edge Function uses `getAdminClient()` (service_role) to write to the `products` table, bypassing RLS. It verifies the user is authenticated and sets `owner_id` to the JWT's user ID
- `brand_summary` is stored as JSONB: `{ tone: string, demographic: string, selling_points: string[] }`
- Unconfirmed product data purge (DR2): document as ops/cron task for now. Don't build the purge mechanism in this story
- Frontend API client: `callEdge<T>()` supports optional `token` param — if present, sets `Authorization: Bearer ${token}`. This allows the same function to work for both auth and unauth calls

### Project Structure Notes

```
supabase/
├── migrations/
│   └── 001_initial_schema.sql        # products table, RLS, triggers, indexes
└── functions/
    ├── _shared/                       # from Story 1.2
    └── confirm-products/
        └── index.ts

frontend/src/
├── lib/
│   ├── supabase.ts                   # NEW — browser client
│   ├── api.ts                        # NEW — Edge Function wrappers
│   └── types.ts                      # UPDATED — Product, BrandSummary, ScrapeResponse
└── components/
    └── products/
        ├── scrape-form.tsx           # NEW — URL input wired to backend
        ├── product-card.tsx          # NEW — display + edit mode
        └── scrape-results.tsx        # NEW — grid + brand summary + confirm
```

### References

- [Source: architecture.md#Database Schema — products]
- [Source: architecture.md#Row Level Security Policies — products]
- [Source: architecture.md#Database Triggers — update_updated_at]
- [Source: architecture.md#Endpoints — confirm-products/]
- [Source: architecture.md#API Call Pattern (Frontend)]
- [Source: architecture.md#Key Components — products/]
- [Source: PRD#FR4 — Review, inline-edit, confirm]
- [Source: PRD#FR1, FR2, FR3 — Display of scraped data]
- [Source: PRD#DR2 — 24h purge of unconfirmed data]
- [Source: PRD#UJ1 — Steps 2-4 (scraping + viewing + editing)]
