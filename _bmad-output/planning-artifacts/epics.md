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
| 4 | Paywall & Subscription Billing | P0 | Epic 2 | 12 | ✅ Complete |
| 5 | AI Script & POV Image Generation | P0 | Epic 1, 2, 3, 4 | 6 | ✅ Complete |
| 6 | Video Segment Generation & Delivery | P0 | Epic 5 | 10 | ✅ Complete |
| 7 | User Dashboard & Video Library | P1 | Epic 2, 6 | 3 | ✅ Complete |
| 8 | Admin Panel & Operations | P1 | Epic 2 | 4 | ✅ Complete |
| 9 | Observability & Platform Health | P1 | Epic 2, 8 | 5 | 🟡 Partial (2/5 Done) |
| 10 | Automatic Video Variations | P2 | Epic 5, 6 | 4 | 🔲 Planned |
| 11 | Multi-Segment Silence Removal | P1 | Epic 6 | 1 | 🔲 Planned |

**Total: 10 epics, 61 stories**

**Dependency Graph:**
```
Epic 1 (Products) ────────────────────┐
                                      ├─→ Epic 5 (Script & Image) ─→ Epic 6 (Video) ─→ Epic 7 (Dashboard)
Epic 2 (Auth) ──→ Epic 3 (Personas) ──┤                                      │
              └──→ Epic 4 (Billing) ──┘                                      │
              └──→ Epic 8 (Admin) ──→ Epic 9 (Observability)                 │
                                                                             └─→ Epic 10 (Variations)
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

FR (new) → Epic 4 Stories 4.9-4.13 (`stripe-checkout/`, `stripe-webhook/`, paywall modal, transactional email)
NFR6, NFR7 → Epic 9 (`_shared/sentry.ts`, `lib/datafast.ts`, Sentry SDK)

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

See `stories/epic-4-billing-stories.md` for detailed stories 4.9-4.13.

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

### [DONE] Story 4.9: Annual Billing Option
**Status:** ✅ Done
**As a** user selecting a subscription plan,
**I want** to choose between monthly and annual billing,
**So that** I can save money by committing to an annual plan.

**Acceptance Criteria:**
- [ ] Billing frequency toggle (monthly/annual) displayed in subscription selection UI
- [ ] Annual pricing tiers configured in Stripe with discount vs monthly
- [ ] `stripe-checkout/` accepts `billing` parameter (`monthly` | `annual`)
- [ ] Annual price IDs with hardcoded fallback values for campaigns
- [ ] Subscription renewal dates tracked correctly for annual cycles

**Implementation Notes:**
- Key file(s): `supabase/functions/stripe-checkout/index.ts`, frontend subscription UI
- Key behavior: `billing` parameter in checkout request selects monthly or annual Stripe price ID

> **Not in original plan.** Added post-MVP launch to improve revenue model flexibility.

### [DONE] Story 4.10: Single-Video Paywall Purchase
**Status:** ✅ Done
**As a** user who runs out of credits mid-generation,
**I want** to purchase a single video (5cr standard / 10cr HD) directly from the paywall,
**So that** I can complete my generation without committing to a plan or credit pack.

**Acceptance Criteria:**
- [ ] "Buy just one video" option shown in paywall modal when credits insufficient
- [ ] Single-video products configured in Stripe (`single_standard`, `single_hd`)
- [ ] `stripe-checkout/` handles single-video payment mode
- [ ] `stripe-webhook/` processes single-video pack purchase events
- [ ] Credits (5 or 10) added to balance on successful purchase

**Implementation Notes:**
- Key file(s): `supabase/functions/stripe-checkout/index.ts`, `supabase/functions/stripe-webhook/index.ts`, `frontend/src/lib/stripe.ts` (`SINGLE_VIDEO_PACKS`)
- Key behavior: Paywall gate optimization — users can purchase exactly enough credits for one video without plan commitment

> **Not in original plan.** Discovered during checkout UX testing.

### [DONE] Story 4.11: First-Video 50% Discount
**Status:** ✅ Done
**As a** new user generating my first video,
**I want** a 50% discount on my first generation,
**So that** I can try the platform at a reduced cost.

**Acceptance Criteria:**
- [ ] `profiles.first_video_discount_used` boolean tracks eligibility
- [ ] Cost calculated as `ceil(cost/2)` for first generation
- [ ] Discount restored if first video fails (credits refunded + flag reset)
- [ ] Discount clearly communicated in generation wizard cost summary
- [ ] Replaces original free trial credits model (9 free credits removed)

**Implementation Notes:**
- Key file(s): `profiles` table (`first_video_discount_used` column), `supabase/functions/generate-video/index.ts`
- Key behavior: Atomic discount application — flag set before credit debit, restored on failure

> **Not in original plan.** Replaces FR34 (9 free segment credits).

### [DONE] Story 4.12: 30-Minute Offer Banner
**Status:** ✅ Done
**As a** new user who has just signed up,
**I want** to see a time-limited promotional offer,
**So that** I feel urgency to make my first purchase.

**Acceptance Criteria:**
- [ ] Banner displayed to new users with countdown timer (30 minutes)
- [ ] Promotional discount applied at checkout when banner is active
- [ ] Banner dismissed after expiry or first purchase
- [ ] Timer state persisted across page navigations

**Implementation Notes:**
- Key file(s): Frontend banner component, checkout flow integration
- Key behavior: CRO optimization — urgency-driven conversion for new signups

> **Not in original plan.** CRO improvement.

### [DONE] Story 4.13: Post-Purchase Transactional Email
**Status:** ✅ Done
**As a** user who has just completed a purchase,
**I want** to receive a confirmation email with my purchase details,
**So that** I have a record of my transaction and know my credits are available.

**Acceptance Criteria:**
- [ ] Email sent on successful subscription or pack purchase
- [ ] Email includes plan/pack name, credits added, total cost, billing date
- [ ] Branded HTML template consistent with other transactional emails
- [ ] Delivered via Resend API through `send-email/` hook or direct call

**Implementation Notes:**
- Key file(s): `supabase/functions/stripe-webhook/index.ts`, `supabase/functions/send-email/index.ts`
- Key behavior: Triggered by `checkout.session.completed` webhook event

> **Not in original plan.** Transactional email for purchase confirmation.

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

See `stories/epic-7-stories.md` for detailed story specifications.

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

## Epic 9: Observability & Platform Health

Production monitoring, error tracking, analytics, and platform reliability tooling.

**Depends on:** Epic 2, 8 | **Arch:** Sentry SDK, DataFast, `_shared/sentry.ts`, `lib/datafast.ts`

See `stories/epic-9-stories.md` for detailed story specifications.

> **Not in original plan.** Observability infrastructure added during and after Phase 1 implementation.

### [DONE] Story 9.1: Sentry Error Tracking Integration
**Status:** ✅ Done
**As a** platform operator,
**I want** automatic error capture in frontend and edge functions,
**So that** production errors are tracked, triaged, and resolved quickly.

**Acceptance Criteria:**
- [ ] Sentry Browser SDK initialized in frontend with environment tag
- [ ] `_shared/sentry.ts` exports `captureException(error, context)` for edge functions
- [ ] Generation failures, API errors, and webhook failures captured automatically
- [ ] Performance monitoring enabled for critical paths
- [ ] Environment variables configured: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`

**Implementation Notes:**
- Key file(s): `supabase/functions/_shared/sentry.ts`, `supabase/functions/stripe-webhook/index.ts`, frontend Sentry init
- Key behavior: All unhandled errors captured; contextual metadata (user ID, generation ID) attached to error events

### [DONE] Story 9.2: DataFast Analytics Event Tracking
**Status:** ✅ Done
**As a** product owner,
**I want** key conversion events tracked via DataFast,
**So that** I can analyze the user funnel and optimize conversion rates.

**Acceptance Criteria:**
- [ ] `lib/datafast.ts` exports typed event tracking functions
- [ ] Events tracked: productImported, previewGenerated, scriptGenerated, videoGenerationStarted, paywallShown, checkoutStarted, creditsPurchased, purchaseConfirmed
- [ ] Events fire at correct points in user journey
- [ ] Event payloads include relevant context (product ID, plan name, etc.)

**Implementation Notes:**
- Key file(s): `frontend/src/lib/datafast.ts`
- Key behavior: Client-side analytics pipeline — events sent to DataFast on key user actions across the conversion funnel

### Story 9.3: Platform Health Dashboard (Admin)
**Status:** 🔲 Deferred Phase 2
**As an** admin,
**I want** a real-time platform health dashboard,
**So that** I can monitor error rates, API response times, and generation queue depth.

**Acceptance Criteria:**
- [ ] Real-time error rate and spike detection display
- [ ] API response time percentiles (p50, p95, p99)
- [ ] Generation queue depth and completion time trends
- [ ] Webhook reliability metrics
- [ ] Integration with Sentry for error drill-down

**Implementation Notes:**
- Depends on: Story 9.1 (Sentry), Story 8.1 (Admin Dashboard)
- Key behavior: Admin-only dashboard page aggregating Sentry + DB metrics

### Story 9.4: Redis-backed Rate Limiting
**Status:** 🔲 Deferred Phase 2
**As the** platform,
**I want** Redis-backed rate limiting replacing the current in-memory limiter,
**So that** rate limits are enforced consistently across all edge function instances.

**Acceptance Criteria:**
- [ ] Redis (e.g., Upstash) integrated as rate limit backend
- [ ] Per-user and per-IP rate limits for scraping (10/min, 100/hour)
- [ ] Per-user generation queue limits (3 concurrent)
- [ ] Adaptive backoff for API failures
- [ ] Graceful fallback to in-memory limiter if Redis unavailable

**Implementation Notes:**
- Key file(s): `supabase/functions/_shared/rate-limit.ts`
- Key behavior: Replace in-memory Map with Redis-backed sliding window counter

### Story 9.5: Generation Failure Recovery & Auto-Retry
**Status:** 🔲 Deferred Phase 2
**As a** user whose generation failed,
**I want** automatic retry for transient failures and one-click manual retry,
**So that** I don't lose my work or credits when temporary errors occur.

**Acceptance Criteria:**
- [ ] Automatic retry for transient failures (network, timeouts, 5xx) with exponential backoff
- [ ] User-visible countdown during automatic retry
- [ ] One-click manual retry button on failed generations
- [ ] Failed generation state preserved for re-approval without re-scripting
- [ ] Retry metrics tracked in Sentry

**Implementation Notes:**
- Key file(s): `supabase/functions/generate-video/index.ts`, `supabase/functions/video-status/index.ts`, frontend generation status page
- Key behavior: Retry logic for individual API calls exists (`_shared/retry.ts`); this extends to user-facing workflow retry

---

## Epic 10: Automatic Video Variations

> **Status: Planned — not yet implemented**

Rather than every video segment using the same generic "person speaking to camera" prompt, each segment has a _variation type_ that shapes the visual style, movement, and composition — making generated videos feel intentionally designed, not repetitive. Variation types are categorized by segment role (Hook, Body, CTA) and are either system-randomized or user-selected depending on mode.

**Depends on:** Epic 5, 6 | **Arch:** `generate-video/`, `generate-segment-script/`, `generate-segment-composite/`, generation wizard, `generations` table

### Variation Type Catalog

**Hook Types (10):**
1. Product Reveal — product enters frame from off-screen dramatically
2. Motion Blur Opener — fast camera pan settling on product
3. Close-Up Texture — extreme macro detail of product surface
4. Person Reaction — genuine emotion (surprise, delight) with product
5. Before/After Split — problem state transitioning to product solution
6. Bold Text Overlay — minimal motion, text-first hook
7. Environmental Context — product shown in its natural use setting
8. Unboxing Moment — package opening, first reveal
9. Speed Ramp — slow motion to fast motion for energy
10. Pattern Interrupt — unexpected visual that stops the scroll

**Body Types (5):**
1. Demo In Use — product being actively used / demonstrated
2. Bring Closer — product physically approaches camera (intimacy)
3. Side-By-Side — comparison view (before/after, with/without)
4. Lifestyle Integration — product naturally placed in real environment
5. Feature Callout — zoom to specific feature with visual highlight

**CTA Types (5):**
1. Urgency — limited time or stock (FOMO framing)
2. Social Proof — customer count or testimonial snippet
3. Discount Reveal — percentage off revealed with excitement
4. Curiosity Gap — hint at what happens next, drive to act
5. Direct Ask — simple, confident "try it" / "get yours"

---

### Story 10.1: Variation Type Data Model & Selection Engine
**Status:** 🔲 Planned
**As the** system,
**I want** a structured data model for variation types and a selection engine that assigns types to segments,
**So that** each generated segment uses a distinct, intentional visual style rather than a generic prompt.

**Acceptance Criteria:**
- [ ] Variation types defined as a typed catalog: `hook_types` (10), `body_types` (5), `cta_types` (5)
- [ ] Each type entry includes: `id`, `slug`, `label`, `description`, `prompt_directive` (text injected into Kling/script prompts), `product_categories` (physical/digital/service suitability weights)
- [ ] Selection engine accepts product category and segment role, returns a weighted-random type appropriate for that category
- [ ] In Triple mode, the 3 variants per segment role each receive a different type (no duplicates within a role)
- [ ] Selected variation types stored on the generation record (e.g., `generations.variation_selections` JSONB)
- [ ] Variation type catalog stored as a shared constant accessible to both frontend and edge functions

**Tasks:**
1. Define TypeScript types for `VariationType`, `VariationCatalog`, `VariationSelection`
2. Create the full catalog constant with all 20 types, prompt directives, and category weights
3. Implement `selectVariationTypes(productCategory, mode)` utility in `_shared/`
4. Add `variation_selections` JSONB column to `generations` table via migration
5. Unit test: selection engine returns valid non-duplicate types per role; respects category weights

---

### Story 10.2: Prompt Integration — Variation-Aware Script & Image Generation
**Status:** 🔲 Planned
**As the** system,
**I want** variation types to shape both the AI script text and the composite image prompt,
**So that** the generated script and visuals match the intended variation style for each segment.

**Acceptance Criteria:**
- [ ] `generate-video/` (script phase) injects the variation type's `prompt_directive` into the OpenRouter prompt for each segment
- [ ] Script generation prompt includes the variation label and description as context (e.g., "This hook segment uses the 'Product Reveal' style: product enters frame from off-screen dramatically")
- [ ] `generate-composite-images/` and `generate-segment-composite/` incorporate variation type into the image generation prompt (e.g., composition, camera angle, framing directives)
- [ ] Kling video submission prompt includes variation-specific motion/camera directives (e.g., "fast pan left to right" for Motion Blur Opener)
- [ ] Coherence review pass considers variation type consistency (script tone matches visual style)
- [ ] Per-segment script regeneration (`generate-segment-script/`) respects the assigned variation type

**Tasks:**
1. Update `generate-video/` script generation to read `variation_selections` and inject per-segment prompt directives
2. Update composite image generation to include variation-specific composition/framing in NanoBanana prompt
3. Update Kling submission to append motion/camera directives from variation type
4. Update coherence review prompt to validate script-variation alignment
5. Update `generate-segment-script/` to accept and use variation type context
6. Integration test: end-to-end generation with variation types produces distinct prompts per segment

---

### Story 10.3: Standard Mode — Automatic Variation Assignment
**Status:** 🔲 Planned
**As a** user generating a video in Standard mode,
**I want** the system to automatically assign variation types to each segment based on my product category,
**So that** my videos have visual variety without requiring manual configuration.

**Acceptance Criteria:**
- [ ] In Standard mode, variation types are assigned automatically during script generation (no user input required)
- [ ] Product category (physical / digital / service) influences type selection weights (e.g., "Unboxing Moment" weighted higher for physical products, "Demo In Use" weighted higher for digital)
- [ ] Single mode: 1 type per segment role (3 total selections)
- [ ] Triple mode: 3 different types per segment role (9 total selections, no duplicates within a role)
- [ ] Generation status page (`/generate/[id]`) displays the assigned variation type label next to each segment
- [ ] Variation type labels shown in segment review with a tooltip describing the style
- [ ] Generation history (`/history`) shows variation types used per generation

**Tasks:**
1. Integrate `selectVariationTypes()` call into `generate-video/` at script generation phase
2. Store selections in `generations.variation_selections` before script generation begins
3. Update segment review page to display variation type labels and descriptions
4. Update generation history API and UI to include variation type metadata
5. QA: generate videos for physical, digital, and service products — verify type distribution is category-appropriate

---

### Story 10.4: Advanced Mode — User-Selected Variation Types
**Status:** 🔲 Planned
**As a** user generating a video in Advanced mode,
**I want** to choose the variation type for each segment before generation,
**So that** I have full creative control over the visual style of every segment in my video.

**Acceptance Criteria:**
- [ ] Advanced Mode panel in the generation wizard (step 4) shows a variation type selector for each segment
- [ ] Selectors grouped by role: Hook type picker, Body type picker, CTA type picker
- [ ] Each type displayed with label, short description, and a visual icon/thumbnail representing the style
- [ ] In Triple mode, user selects 3 types per role (UI prevents duplicate selection within a role)
- [ ] Selected types override the automatic selection engine
- [ ] "Randomize" button available per role to let the system pick (same as Standard mode logic)
- [ ] Selected variation types included in the wizard store and sent with the generation request
- [ ] Per-segment script regeneration in Advanced Mode allows changing the variation type and regenerating the script to match

**Tasks:**
1. Add `VariationTypePicker` component with type cards showing label, description, and icon
2. Integrate pickers into `AdvancedModePanel` for each segment role
3. Update wizard store (`generation-wizard.ts`) to hold `variationSelections` in `advancedSegments`
4. Update `generate-video/` to accept user-provided variation selections and skip automatic assignment
5. Update `generate-segment-script/` to accept a `variation_type` parameter for per-segment regeneration
6. QA: Advanced Mode — select types, generate, verify prompts and output match selections

---

---

## Epic 11: Multi-Segment Silence Removal

> **Status: Planned — implementation plan at `docs/plans/2026-03-07-multi-segment-silence-removal.md`**

Remove silence gaps anywhere within a generated video clip, not just at the beginning and end. The current stitcher only computes a single `{start, end}` trim window per clip, leaving middle silences (e.g. a 2-second pause between sentences in an 8-second body clip) fully intact in the final output. This epic replaces the single-bounds model with a multi-segment model that identifies every speech region, removes every silence gap longer than 500ms (preserving natural sub-500ms pauses), and reassembles the clip frame-accurately before the inter-clip concat.

**Depends on:** Epic 6 | **Arch:** `frontend/src/hooks/use-video-stitcher.ts` only — no server, no DB, no new files

### Story 11.1: Multi-Segment Silence Removal in Video Stitcher
**Status:** 🔲 Planned

**As a** user stitching video segments,
**I want** silence gaps anywhere in a clip to be automatically removed,
**So that** the final video feels tight and professional even when generated clips have mid-speech pauses.

**Acceptance Criteria:**
- [ ] `getSpeechSegments(log, duration)` returns an array of speech segments (one entry per speech island between cuttable silences)
- [ ] Only silences > 500ms are removed; shorter pauses (breath, emphasis) are preserved
- [ ] 200ms of audio is kept at each edge of every cut for natural transitions
- [ ] Single-segment clips use a fast path (one trim, no internal concat overhead)
- [ ] Multi-segment clips are trimmed individually then concated into one clip before the inter-clip concat
- [ ] All intermediate temp files are tracked and cleaned from the FFmpeg WASM virtual FS
- [ ] `stitchToBlob` (used by batch stitcher) and `useVideoStitcher` (used by generate page) both use the new logic
- [ ] Public API of both consumers is unchanged (no call-site changes required)
- [ ] TypeScript strict-mode build passes with zero errors

**Tasks:**
1. Add `Segment` type + `MIN_SILENCE_TO_CUT` / `MIN_SEGMENT_DURATION` constants; remove `MIN_TRAILING_SILENCE`
2. Replace `getSpeechBounds` with `getSpeechSegments` (returns `Segment[]`)
3. Replace `detectSpeechBounds` with `detectSpeechSegments` (returns `Promise<Segment[]>`)
4. Add `trimClipToSegments(ffmpeg, inputFile, segments, outputFile)` helper
5. Update `cleanupFFmpegFiles` to accept `extraFiles` parameter
6. Update `stitchToBlob` to use new functions + pass `extraTempFiles` to cleanup
7. Update `useVideoStitcher.stitch()` to use new functions + cleanup on error
8. Delete dead code (`getSpeechBounds`, `detectSpeechBounds`, `MIN_TRAILING_SILENCE`)
9. Run `bun run build` — zero TypeScript errors
10. Manual test: stitch a combo with a known mid-clip silence and verify the gap is removed

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
