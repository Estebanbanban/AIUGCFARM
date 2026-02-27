---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-audit']
inputDocuments:
  - '_bmad-output/planning-artifacts/ai-ugc-generator-prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
auditDate: '2026-02-27'
auditReport: '_bmad-output/planning-artifacts/audit-report.md'
---

# AIUGC - Epic Breakdown (Audited)

## Overview

Complete epic and story breakdown for AIUGC. Decomposed from PRD v2.0 (BMAD Standard) and Architecture v1.0 (Supabase-native). Scope: **MVP (Phase 1)**.

**Audited:** 2026-02-27. All stories validated against PRD, architecture feasibility, cross-epic dependencies, and MVP scope. See `audit-report.md` for full findings.

**Architecture Stack:** Next.js 14 + Tailwind/shadcn on Vercel | Supabase (Auth + Edge Functions + PostgreSQL + Storage) | OpenRouter (`openai/gpt-oss-120b`) | NanoBanana | Kling 3.0 | Stripe

**Generation Model:** 3 variants per segment type (Hook/Body/CTA) = 9 segments per batch. 27 combinatorial video outputs. 1 credit = 1 segment. 9 credits per batch generation.

**Pricing:** Starter $29/mo (27 credits = 3 batches), Growth $79/mo (90 credits = 10 batches)

**Free Trial:** 9 segment credits (= 1 full batch = 27 video combinations)

## Epic List

| Epic | Name | Priority | Depends On | Stories |
|------|------|----------|------------|---------|
| 1 | Product Discovery — Landing, Scraping & Import | P0 | None | 6 |
| 2 | User Authentication & Account Management | P0 | None | 5 |
| 3 | AI Persona Creation | P0 | Epic 2 | 5 |
| 4 | Paywall & Subscription Billing | P0 | Epic 2 | 4 |
| 5 | AI Script & POV Image Generation | P0 | Epic 1, 2, 3, 4 | 5 |
| 6 | Video Segment Generation & Delivery | P0 | Epic 5 | 5 |
| 7 | User Dashboard & Video Library | P1 | Epic 2, 6 | 3 |

**Parallelization:** Epics 1+2 simultaneously. Epics 3+4 parallel after Epic 2. Epic 5 after 1+2+3+4 all complete. Epic 6 after 5. Epic 7 after 6 has test data.

**Total: 7 epics, 33 stories**

**Dependency Graph:**
```
Epic 1 (Products) ────────────────────┐
                                      ├─→ Epic 5 (Script & Image) ─→ Epic 6 (Video) ─→ Epic 7 (Dashboard)
Epic 2 (Auth) ──→ Epic 3 (Personas) ──┤
              └──→ Epic 4 (Billing) ──┘
```

---

## FR Coverage Map

FR1-FR6 → Epic 1 (`scrape-product/`, `confirm-products/`, `upload-product/` Edge Functions)
FR7-FR10 → Epic 2 (Supabase Auth, `profiles` table)
FR11-FR17 → Epic 3 (`generate-persona/`, `select-persona-image/` Edge Functions, `personas` table)
FR18-FR20 → Epic 5 (`generate-video/` Edge Function, OpenRouter + NanoBanana)
FR21-FR26 → Epic 6 (`generate-video/` segment submission, `video-status/`, Kling 3.0, segment review UI)
FR31-FR35 → Epic 4 (`stripe-checkout/`, `stripe-webhook/` Edge Functions, credit system)
FR37-FR38 → Epic 7 (`generation-history/` Edge Function, dashboard page)

**Deferred FRs:**
- FR23 (FFmpeg stitching) → Phase 1.5 (can't run in Edge Functions)
- FR36 (overage billing) → Phase 1.5 (Stripe metered billing complexity)

---

## Epic 1: Product Discovery — Landing Page, Scraping & Import

Users land on the platform, paste their store URL, see products auto-imported with AI brand summary — or manually upload. Landing page = marketing site + product funnel entry.

**FRs:** FR1-FR6 | **NFRs:** NFR1, NFR11 | **Domain:** DR2 | **Arch:** `scrape-product/`, `confirm-products/`, `upload-product/`, `products` table

### Story 1.1: Landing Page with URL Input CTA
As a visitor, I want to see a compelling landing page with a prominent URL input field, so that I can immediately start using the product without signing up.

**Given** a visitor loads the homepage **When** the page renders **Then** hero section displays with tagline, URL input field, and "Get Started" button **And** pricing teaser (Starter $29/mo, Growth $79/mo), feature breakdown, and FAQ sections are visible below the fold

### Story 1.2: Shopify Store Scraping (+ Basic Generic Fallback)
As a store owner, I want to paste my Shopify store URL and have products automatically imported, so that I don't have to manually enter product information.

**Given** a user submits a Shopify store URL **When** `scrape-product/` Edge Function processes the request **Then** products are extracted (name, images, description, price, category) within 15 seconds **And** SSRF validation blocks private/reserved IPs (resolved via DNS, not just hostname) before fetching **And** rate limiting enforces max 10 requests/hour for unauthenticated users **And** if not Shopify, basic JSON-LD extraction is attempted as fallback **And** robots.txt is checked before HTML fetching

> **Audit note:** Merged Story 1.3 (Generic HTML Scraping) into this story. Only JSON-LD fallback for MVP — Open Graph and microdata deferred. SSRF must validate resolved IPs, not just hostnames.

### Story 1.4: AI Brand Summary Generation
As a store owner, I want an AI-generated brand summary from my scraped products, so that generated video scripts match my brand's tone and audience.

**Given** products are successfully scraped **When** the scraping Edge Function completes extraction **Then** OpenRouter (`openai/gpt-oss-120b`) generates brand summary (tone, demographic, selling points) **And** brand summary included in response as `brand_summary` JSONB **And** if OpenRouter fails, products still returned with `brand_summary: null`

> **Audit note:** OpenAI GPT-4o replaced with OpenRouter `openai/gpt-oss-120b`. Endpoint: `openrouter.ai/api/v1/chat/completions`. Env var: `OPENROUTER_API_KEY`. Add `HTTP-Referer` and `X-Title` headers. `response_format: { type: "json_object" }` may not be supported — include JSON instruction in system prompt as fallback.

### Story 1.5: Product Review and Confirmation
As a store owner, I want to review, edit, and confirm my imported product data, so that I can correct scraping errors.

**Given** an authenticated user views scraped products **When** they edit product fields inline **Then** edits saved via `confirm-products/` **And** confirmed products have `confirmed = true` **And** unconfirmed data purged after 24 hours (DR2) **And** error states show toast for 400/429/502/500 errors with re-enabled URL input

> **Audit note:** Merged error handling from Story 1.8 into here. Toast for transient errors, inline messages for states requiring action (empty results, robots.txt block).

### Story 1.6: Manual Product Upload
As a store owner without a website, I want to manually upload product images and details.

**Given** an authenticated user navigates to product upload **When** they submit name, description, price, and images **Then** images uploaded to `product-images` Supabase Storage bucket **And** product record created with `source = 'manual'` and `confirmed = true`

### Story 1.7: Product Library Page
As an authenticated user, I want to view all my products in one place.

**Given** user navigates to `/products` **When** page loads **Then** confirmed products display in card grid with images (via signed URLs), names, prices, source badge **And** RLS ensures only user's own products visible **And** empty state with "Import from store" and "Upload manually" CTAs

---

## Epic 2: User Authentication & Account Management

Users create accounts via email or Google OAuth, log in, manage settings. Auth gate after scraping maximizes conversion.

**FRs:** FR7-FR10 | **NFRs:** NFR9, NFR10, NFR12 | **Domain:** DR4 | **Arch:** Supabase Auth, `profiles` table, DB trigger on `auth.users`

### Story 2.1: Email + Password Registration
As a new user, I want to create an account with email and password.

**Given** user navigates to `/signup` **When** they submit email and password **Then** Supabase Auth creates account **And** DB trigger creates `profiles` row + `credit_balances` with **9 free segment credits** **And** `credit_ledger` entry with `reason = 'free_trial'`, `amount = 9` **And** redirected to dashboard

> **Audit note:** Free trial credits corrected from 1 to 9 per PRD FR34. Merged Story 4.1 (Free Trial Credit on Signup) into this story since the DB trigger handles it.

### Story 2.2: Google OAuth Authentication
As a user, I want to sign in with Google.

**Given** user clicks "Sign in with Google" **When** OAuth flow completes **Then** Supabase Auth creates/matches account **And** callback at `/auth/callback` handles redirect **And** profile auto-created if new user (same trigger, same 9 credits)

### Story 2.3: Soft Auth Gate After Scraping
As a visitor who just scraped products, I want to be prompted to sign up after seeing results.

**Given** unauthenticated user completed a scrape **When** they attempt to confirm/save products **Then** auth gate appears prompting signup/login **And** scraped data persists in browser state through auth flow

### Story 2.4: Account Settings Page
As an authenticated user, I want to view and update my account settings.

**Given** user navigates to `/settings` **When** page loads **Then** shows email, name, avatar, current plan **And** user can update display name

### Story 2.5: Billing Management Portal
As a subscribed user, I want to manage my subscription and billing.

**Given** user navigates to `/settings/billing` **When** they click "Manage Billing" **Then** `stripe-portal/` creates Stripe billing portal session **And** user redirected to Stripe's hosted portal

> **Audit note:** Story 2.6 (Account Deletion) deferred to Phase 1.5. Manual process via support for MVP.

---

## Epic 3: AI Persona Creation

Users build a custom AI spokesperson via visual character builder, generate 4 image options, select preferred, persist for future generations.

**FRs:** FR11-FR17 | **NFRs:** NFR2 | **Depends on:** Epic 2 | **Arch:** `generate-persona/`, `select-persona-image/`, `personas` table, NanoBanana API

### Story 3.1: Character Builder UI — 9 Attributes
As an authenticated user, I want to configure a persona using visual controls for 9 attributes.

**Given** user navigates to `/personas/new` **When** builder loads **Then** 9 attribute selectors displayed: gender, skin tone, age range, hair color, hair style, eye color, body type, clothing style, accessories **And** each uses appropriate visual controls (gradient picker, option grids, etc.)

### Story 3.2: Persona Image Generation (+ Regeneration)
As a user, I want to generate 4 AI images based on my attribute selections.

**Given** user configured all 9 attributes and submits **When** `generate-persona/` called **Then** attributes converted to optimized text prompt **And** NanoBanana generates 4 photorealistic images in < 30s **And** images uploaded to `persona-images` Storage bucket **And** persona record created with `generated_images` array **And** user can modify attributes and click "Regenerate" for fresh images

> **Audit note:** Merged Story 3.4 (Persona Regeneration) — "Regenerate" is a button on the same UI, not a separate story.

### Story 3.3: Persona Image Selection
As a user, I want to select my preferred image from 4 options.

**Given** 4 persona images displayed **When** user clicks preferred **Then** `select-persona-image/` sets `selected_image_url` **And** selected image visually highlighted

### Story 3.5: Persona Slot Limits
As the platform, I want persona creation limited by tier.

**Given** user attempts to create new persona **When** `generate-persona/` checks count vs limit **Then** Free blocked at 0 (must subscribe), Starter blocked at 1, Growth blocked at 3 **And** error suggests upgrading

### Story 3.6: Persona Library Page (+ Detail View)
As a user, I want to view all my personas and their details.

**Given** user navigates to `/personas` **When** page loads **Then** persona cards with selected image, name, attributes summary **And** clicking a card shows full detail (all 4 generated images, all attributes, regenerate option)

> **Audit note:** Merged Story 3.7 (Persona Detail Page) — detail view can be a modal or expandable card, not a separate page.

---

## Epic 4: Paywall & Subscription Billing

Users subscribe to Starter/Growth via Stripe, receive credits, track balance. Paywall triggers at generation step.

**FRs:** FR31-FR35 | **NFRs:** NFR13 | **Domain:** DR1 | **Arch:** `stripe-checkout/`, `stripe-webhook/`, `stripe-portal/`, `subscriptions`, `credit_balances`, `credit_ledger` tables

> **Audit note:** FR36 (overage billing) deferred to Phase 1.5. Stories 4.1 (merged into 2.1), 4.6 (merged into 4.5), 4.7 (merged into 7.1), 4.8 (merged into 5.2) removed.

### Story 4.2: Paywall Modal at Generation
As the platform, I want to gate generation when credits exhausted.

**Given** user hits "Generate" with 0 credits and no active subscription **When** wizard checks balance via `credit-balance/` **Then** paywall modal with plan comparison **And** generation blocked until credits available

### Story 4.3: Plan Comparison Display
As a user viewing paywall, I want to compare plans.

**Given** paywall displayed **When** user reviews **Then** Starter ($29/mo, 27 segment credits = 3 batches, 1 persona, 720p) and Growth ($79/mo, 90 segment credits = 10 batches, 3 personas, 720p) shown with feature comparison

> **Audit note:** Pricing corrected from $15/$59 to $29/$79 per PRD. Credits shown as segment credits. Resolution is 720p for both tiers per PRD appendix.

### Story 4.4: Stripe Checkout Flow
As a user selecting a plan, I want to complete payment through Stripe.

**Given** user selects plan and clicks "Subscribe" **When** `stripe-checkout/` creates Checkout session **Then** redirected to Stripe hosted checkout **And** on success, returns to dashboard with active subscription

### Story 4.5: Webhook — Subscription Lifecycle
As the system, I want to process all Stripe subscription webhooks reliably.

**Given** Stripe sends webhook events **When** `stripe-webhook/` processes them **Then** handles:
- `checkout.session.completed` → create subscription, set plan, add credits (27 Starter / 90 Growth)
- `invoice.paid` → renew credits for billing period
- `customer.subscription.updated` → update plan/status
- `customer.subscription.deleted` → set plan to 'free', clear credits
**And** event logged in `audit_logs` for idempotency **And** `credit_ledger` entry for each credit change

> **Audit note:** Merged Story 4.6 (Subscription Renewal) into this story — same webhook handler processes all events.

---

## Epic 5: AI Script & POV Image Generation

System generates 3 Hook + 3 Body + 3 CTA script variants (OpenRouter) and composite POV image (NanoBanana). Content preparation before video segment generation.

**FRs:** FR18-FR20 | **NFRs:** NFR7 | **Depends on:** Epic 1, 2, 3, **4** | **Arch:** `generate-video/` steps 1-8, OpenRouter (`openai/gpt-oss-120b`), NanoBanana API

> **Audit note:** Epic 4 added as dependency — `generate-video/` checks credit balance and debits credits (Epic 4 functionality). Generation model aligned with PRD: 3 variants per segment type, 9 segments total, 9 credits per batch.

### Story 5.1: Generation Wizard — Product & Persona Selection
As a user, I want to select product and persona in a step-by-step wizard.

**Given** user navigates to `/generate` **When** wizard loads **Then** Step 1: select from confirmed products, Step 2: select from available personas, Step 3: review + "Generate" button (Easy Mode) **And** credit balance shown (need 9 credits) **And** if insufficient credits, show paywall (Story 4.2)

### Story 5.2: AI Script Generation (3 Variants per Segment)
As the system, I want to generate 9 UGC ad script variants from product data and brand tone.

**Given** `generate-video/` triggered with product_id and persona_id **When** script step executes **Then** 9 credits debited from balance **And** `credit_ledger` entry with `reason = 'generation'` **And** OpenRouter (`openai/gpt-oss-120b`) generates JSON with:
- 3 Hook variants (3-5s each, different opening angles)
- 3 Body variants (5-10s each, different selling points emphasized)
- 3 CTA variants (3-5s each, different urgency/action framing)
**And** tuned to product description and brand tone **And** status set to `'scripting'` at creation **And** scripts saved to `generations.script`

> **Audit note:** Credit deduction (from Story 4.8) merged here. 9 credits per batch, not 1. OpenRouter replaces OpenAI. Status flow clarification: script generation and composite image run **in parallel** (both happen while status = `'scripting'`). There is no separate `generating_image` status — both complete before status advances to `'submitting_jobs'`.

### Story 5.3: POV Composite Image Generation
As the system, I want to generate a composite image of persona holding/using the product.

**Given** `generate-video/` is in `'scripting'` status **When** composite image step executes in parallel with script generation **Then** NanoBanana generates POV-style composite from persona's selected image + product image **And** composite uploaded to `composite-images` Storage bucket **And** once BOTH script and composite complete, status advances to `'submitting_jobs'`

> **Implementation note:** Script generation (`callOpenRouter`) and composite image generation (`generateCompositeImage`) run concurrently via `Promise.all`. The `'scripting'` status covers both operations.

### Story 5.4: Script Generation Retry on Failure
As the system, I want to retry AI API calls on failure.

**Given** OpenRouter or NanoBanana returns error **When** Edge Function catches failure **Then** up to 3 retries with exponential backoff **And** if all fail, status set to `'failed'` with error message **And** 9 credits refunded via `credit_ledger` with `reason = 'refund'`

### Story 5.5: Generation Status Tracking (+ Progress UI)
As a user, I want real-time progress of my generation.

**Given** generation in progress **When** frontend polls `video-status/` every 5s **Then** current status returned with these transitions: `scripting → submitting_jobs → generating_segments → completed` **And** progress indicator shows segments completed / 9 total **And** stage label displayed per pipeline step

> **Audit note (2026-02-27):** Merged Story 6.8 (Generation Progress UI) — same component handles all progress states. Status flow corrected: `generating_image` removed (script + image run in parallel under `scripting`). Actual backend status flow: `pending → scripting → submitting_jobs → generating_segments → completed|failed`.

---

## Epic 6: Video Segment Generation & Delivery

System submits 9 segment jobs to Kling 3.0, polls for completion, delivers segments organized by type. Users review segments, build combinations, download individual segment MP4s.

**FRs:** FR21-FR22, FR24-FR26 | **NFRs:** NFR3-5, NFR7, NFR14-15 | **Arch:** `generate-video/` segment submission, `video-status/`, Kling 3.0 API, Supabase Storage

> **Audit note:** FR23 (FFmpeg stitching) deferred to Phase 1.5 — cannot run in Deno Edge Functions. MVP delivers individual segments with client-side sequential preview. Story 6.3 (Stitching) and 6.4 (4-Variant) removed.

### Story 6.1: Segment Job Submission (9 Jobs)
As the system, I want to submit independent Kling jobs for each segment variant.

**Given** composite image and 9 script variants ready **When** `generate-video/` submits jobs **Then** Kling `kling-v2-6` model receives 9 jobs in parallel:
- 3 Hook jobs (hook_1, hook_2, hook_3) — 3-5s duration
- 3 Body jobs (body_1, body_2, body_3) — 5-10s duration (LLM caps at 10s max; no runtime splitting needed)
- 3 CTA jobs (cta_1, cta_2, cta_3) — 3-5s duration
**And** each job uses the composite image (`image` field) + segment script text (`prompt`) + `mode: "std"` **And** job IDs stored in `generations.external_job_ids` JSONB **And** status set to `'generating_segments'` **And** generation_id returned to frontend

> **Audit note (2026-02-27):** FR22 (body segment splitting for >10s) satisfied by LLM script constraint (body bounded 5-10s), not runtime splitting. Kling API fixed: field name `image` (not `image_url`), mode `std` (not `standard`), model `kling-v2-6` explicitly set. Kling image2video endpoint does not accept `aspect_ratio` — aspect ratio inferred from input image.

### Story 6.2: Video Segment Polling
As the system, I want to poll Kling 3.0 for each segment's completion.

**Given** 9 jobs submitted to Kling **When** `video-status/` polled every 5s **Then** each job_id checked via Kling API **And** completed segments downloaded to `generated-videos` Storage bucket **And** progress count returned (`{ completed: N, total: 9 }`) **And** when all 9 complete, status set to `'completed'`

### Story 6.5: Segment Review & Combination Builder
As a user, I want to review my 9 generated segments organized by type and preview combinations.

**Given** user navigates to `/generate/[id]` for completed generation **When** page loads **Then** segments displayed in 3 columns: Hooks (3), Bodies (3), CTAs (3) **And** each segment playable independently via video player **And** user can select one hook + one body + one CTA to preview as sequential combination **And** combination previewer plays selected segments back-to-back **And** all URLs are signed (1h expiry)

> **Audit note:** Replaces Story 6.5 (Side-by-Side 4-Video Review). Now shows segments by type with combination builder per PRD FR25.

### Story 6.6: Segment Download
As a user, I want to download individual video segments as MP4.

**Given** viewing completed generation **When** click "Download" on any segment **Then** MP4 downloads via signed URL **And** all 9 segments downloadable individually

> **Audit note (2026-02-27):** Full stitched combination download deferred to Phase 1.5. Bulk zip download deferred to Phase 1.5 (requires server-side zip creation not feasible in Deno Edge Functions). MVP: individual segment download only via signed URL.

### Story 6.7: Generation Failure Handling
As a user, I want clear feedback when generation fails.

**Given** Kling returns error after 3 retries for any segment **When** `video-status/` detects failure **Then** status set to `'failed'` with error message **And** user sees error with "Retry" button **And** 9 credits refunded via `credit_ledger` with `reason = 'refund'` **And** any successfully generated segments are still accessible

---

## Epic 7: User Dashboard & Video Library

Returning users view generation history, browse video library, re-download segments.

**FRs:** FR37-FR38 | **NFRs:** NFR16 | **Depends on:** Epic 2, 6 | **Arch:** `generation-history/`, `generations` table, dashboard page

### Story 7.1: Dashboard Overview
As a returning user, I want an account overview on the dashboard.

**Given** user navigates to `/dashboard` **When** page loads **Then** credit badge showing remaining segment credits and plan name, recent generations (latest 5 with status badges), quick-action buttons for "New Generation" and "New Persona" **And** empty state with illustration and CTA if no generations yet

> **Audit note:** Credit balance display (from Story 4.7) and empty states (from Story 7.5) merged here.

### Story 7.2: Generation History List
As a user, I want to browse my full generation history.

**Given** user views history **When** `generation-history/` returns paginated results **Then** generations with product name, persona, status badge (pending=gray, in-progress=blue, completed=green, failed=red), timestamp, thumbnail **And** 20 per page, ordered by `created_at DESC` **And** in-progress links to progress view **And** failed shows error + retry

> **Audit note:** Status indicators (from Story 7.4) merged here.

### Story 7.3: Video Library — Re-download
As a user, I want to re-download past video segments.

**Given** user clicks completed generation **When** navigate to `/generate/[id]` **Then** segment review & combination builder loads (same as Story 6.5) **And** signed URLs freshly generated

---

## Additional Notes

### AI Model Configuration
- **Provider:** OpenRouter
- **Model:** `openai/gpt-oss-120b`
- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`
- **Auth:** `Authorization: Bearer ${OPENROUTER_API_KEY}`
- **Required headers:** `HTTP-Referer: https://aiugcgenerator.com`, `X-Title: AI UGC Generator`
- **JSON output:** Include explicit JSON instruction in system prompt (structured output may not be supported)
- **Env var:** `OPENROUTER_API_KEY` (replaces `OPENAI_API_KEY`)

### Shared Helpers to Create
```
supabase/functions/_shared/
├── openrouter.ts    # OpenRouter API wrapper (model, headers, timeout, retry)
└── kling.ts         # Kling 3.0 API wrapper (submitJob, checkStatus), centralized endpoints
```

### Schema Updates from Audit
- `handle_new_user()` trigger: `remaining = 9` (not 1)
- `generations.status` CHECK: `pending, scripting, generating_image, submitting_jobs, generating_segments, completed, failed`
- `generations.segments` JSONB: `{ hooks: [{url, duration, variation}], bodies: [...], ctas: [...] }`
- `generations.external_job_ids` JSONB: `{ hook_1: "id", hook_2: "id", ..., cta_3: "id" }`

### Items Deferred to Phase 1.5+
- Server-side FFmpeg video stitching (FR23) — needs worker service
- Overage billing (FR36) — Stripe metered billing
- Watermark on free tier (DR3) — needs video processing
- Account deletion (Story 2.6 / GDPR) — manual via support
- Email notifications (NFR8)
- NPS survey (SC7)
- Expert Mode (FR27-30)
- Redis-based rate limiting
