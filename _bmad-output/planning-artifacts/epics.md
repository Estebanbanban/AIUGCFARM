---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-audit', 'step-05-implementation-audit']
inputDocuments:
  - '_bmad-output/planning-artifacts/ai-ugc-generator-prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/codebase-audit-2026-02.md'
auditDate: '2026-02-28'
auditReport: '_bmad-output/planning-artifacts/codebase-audit-2026-02.md'
---

# AIUGC - Epic Breakdown (Implementation-Audited)

## Overview

Complete epic and story breakdown for AIUGC. Originally decomposed from PRD v2.0 (BMAD Standard) and Architecture v1.0. Updated 2026-02-28 to reflect actual implementation state based on codebase audit.

**Audited:** 2026-02-28. All stories validated against the codebase. See `codebase-audit-2026-02.md` for the full delta report.

**Architecture Stack:** Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui on Vercel | Supabase (Auth + Edge Functions + PostgreSQL + Storage) | OpenRouter | NanoBanana/Gemini | Kling v2.6/v3 | Stripe

**Generation Model:** Single mode (1 variant per segment type = 3 segments) or Triple mode (3 variants per segment type = 9 segments). Two-phase flow: script generation (no charge) then user approval (credits debited).

**Credit Model:** 1 credit = $1. Single: 5cr (standard) / 10cr (HD). Triple: 15cr (standard) / 30cr (HD). First video 50% off.

**Pricing:** Starter $25/mo (30cr), Growth $80/mo (100cr), Scale $180/mo (250cr). Credit Packs: 10cr/$12, 30cr/$33, 100cr/$95.

## Epic List

| Epic | Name | Priority | Depends On | Stories | Status |
|------|------|----------|------------|---------|--------|
| 1 | Product Discovery - Landing, Scraping & Import | P0 | None | 6 | ✅ Complete |
| 2 | User Authentication & Account Management | P0 | None | 6 | ✅ Complete |
| 3 | AI Persona Creation | P0 | Epic 2 | 5 | ✅ Complete |
| 4 | Paywall & Subscription Billing | P0 | Epic 2 | 7 | ✅ Complete |
| 5 | AI Script & POV Image Generation | P0 | Epic 1, 2, 3, 4 | 6 | ✅ Complete |
| 6 | Video Segment Generation & Delivery | P0 | Epic 5 | 10 | ✅ Complete |
| 7 | User Dashboard & Video Library | P1 | Epic 2, 6 | 3 | ✅ Complete |
| 8 | Admin Panel & Operations | P1 | Epic 2 | 4 | ✅ Complete |

**Total: 8 epics, 47 stories**

**Dependency Graph:**
```
Epic 1 (Products) ────────────────────┐
                                      ├─→ Epic 5 (Script & Image) ─→ Epic 6 (Video) ─→ Epic 7 (Dashboard)
Epic 2 (Auth) ──→ Epic 3 (Personas) ──┤
              └──→ Epic 4 (Billing) ──┘
              └──→ Epic 8 (Admin)
```

---

## FR Coverage Map

FR1-FR6 → Epic 1 (`scrape-product/`, `confirm-products/`, `upload-product/` Edge Functions)
FR7-FR10 → Epic 2 (Supabase Auth, `profiles` table, `delete-account/`, `send-email/`)
FR11-FR17 → Epic 3 (`generate-persona/`, `select-persona-image/`, `persona-images/` Edge Functions, `personas` table)
FR18-FR20 → Epic 5 (`generate-video/` Edge Function, `generate-composite-images/`, OpenRouter + NanoBanana)
FR21-FR26 → Epic 6 (`generate-video/` segment submission, `video-status/`, `regenerate-segment/`, Kling v2.6/v3)
FR27-FR30 → Epic 6 (Advanced Mode: `generate-segment-script/`, `generate-segment-composite/`, `edit-composite-image/`)
FR31-FR35 → Epic 4 (`stripe-checkout/`, `stripe-webhook/` Edge Functions, credit packs, first-video discount)
FR37-FR38 → Epic 7 (`generation-history/` Edge Function, dashboard page, history page)

**Deferred FRs:**
- FR23 (FFmpeg stitching) → Deferred (cannot run in Edge Functions; individual segments only)
- FR36 (overage billing) → Deferred (credit packs replace this model)

---

## Epic 1: Product Discovery - Landing Page, Scraping & Import

Users land on the platform, paste their store URL, see products auto-imported with AI brand summary - or manually upload.

**FRs:** FR1-FR6 | **NFRs:** NFR1, NFR11 | **Arch:** `scrape-product/`, `confirm-products/`, `upload-product/`, `products` table

### [DONE] Story 1.1: Landing Page with URL Input CTA
As a visitor, I want to see a compelling landing page with a prominent URL input field, so that I can immediately start using the product without signing up.

### [DONE] Story 1.2: Shopify Store Scraping (+ Generic Fallback)
As a store owner, I want to paste my Shopify store URL and have products automatically imported. Includes Shopify API, JSON-LD, and Open Graph tag fallback chain. SSRF validation on resolved IPs.

### [DONE] Story 1.4: AI Brand Summary Generation
As a store owner, I want an AI-generated brand summary from my scraped products. Uses OpenRouter to generate tone, demographic, and selling_points.

### [DONE] Story 1.5: Product Review and Confirmation
As a store owner, I want to review, edit, and confirm my imported product data via `confirm-products/`.

### [DONE] Story 1.6: Manual Product Upload
As a store owner without a website, I want to manually upload product images and details via `upload-product/` with multipart/form-data.

### [DONE] Story 1.7: Product Library Page
As an authenticated user, I want to view all my products at `/products` in a card grid with signed image URLs.

---

## Epic 2: User Authentication & Account Management

Users create accounts via email or Google OAuth, manage settings, billing portal, and account deletion.

**FRs:** FR7-FR10 | **NFRs:** NFR9, NFR10, NFR12 | **Arch:** Supabase Auth, `profiles` table, `send-email/`, `delete-account/`

### [DONE] Story 2.1: Email + Password Registration
As a new user, I want to create an account with email and password. DB trigger creates `profiles` row + `credit_balances` with 0 credits (no free trial; first video discount replaces free credits).

### [DONE] Story 2.2: Google OAuth Authentication
As a user, I want to sign in with Google via Supabase Auth with callback at `/auth/callback`.

### [DONE] Story 2.3: Soft Auth Gate After Scraping
As a visitor who just scraped products, I want to be prompted to sign up after seeing results. Scraping works unauthenticated (with stricter rate limits); save/confirm requires auth.

### [DONE] Story 2.4: Account Settings Page
As an authenticated user, I want to view and update my account settings at `/settings`.

### [DONE] Story 2.5: Billing Management Portal
As a subscribed user, I want to manage my subscription via `stripe-portal/` → Stripe hosted billing portal at `/settings/billing`.

### [DONE] Story 2.6: Account Deletion
As a user, I want to permanently delete my account. `delete-account/` Edge Function cancels Stripe subscription, deletes storage objects across all 4 buckets, deletes all DB records, and deletes the auth user via admin API. Requires `{ "confirm": true }`.

> **Implementation note:** Originally deferred to Phase 1.5. Fully implemented with `delete-account/` Edge Function.

### [DONE] Story 2.7: Transactional Emails (Auth Hook)
As a user, I want branded transactional emails for signup, recovery, and email change. `send-email/` Supabase Auth Hook intercepts auth emails and delivers via Resend with branded HTML templates (6-digit OTP for signup, action links for recovery/magiclink). HMAC-SHA256 signature verification.

> **Implementation note:** Originally deferred to Phase 1.5 (NFR8). Fully implemented.

---

## Epic 3: AI Persona Creation

Users build a custom AI spokesperson via visual character builder, generate image options, select preferred, persist for future generations.

**FRs:** FR11-FR17 | **NFRs:** NFR2 | **Depends on:** Epic 2 | **Arch:** `generate-persona/`, `select-persona-image/`, `persona-images/`, `personas` table, NanoBanana/Gemini API

### [DONE] Story 3.1: Character Builder UI - 8 Attributes
As an authenticated user, I want to configure a persona using visual controls for 8 attributes: gender, ethnicity/skin_tone, age range, hair color, hair style, eye color, body type, clothing style, accessories.

> **Delta from plan:** 8 core attributes (ethnicity replaces skin_tone as terminology). Was 9 in original plan.

### [DONE] Story 3.2: Persona Image Generation (+ Regeneration)
As a user, I want to generate AI images based on my attribute selections. `generate-persona/` generates **2 images** per call (was 4 in plan) via Gemini/NanoBanana. Free tier capped at 4 regenerations via `personas.regen_count`.

### [DONE] Story 3.3: Persona Image Selection
As a user, I want to select my preferred image from generated options via `select-persona-image/`.

### [DONE] Story 3.5: Persona Slot Limits
As the platform, I want persona creation limited by tier: Free=1, Starter=1, Growth=3, Scale=10.

> **Delta from plan:** Free users CAN create 1 persona (plan said Free=0, must subscribe first).

### [DONE] Story 3.6: Persona Library Page (+ Detail View)
As a user, I want to view all my personas at `/personas` and their details. `persona-images/` Edge Function provides batch signed-URL generation for persona image displays.

---

## Epic 4: Paywall & Subscription Billing

Users subscribe via Stripe, purchase credit packs, receive credits, track balance. Paywall triggers when credits insufficient (not subscription absence).

**FRs:** FR31-FR35 | **NFRs:** NFR13 | **Domain:** DR1 | **Arch:** `stripe-checkout/`, `stripe-webhook/`, `stripe-portal/`, `credit-balance/`, `subscriptions`, `credit_balances`, `credit_ledger` tables

### [DONE] Story 4.2: Paywall Modal at Generation
As the platform, I want to gate generation when credits exhausted. Paywall triggers based on credit balance vs generation cost (not subscription presence). Users with pack credits can generate without a subscription. CRO-optimized dialog with aspirational copy, value framing ($150-$500 traditional UGC comparison), "Most popular" badge on growth plan.

### [DONE] Story 4.3: Plan Comparison Display
As a user viewing the paywall, I want to compare plans. Shows Starter ($25/mo, 30cr), Growth ($80/mo, 100cr), Scale ($180/mo, 250cr) with per-video cost comparison. Subscriptions displayed first (recurring revenue), credit packs secondary. Dismissal copy: "No commitment on packs - Cancel subscriptions anytime."

### [DONE] Story 4.4: Stripe Checkout Flow
As a user selecting a plan or pack, I want to complete payment through Stripe. `stripe-checkout/` creates sessions for both subscriptions and one-time credit packs. Supports coupon allowlist (30% off for new users, 50% off starter first-video offer).

### [DONE] Story 4.5: Webhook - Subscription & Purchase Lifecycle
As the system, I want to process all Stripe webhooks reliably. `stripe-webhook/` handles:
- `checkout.session.completed` → create subscription + add credits (subscriptions) or add pack credits (one-time)
- `invoice.paid` → renew credits for billing period
- `customer.subscription.updated` → update plan/status
- `customer.subscription.deleted` → set plan to 'free'

### [DONE] Story 4.6: Credit Packs Purchase Flow
As a user who doesn't want a subscription, I want to buy one-time credit packs. Three packs available: Starter Pack (10cr/$12), Creator Pack (30cr/$33), Pro Pack (100cr/$95). Packs priced higher per credit than subscriptions to incentivize recurring revenue. `stripe-checkout/` creates one-time Stripe sessions. Credits added via `stripe-webhook/` on `checkout.session.completed`.

> **Not in original plan.** New monetization channel added during implementation.

### [DONE] Story 4.7: First-Video Discount
As a new user, I want 50% off my first video generation. `profiles.first_video_discount_used` boolean column tracks eligibility. Cost calculated as `ceil(cost/2)` for first generation. Discount restored if first video fails (credits refunded + flag reset). Replaces the original free trial credits model (9 free credits removed).

> **Not in original plan.** Replaces FR34 (9 free segment credits).

### [DONE] Story 4.8: Post-Purchase Success Modal
As a user returning from Stripe checkout, I want confirmation that my purchase succeeded. `PurchaseSuccessModal.tsx` triggers on `/dashboard?checkout=success&plan=X` or `&pack=X`. Shows plan-specific benefits, emotional copy, confetti animation via `canvas-confetti`, CTA to generate first video. URL cleaned after detection via `router.replace()`.

> **Not in original plan.** CRO improvement.

---

## Epic 5: AI Script & POV Image Generation

System generates script variants via OpenRouter (with coherence review pass) and composite POV images via NanoBanana/Gemini. Two-phase flow: script generation first (no credit charge), then user reviews and approves before video generation.

**FRs:** FR18-FR20 | **NFRs:** NFR7 | **Depends on:** Epic 1, 2, 3, 4 | **Arch:** `generate-video/` (phase="script"), `generate-composite-images/`, `generate-segment-composite/`, OpenRouter, NanoBanana/Gemini

See `stories/epic-5-stories.md` for detailed story specifications.

### [DONE] Story 5.1: Generation Wizard - Product & Persona Selection
As a user, I want to select product and persona in a step-by-step wizard at `/generate`. 5-step wizard: (1) Product Selection, (2) Persona Selection, (3) Preview/Composite Image, (4) Configure, (5) Review Script. Zustand store with localStorage persistence (`generation-wizard.ts`).

### [DONE] Story 5.2: AI Script Generation (with Coherence Review)
As the system, I want to generate script variants via OpenRouter. Two-pass: initial generation + coherence review pass that scores non-repetition/flow/claim-realism/cta-fit and rewrites if score < 70. Stores both `script_raw` (pre-review) and `script` (final) on the generation record. Single mode: 1 variant per type. Triple mode: 3 variants per type.

### [DONE] Story 5.3: POV Composite Image Generation (Separate Function)
As the system, I want to generate composite images of persona with product. Extracted into separate Edge Functions:
- `generate-composite-images/`: Generates 4 composites for selection in wizard step 3. Uses Gemini via NanoBanana with staggered requests.
- `generate-segment-composite/`: Generates 1 composite for per-segment Advanced Mode. Supports `custom_scene_prompt`.

### [DONE] Story 5.4: Script Generation Retry & Error Recovery
As the system, I want to retry AI API calls on failure. Uses `_shared/retry.ts` with exponential backoff. On final failure, status set to `failed`. No credits charged during script phase (credits only debited on approval).

### [DONE] Story 5.5: Generation Status Tracking (+ Progress UI)
As a user, I want real-time progress of my generation at `/generate/[id]`. Frontend polls `video-status/` every 5s. Status flow: `awaiting_approval -> locking -> submitting_jobs -> generating_segments -> completed|failed`.

### [DONE] Story 5.6: Script Review & Approval Step
As a user, I want to review and edit the AI-generated script before credits are charged.

**Given** script generation completes (phase="script") **When** wizard advances to step 5 **Then** user sees all generated scripts organized by type (hooks, bodies, CTAs) with editable text fields **And** variant labels (hook angle, body structure, CTA pattern) displayed **And** credits to be charged shown **And** user can edit any segment text inline **And** "Approve & Generate" button fires approval to `generate-video/` with `generation_id` + optional `override_script` **And** on approval, status transitions: `awaiting_approval` -> `locking` (atomic, prevents double-approval) -> `submitting_jobs` (credits debited) -> `generating_segments` **And** if insufficient credits at approval time, status reverts to `awaiting_approval` with 402 error **And** `resumeFromGeneration` action in wizard store allows resuming a draft from the dashboard (hydrates wizard to step 5)

> **Not in original plan.** The legacy single-call generation path was removed. All generations now follow the two-phase review flow. Credits are only charged after explicit user approval.

---

## Epic 6: Video Segment Generation & Delivery

System submits segment jobs to Kling v2.6 (standard) or v3 (HD), polls for completion, delivers segments. Users review segments, download MP4s. Advanced Mode provides per-segment control. Per-segment regeneration available after completion.

**FRs:** FR21-FR22, FR24-FR26, FR27-FR30 | **NFRs:** NFR3-5, NFR7, NFR14-15 | **Arch:** `generate-video/` approval path, `video-status/`, `regenerate-segment/`, `generate-segment-script/`, `generate-segment-composite/`, `edit-composite-image/`, Kling API, Supabase Storage

See `stories/epic-6-advanced-stories.md` for stories 6.8-6.10.

### [DONE] Story 6.1: Segment Job Submission
As the system, I want to submit Kling jobs for each segment on approval. Single mode: 3 jobs (1 hook + 1 body + 1 CTA). Triple mode: 9 jobs (3 of each). Kling model selected by quality tier: `kling-v2-6` (standard) or `kling-v3` (HD). Duration clamped to 5 or 10 seconds. Each job uses composite image + script text prompt. Job IDs stored in `generations.external_job_ids` JSONB.

### [DONE] Story 6.2: Video Segment Polling
As the system, I want to poll Kling for each segment's completion via `video-status/`. Completed segments downloaded to `generated-videos` Storage bucket. Progress count returned. When all segments complete, status set to `completed`.

### [DONE] Story 6.5: Segment Review Page
As a user, I want to review my generated segments at `/generate/[id]`. Segments displayed by type (Hooks, Bodies, CTAs). Each segment playable independently via video player. All URLs are signed.

> **Note:** Full combination builder UI (select one hook + one body + one CTA for back-to-back preview) is partially implemented. Preview player exists.

### [DONE] Story 6.6: Segment Download
As a user, I want to download individual video segments as MP4 via signed URL.

### [DONE] Story 6.7: Generation Failure Handling
As a user, I want clear feedback when generation fails. Credits refunded on failure. First-video discount restored if applicable. Retry available.

### [DONE] Story 6.8: Advanced Mode - Per-Segment Control
As a user, I want fine-grained control over each video segment in Advanced Mode.

**Toggle:** `AdvancedModePanel` in generate wizard, controlled by `advancedMode` boolean in wizard store.
**Per-segment configuration:**
- Script text editing with inline emotion tags `[e:emotion:intensity]`
- Global emotion selector per segment: happy, excited, surprised, serious, neutral
- Intensity control (1-3 scale: subtle, noticeable, intense)
- Action description per segment (e.g., "talking to camera", "demonstrating product")
- Custom composite image per segment via `generate-segment-composite/`

**Format selection:** 9:16 (vertical) or 16:9 (horizontal) in wizard step 3
**Quality tier:** Standard (kling-v2-6, 5cr single / 15cr triple) or HD (kling-v3, 10cr single / 30cr triple)

Emotion tags are parsed and converted to Kling prompt directives (e.g., "warm smile, relaxed energy"). `advancedSegments` excluded from localStorage persistence (session-specific).

> **Not in original plan (FR27-FR30 were Phase 2).** Fully implemented as Advanced Mode panel + backend support.

### [DONE] Story 6.9: Per-Segment Regeneration
As a user, I want to regenerate individual segments after generation completes. `regenerate-segment/` Edge Function accepts `generation_id`, `segment_type` (hook/body/cta), `variation` (1-based index). Costs 1 credit per regeneration. Resubmits to Kling with the same composite image and script text. Removes the target segment from `videos` JSONB so `video-status/` repolls only that key. Failed regeneration refunds the 1 credit. Only works on `completed` generations.

> **Not in original plan.** New feature for iterative quality improvement.

### [DONE] Story 6.10: Composite Image Editing
As a user, I want to edit the composite POV image via natural language prompt. `edit-composite-image/` Edge Function takes `composite_image_path` and `edit_prompt` (max 500 chars). Uses NanoBanana `editCompositeFromReference` to modify the image. Uploads edited image as new file. Returns new storage path + signed URL. Supports both 9:16 and 16:9 formats. User-owned path validation (SSRF protection).

> **Not in original plan.** Enables iterative composite refinement without full regeneration.

### [DONE] Story 6.11: CTA Style Configuration
As a user, I want to choose a CTA style for my generation. 8 options in wizard step 4: auto, product_name_drop, link_in_bio, link_in_comments, comment_keyword, check_description, direct_website, discount_code. Feeds into script generation prompt. `comment_keyword` option allows specifying a custom keyword. Per-segment script regeneration via `generate-segment-script/` also respects CTA style.

> **Not in original plan.** Gives creators control over CTA strategy.

### [DONE] Story 6.12: Per-Segment Script Regeneration
As a user in Advanced Mode, I want to regenerate individual segment scripts. `generate-segment-script/` Edge Function generates a single segment script (hook/body/cta) using product context and CTA style. Used by Advanced Mode to replace individual segment scripts without running the full pipeline. Supports variant diversity via `variant_index`.

> **Not in original plan.** Standalone Edge Function for granular script control.

---

## Epic 7: User Dashboard & Video Library

Returning users view generation history, browse video library, re-download segments. Post-purchase success experience.

**FRs:** FR37-FR38 | **NFRs:** NFR16 | **Depends on:** Epic 2, 6 | **Arch:** `generation-history/`, `credit-balance/`, `generations` table, dashboard page

### [DONE] Story 7.1: Dashboard Overview
As a returning user, I want an account overview at `/dashboard`. Credit balance via `credit-balance/` (returns remaining credits, plan name, admin unlimited flag). Recent generations (latest with status badges). Quick-action buttons for "New Generation" and "New Persona". Draft resume: clicking an `awaiting_approval` generation hydrates the wizard to step 5 via `resumeFromGeneration`.

### [DONE] Story 7.2: Generation History List
As a user, I want to browse my full generation history at `/history`. `generation-history/` returns paginated results with product/persona joins. Status badges, timestamps, thumbnails. Ordered by `created_at DESC`.

### [DONE] Story 7.3: Video Library - Re-download
As a user, I want to re-download past video segments. Clicking a completed generation navigates to `/generate/[id]` with freshly generated signed URLs.

---

## Epic 8: Admin Panel & Operations

Admin users manage the platform: view user analytics, manage users, adjust credits.

**Depends on:** Epic 2 | **Arch:** Admin components, `profiles.role` column, service role key for admin operations

> **Not in original plan.** Entirely new epic added during implementation.

### [DONE] Story 8.1: Admin Dashboard & Analytics
As an admin, I want to view platform analytics. Components: `StatCard.tsx`, `OverviewChart.tsx`, `RevenueChart.tsx`, `FunnelChart.tsx`, `UsageCharts.tsx`. `AdminShell.tsx` layout wrapper.

### [DONE] Story 8.2: User Management
As an admin, I want to view and manage all users. `UsersTable.tsx` with full user listing. `UserActionsModal.tsx` for ban/unban and credit adjustments.

### [DONE] Story 8.3: Admin Credit System
As an admin, I want unlimited credits for testing. `ADMIN_UNLIMITED_CREDITS = 2_147_483_647`. `credit-balance/` returns `is_unlimited: true` for admin users. Admin bypasses credit checks entirely.

### [DONE] Story 8.4: Admin Security Model
As the platform, I want admin operations to be secure. `profiles.role` column (`user` | `admin`). `profiles.banned_at` for ban functionality. Admin RLS policies were initially added (migration `0131_admin_panel.sql`) then **dropped** (migration `20260228000001_drop_admin_rls_policies.sql`) because they caused data leakage through the regular client. Admin panel now exclusively uses service role key — no admin-specific RLS policies.

---

## Additional Notes

### AI Model Configuration
- **Script generation:** OpenRouter (model varies, configurable)
- **Coherence review:** OpenRouter (same endpoint, second pass)
- **Composite images:** NanoBanana/Gemini (`generateCompositeFromImages`, `editCompositeFromReference`)
- **Video generation:** Kling v2.6 (standard) / Kling v3 (HD)
- **Transactional email:** Resend API

### Edge Functions (20 Total)
```
supabase/functions/
├── _shared/            # auth, cors, credits, email, kling, nanobanana, openrouter, rate-limit, response, retry, ssrf, supabase
├── scrape-product/     # Product scraping (Shopify + generic)
├── confirm-products/   # Confirm/edit scraped products
├── upload-product/     # Manual product upload (multipart)
├── generate-persona/   # Persona image generation (2 per call)
├── select-persona-image/  # Set selected persona image
├── persona-images/     # Batch signed-URL generator for persona images
├── generate-composite-images/  # Generate 4 composite previews (step 3)
├── generate-segment-composite/ # Generate 1 composite for Advanced Mode segment
├── edit-composite-image/       # Edit composite via natural language prompt
├── generate-segment-script/    # Generate individual segment script
├── generate-video/     # Two-phase: script generation + approval/Kling submission
├── video-status/       # Poll generation status, download completed segments
├── regenerate-segment/ # Regenerate single completed segment (1 credit)
├── generation-history/ # Paginated generation history
├── credit-balance/     # Credit balance + plan info
├── stripe-checkout/    # Stripe checkout (subscriptions + packs)
├── stripe-webhook/     # Stripe webhook handler
├── stripe-portal/      # Stripe billing portal
├── delete-account/     # Full account deletion
└── send-email/         # Supabase Auth hook (Resend)
```

### Generation Status Flow (Actual)
```
awaiting_approval  ->  locking  ->  submitting_jobs  ->  generating_segments  ->  completed
         |                  |               |                      |
         |                  |               |                      └──> failed (refund)
         |                  |               └──> failed (refund + revert discount)
         |                  └──> failed (insufficient credits: revert to awaiting_approval)
         └──> failed (script generation fails)
```

DB constraint: `status IN ('pending', 'scripting', 'awaiting_approval', 'locking', 'submitting_jobs', 'generating_segments', 'completed', 'failed')`

### Items Deferred (Not Implemented)
- Server-side FFmpeg video stitching (FR23) - needs worker service outside Edge Functions
- Overage billing (FR36) - credit packs replace this model
- Watermark on free tier (DR3) - needs video processing
- NPS survey (SC7)
- Shopify native app
- Team/agency features
- Video analytics
- Direct social publishing
- Multi-language scripts
- Redis-based rate limiting (in-memory rate limiter used instead)
- Full combination builder UI (partially implemented - segments shown by type, basic preview exists)
- Bulk zip download (needs server-side zip creation)
