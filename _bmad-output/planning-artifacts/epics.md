---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories']
inputDocuments:
  - '_bmad-output/planning-artifacts/ai-ugc-generator-prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
---

# AIUGC - Epic Breakdown

## Overview

Complete epic and story breakdown for AIUGC. Decomposed from PRD v2.0 (BMAD Standard) and Architecture v1.0 (Supabase-native). Scope: **MVP (Phase 1)**.

**Architecture Stack:** Next.js 14 + Tailwind/shadcn on Vercel | Supabase (Auth + Edge Functions + PostgreSQL + Storage) | OpenAI GPT-4o | NanoBanana | Kling 3.0 | Stripe

## Epic List

| Epic | Name | Priority | Depends On | Stories |
|------|------|----------|------------|---------|
| 1 | Product Discovery — Landing, Scraping & Import | P0 | None | 8 |
| 2 | User Authentication & Account Management | P0 | None | 6 |
| 3 | AI Persona Creation | P0 | Epic 2 | 7 |
| 4 | Paywall & Subscription Billing | P0 | Epic 2 | 8 |
| 5 | AI Script & POV Image Generation | P0 | Epic 1, 2, 3 | 5 |
| 6 | Video Generation, Assembly & Delivery | P0 | Epic 4, 5 | 8 |
| 7 | User Dashboard & Video Library | P1 | Epic 2, 6 | 5 |

**Parallelization:** Epics 1+2 simultaneously. Epics 3+4 parallel after Epic 2. Epic 5 needs 1+2+3. Epic 6 needs 4+5. Epic 7 after Epic 6 has test data.

**Total: 7 epics, 47 stories**

---

## FR Coverage Map

FR1-FR6 → Epic 1 (`scrape-product/`, `confirm-products/`, `upload-product/` Edge Functions)
FR7-FR10 → Epic 2 (Supabase Auth, `profiles` table)
FR11-FR17 → Epic 3 (`generate-persona/`, `select-persona-image/` Edge Functions, `personas` table)
FR18-FR20 → Epic 5 (`generate-video/` Edge Function steps 1-8, OpenAI + NanoBanana)
FR21-FR26 → Epic 6 (`generate-video/` steps 9-10, `video-status/`, Kling 3.0, Supabase Storage)
FR31-FR36 → Epic 4 (`stripe-checkout/`, `stripe-webhook/`, `credit-balance/` Edge Functions)
FR37-FR38 → Epic 7 (`generation-history/` Edge Function, dashboard page)

---

## Epic 1: Product Discovery — Landing Page, Scraping & Import

Users land on the platform, paste their store URL, see products auto-imported with AI brand summary — or manually upload. Landing page = marketing site + product funnel entry.

**FRs:** FR1-FR6 | **NFRs:** NFR1, NFR11 | **Domain:** DR2 | **Arch:** `scrape-product/`, `confirm-products/`, `upload-product/`, `products` table

### Story 1.1: Landing Page with URL Input CTA
As a visitor, I want to see a compelling landing page with a prominent URL input field, so that I can immediately start using the product without signing up.

**Given** a visitor loads the homepage **When** the page renders **Then** hero section displays with tagline, URL input field, and "Get Started" button **And** pricing teaser, feature breakdown, and FAQ sections are visible below the fold

### Story 1.2: Shopify Store Scraping
As a store owner, I want to paste my Shopify store URL and have products automatically imported, so that I don't have to manually enter product information.

**Given** a user submits a Shopify store URL **When** `scrape-product/` Edge Function processes the request **Then** products are extracted (name, images, description, price, category) within 15 seconds **And** SSRF validation blocks private IPs before fetching **And** rate limiting enforces max 10 requests/hour for unauthenticated users

### Story 1.3: Generic HTML Scraping Fallback
As a store owner on a non-Shopify platform, I want the system to attempt scraping my store, so that I can still auto-import products.

**Given** a user submits a non-Shopify store URL **When** Shopify JSON endpoint detection fails **Then** system falls back to generic HTML parsing **And** extracted data returns in the same format as Shopify scraping

### Story 1.4: AI Brand Summary Generation
As a store owner, I want an AI-generated brand summary from my scraped products, so that generated video scripts match my brand's tone and audience.

**Given** products are successfully scraped **When** the scraping Edge Function completes extraction **Then** OpenAI generates brand summary (tone, demographic, selling points) **And** stored in `brand_summary` JSONB field on each product

### Story 1.5: Product Review and Confirmation
As a store owner, I want to review, edit, and confirm my imported product data, so that I can correct scraping errors.

**Given** an authenticated user views scraped products **When** they edit product fields inline **Then** edits saved via `confirm-products/` **And** confirmed products have `confirmed = true` **And** unconfirmed data purged after 24 hours (DR2)

### Story 1.6: Manual Product Upload
As a store owner without a website, I want to manually upload product images and details.

**Given** an authenticated user navigates to product upload **When** they submit name, description, price, and images **Then** images uploaded to `product-images` Supabase Storage bucket **And** product record created with `source = 'manual'` and `confirmed = true`

### Story 1.7: Product Library Page
As an authenticated user, I want to view all my products in one place.

**Given** user navigates to `/products` **When** page loads **Then** confirmed products display in card grid with images, names, prices **And** RLS ensures only user's own products visible

### Story 1.8: Scraping Error Handling
As a store owner, I want clear feedback when scraping fails.

**Given** a user submits a URL that cannot be scraped **When** the Edge Function fails **Then** error message with reason and CTA to use manual upload **And** no partial or corrupt data stored

---

## Epic 2: User Authentication & Account Management

Users create accounts via email or Google OAuth, log in, manage settings. Auth gate after scraping maximizes conversion.

**FRs:** FR7-FR10 | **NFRs:** NFR9, NFR10, NFR12 | **Domain:** DR4 | **Arch:** Supabase Auth, `profiles` table, DB trigger on `auth.users`

### Story 2.1: Email + Password Registration
As a new user, I want to create an account with email and password.

**Given** user navigates to `/signup` **When** they submit email and password **Then** Supabase Auth creates account **And** DB trigger creates `profiles` row + `credit_balances` with 1 free trial credit **And** redirected to dashboard

### Story 2.2: Google OAuth Authentication
As a user, I want to sign in with Google.

**Given** user clicks "Sign in with Google" **When** OAuth flow completes **Then** Supabase Auth creates/matches account **And** callback at `/auth/callback` handles redirect **And** profile auto-created if new user

### Story 2.3: Soft Auth Gate After Scraping
As a visitor who just scraped products, I want to be prompted to sign up after seeing results.

**Given** unauthenticated user completed a scrape **When** they attempt to proceed **Then** auth gate appears prompting signup/login **And** scraped data persists through auth flow

### Story 2.4: Account Settings Page
As an authenticated user, I want to view and update my account settings.

**Given** user navigates to `/settings` **When** page loads **Then** shows email, name, avatar, current plan **And** user can update display name

### Story 2.5: Billing Management Portal
As a subscribed user, I want to manage my subscription and billing.

**Given** user navigates to `/settings/billing` **When** they click "Manage Billing" **Then** `stripe-portal/` creates Stripe billing portal session **And** user redirected to Stripe's hosted portal

### Story 2.6: Account Deletion (GDPR)
As a user, I want to delete my account and all data.

**Given** user requests account deletion **When** confirmed via `delete-account/` **Then** all data deleted (products, personas, generations, credits, storage) **And** Stripe subscription canceled **And** Supabase auth user deleted

---

## Epic 3: AI Persona Creation

Users build a custom AI spokesperson via visual character builder, generate 4 image options, select preferred, persist for future generations.

**FRs:** FR11-FR17 | **NFRs:** NFR2 | **Depends on:** Epic 2 | **Arch:** `generate-persona/`, `select-persona-image/`, `personas` table, NanoBanana API

### Story 3.1: Character Builder UI — 9 Attributes
As an authenticated user, I want to configure a persona using visual controls for 9 attributes.

**Given** user navigates to `/personas/new` **When** builder loads **Then** 9 attribute selectors displayed: gender, skin tone, age range, hair color, hair style, eye color, body type, clothing style, accessories **And** each uses appropriate visual controls (gradient picker, option grids, etc.)

### Story 3.2: Persona Image Generation
As a user, I want to generate 4 AI images based on my attribute selections.

**Given** user configured all 9 attributes and submits **When** `generate-persona/` called **Then** attributes converted to optimized text prompt **And** NanoBanana generates 4 photorealistic images in < 30s **And** images uploaded to `persona-images` Storage bucket **And** persona record created with `generated_images` array

### Story 3.3: Persona Image Selection
As a user, I want to select my preferred image from 4 options.

**Given** 4 persona images displayed **When** user clicks preferred **Then** `select-persona-image/` sets `selected_image_url` **And** selected image visually highlighted

### Story 3.4: Persona Regeneration
As a user unsatisfied with images, I want to adjust attributes and regenerate.

**Given** user viewing generated images **When** they modify attributes and click "Regenerate" **Then** new NanoBanana call generates 4 fresh images **And** previous images replaced

### Story 3.5: Persona Slot Limits
As the platform, I want persona creation limited by tier.

**Given** user attempts to create new persona **When** `generate-persona/` checks count vs limit **Then** Starter blocked at 1, Growth blocked at 3 **And** error suggests upgrading

### Story 3.6: Persona Library Page
As a user, I want to view all my personas.

**Given** user navigates to `/personas` **When** page loads **Then** persona cards with selected image, name, attributes summary

### Story 3.7: Persona Detail Page
As a user, I want to view a specific persona's details.

**Given** user navigates to `/personas/[id]` **When** page loads **Then** full attributes, selected image, all 4 generated images **And** can regenerate from this page

---

## Epic 4: Paywall & Subscription Billing

Users subscribe to Starter/Growth via Stripe, receive free trial, track credits, handle overage.

**FRs:** FR31-FR36 | **NFRs:** NFR13 | **Domain:** DR1 | **Arch:** `stripe-checkout/`, `stripe-webhook/`, `stripe-portal/`, `credit-balance/`, `subscriptions`, `credit_balances`, `credit_ledger` tables

### Story 4.1: Free Trial Credit on Signup
As a new user, I want 1 free generation credit on signup.

**Given** new user completes registration **When** `handle_new_user()` DB trigger fires **Then** `credit_balances` created with `remaining = 1` **And** `credit_ledger` entry with `reason = 'free_trial'`

### Story 4.2: Paywall Modal at Generation
As the platform, I want to gate generation when credits exhausted.

**Given** user hits "Generate" with 0 credits and no subscription **When** wizard checks balance **Then** paywall modal with plan comparison **And** generation blocked until subscription active

### Story 4.3: Plan Comparison Display
As a user viewing paywall, I want to compare plans.

**Given** paywall displayed **When** user reviews **Then** Starter ($15/mo, 10 credits, 1 persona, 720p) and Growth ($59/mo, 50 credits, 3 personas, 1080p) shown with feature comparison

### Story 4.4: Stripe Checkout Flow
As a user selecting a plan, I want to complete payment through Stripe.

**Given** user selects plan and clicks "Subscribe" **When** `stripe-checkout/` creates Checkout session **Then** redirected to Stripe hosted checkout **And** on success, returns to dashboard with active subscription

### Story 4.5: Webhook — Subscription Activation
As the system, I want to process Stripe webhooks reliably.

**Given** Stripe sends `checkout.session.completed` **When** `stripe-webhook/` processes **Then** `subscriptions` created/updated **And** `profiles.plan` updated **And** credits added (10 Starter, 50 Growth) **And** `credit_ledger` entry with `reason = 'subscription_renewal'` **And** event logged in `audit_logs` for idempotency

### Story 4.6: Webhook — Subscription Renewal
As a subscribed user, I want credits refreshed each billing cycle.

**Given** Stripe sends `invoice.paid` **When** webhook processes **Then** `credit_balances.remaining` reset to tier allocation **And** `credit_ledger` records renewal

### Story 4.7: Credit Balance Display
As a user, I want to see my remaining credits.

**Given** user views dashboard or sidebar **When** `credit-balance/` called **Then** remaining credits and plan displayed in credit badge

### Story 4.8: Credit Deduction on Generation
As the system, I want to debit 1 credit per generation.

**Given** user initiates generation with credits **When** `generate-video/` starts **Then** 1 credit debited via `decrement_credits` function **And** `credit_ledger` records debit **And** if balance = 0, blocked with paywall

---

## Epic 5: AI Script & POV Image Generation

System generates Hook/Body/CTA script (OpenAI) and composite POV image (NanoBanana). Content preparation before video.

**FRs:** FR18-FR20 | **NFRs:** NFR7 | **Depends on:** Epic 1, 2, 3 | **Arch:** `generate-video/` steps 1-8, OpenAI API, NanoBanana API

### Story 5.1: Generation Wizard — Product & Persona Selection
As a user, I want to select product and persona in a step-by-step wizard.

**Given** user navigates to `/generate` **When** wizard loads **Then** Step 1: confirmed products, Step 2: available personas, Step 3: "Generate" button (Easy Mode)

### Story 5.2: AI Script Generation (Hook/Body/CTA)
As the system, I want to generate a UGC ad script from product data and brand tone.

**Given** `generate-video/` triggered with product_id and persona_id **When** script step executes **Then** OpenAI GPT-4o generates JSON script with hook (3-10s), body (10-20s), CTA (3-5s) **And** tuned to product description and brand tone **And** status updates to `'scripting'` then `'generating_image'` **And** script saved to `generations.script`

### Story 5.3: POV Composite Image Generation
As the system, I want to generate a composite image of persona holding/using the product.

**Given** script generation complete **When** step 6 of `generate-video/` executes **Then** NanoBanana generates POV-style composite **And** uploaded to `composite-images` Storage bucket **And** status updates to `'generating_video'`

### Story 5.4: Script Generation Retry on Failure
As the system, I want to retry AI API calls on failure.

**Given** OpenAI or NanoBanana returns error **When** Edge Function catches failure **Then** up to 3 retries with exponential backoff **And** if all fail, status set to `'failed'` with error message

### Story 5.5: Generation Status Tracking
As a user, I want real-time progress of my generation.

**Given** generation in progress **When** frontend polls `video-status/` every 5s **Then** current status returned (scripting → generating_image → generating_video → completed) **And** progress indicator shows completed vs total steps

---

## Epic 6: Video Generation, Assembly & Delivery

System generates video segments via Kling 3.0, stitches them, delivers 4 variations. Users review side-by-side and download MP4.

**FRs:** FR21-FR26 | **NFRs:** NFR3-5, NFR7, NFR14-15 | **Arch:** `generate-video/` steps 9-10, `video-status/`, Kling 3.0 API, Supabase Storage

### Story 6.1: Segmented Video Job Submission
As the system, I want to submit independent jobs per segment to maintain lip-sync quality.

**Given** composite image and script ready **When** step 9 of `generate-video/` executes **Then** Kling 3.0 receives jobs for Hook, Body, CTA x 4 variations **And** body > 10s split into 2 sub-segments **And** job IDs stored in `generations.external_job_ids` **And** generation_id returned to frontend

### Story 6.2: Video Generation Polling
As the system, I want to poll Kling 3.0 for completion.

**Given** jobs submitted to Kling **When** `video-status/` polled every 5s **Then** each job_id checked **And** completed segments downloaded to `generated-videos` Storage **And** progress count returned

### Story 6.3: Video Stitching
As the system, I want to stitch segments into complete video.

**Given** all segments for a variation completed **When** stitching runs **Then** segments concatenated with smooth transitions **And** final video uploaded to Storage **And** `generations.videos` array updated

### Story 6.4: 4-Variant Output with Prompt Diversity
As the system, I want 4 unique variations per generation.

**Given** single generation request **When** jobs submitted **Then** each variation uses different prompt parameters **And** all 4 complete independently **And** marked `'completed'` only when all 4 done

### Story 6.5: Side-by-Side Video Review
As a user, I want to review 4 videos side-by-side.

**Given** user navigates to `/generate/[id]` for completed generation **When** page loads **Then** 4 video players in 2x2 grid, each playable independently **And** URLs are signed (1h expiry)

### Story 6.6: Video Download
As a user, I want to download videos as MP4.

**Given** viewing completed generation **When** click "Download" **Then** MP4 downloads via signed URL **And** all 4 downloadable individually

### Story 6.7: Generation Failure Handling
As a user, I want clear feedback when generation fails.

**Given** Kling returns error after 3 retries **When** `video-status/` detects failure **Then** status set to `'failed'` with error message **And** user sees error with "Retry" button **And** credit refunded via `credit_ledger` with `reason = 'refund'`

### Story 6.8: Generation Progress UI
As a user, I want detailed progress indicator.

**Given** generation in progress **When** progress component polls `video-status/` **Then** progress bar shows segments completed/total **And** stage label (scripting → image → video → stitching) **And** estimated time remaining

---

## Epic 7: User Dashboard & Video Library

Returning users view generation history, browse video library, re-download.

**FRs:** FR37-FR38 | **NFRs:** NFR16 | **Depends on:** Epic 2, 6 | **Arch:** `generation-history/`, `generations` table, dashboard page

### Story 7.1: Dashboard Overview
As a returning user, I want an account overview on the dashboard.

**Given** user navigates to `/dashboard` **When** page loads **Then** credit badge, recent generations (latest 5), quick-action buttons for "New Generation" and "New Persona"

### Story 7.2: Generation History List
As a user, I want to browse my full generation history.

**Given** user views history **When** `generation-history/` returns paginated results **Then** generations with product name, persona, status, timestamp, thumbnail **And** 20 per page, ordered by `created_at DESC`

### Story 7.3: Video Library — Re-download
As a user, I want to re-download past videos.

**Given** user clicks completed generation **When** navigate to `/generate/[id]` **Then** all 4 videos with download buttons **And** signed URLs freshly generated

### Story 7.4: Generation Status Indicators
As a user, I want to see status of all generations.

**Given** user views history **When** different statuses listed **Then** badges: pending (gray), in progress (blue), completed (green), failed (red) **And** in-progress links to progress view **And** failed shows error + retry

### Story 7.5: Empty States
As a new user with no generations, I want helpful empty states.

**Given** user has no products/personas/generations **When** visiting dashboard, products, personas, or history **Then** empty state with illustration and CTA linking to relevant creation flow
