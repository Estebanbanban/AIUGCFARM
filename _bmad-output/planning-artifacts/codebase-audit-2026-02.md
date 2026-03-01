# AIUGC Codebase Audit — February 2026

**Audited:** 2026-02-28
**Scope:** Full codebase vs PRD v2.0 + Epics (audited 2026-02-27)
**Auditor:** Automated (Claude)

---

## 1. Pricing & Billing Delta

### Subscription Plans — PRD vs Actual

| Attribute | PRD (Planned) | Actual (Implemented) |
|-----------|---------------|----------------------|
| **Starter price** | $29/mo | **$25/mo** |
| **Starter credits** | 27 segment credits (3 batches) | **30 credits** (1 credit = $1) |
| **Growth price** | $79/mo | **$80/mo** |
| **Growth credits** | 90 segment credits (10 batches) | **100 credits** |
| **Scale price** | $199/mo (Phase 2) | **$180/mo** (implemented in MVP) |
| **Scale credits** | 270 segment credits (30 batches) | **250 credits** |
| **Credit model** | 1 credit = 1 segment | **1 credit = $1; single gen = 5cr (std) / 10cr (HD); triple gen = 15cr (std) / 30cr (HD)** |
| **Free trial** | 9 segment credits (1 batch) | **0 credits** (signup seeds 0; first video 50% off instead) |

**Key delta:** The credit model fundamentally changed. PRD defined credits as segment-based (1 credit = 1 segment, 9 credits = 1 batch). Implementation uses dollar-value credits (1 credit = $1) with costs varying by generation mode and quality tier. This is a complete repricing.

### Credit Packs (NEW — not in PRD)

Credit packs were added as one-time purchase options alongside subscriptions:

| Pack | Credits | Price | Per Credit |
|------|---------|-------|------------|
| Starter Pack | 10 | $12 | $1.20 |
| Creator Pack | 30 | $33 | $1.10 |
| Pro Pack | 100 | $95 | $0.95 |

Packs are priced higher per credit than subscriptions to incentivize recurring subscriptions.

### First Video Discount (NEW — not in PRD)

- `profiles.first_video_discount_used` boolean column added
- First generation for any user is 50% off (ceil(cost/2))
- Replaces the free trial credits model
- If the first video fails, the discount eligibility is restored

### Overage Billing

PRD FR36 defined overage rates ($1.50/$1.00/$0.75 per credit). **Not implemented.** Users must purchase packs or upgrade when credits run out.

### Coupon System (NEW — not in PRD)

`stripe-checkout` supports an allowlist of Stripe coupon IDs:
- `t9QmsQTe` — 30% off once (NewUsers, first paywall 30-min offer)
- `yGuI3xvT` — 50% off once (Starter only, first-video offer)

---

## 2. Feature Implementation Status (FR1–FR38)

### Product Import & Scraping (FR1–FR6)

| FR | Description | Status | Notes |
|----|-------------|--------|-------|
| FR1 | URL submission for scraping | **Implemented** | `scrape-product/` Edge Function |
| FR2 | Extract name, images, description, price, category | **Implemented** | Shopify + JSON-LD + OG tag fallback |
| FR3 | AI brand summary generation | **Implemented** | OpenRouter generates tone, demographic, selling_points |
| FR4 | Review, inline-edit, confirm product data | **Implemented** | `confirm-products/` supports edits + confirmation |
| FR5 | Manual product upload fallback | **Implemented** | `upload-product/` with multipart/form-data |
| FR6 | Shopify primary + generic fallback | **Implemented** | Shopify API first, then JSON-LD, then OG tags |

### Authentication & User Management (FR7–FR10)

| FR | Description | Status | Notes |
|----|-------------|--------|-------|
| FR7 | Email + password registration | **Implemented** | Supabase Auth |
| FR8 | Google OAuth | **Implemented** | Supabase Auth with callback |
| FR9 | Auth gate after scraping | **Partially** | Auth is optional on scrape (affects rate limits), but scraping works unauthenticated. Save is tied to auth. |
| FR10 | Account settings + subscription management | **Implemented** | `/settings` page + `/settings/billing` + Stripe portal |

### Persona Creation (FR11–FR17)

| FR | Description | Status | Notes |
|----|-------------|--------|-------|
| FR11 | Visual character builder with 9 attributes | **Changed** | 8 core attributes + ethnicity replaces skin_tone. Attributes: gender, ethnicity/skin_tone, age, hair_color, hair_style, eye_color, body_type, clothing_style, accessories |
| FR12 | Predefined options via visual controls | **Implemented** | Persona builder UI on `/personas/new` |
| FR13 | Generate 4 AI persona images | **Changed** | Generates **2 images** per call (was 4). Uses Gemini via NanoBanana 2 |
| FR14 | Select preferred image from generated options | **Implemented** | `select-persona-image/` Edge Function |
| FR15 | Persistent persona as reference | **Implemented** | `selected_image_url` stored; reused in composite generation |
| FR16 | Regenerate persona images | **Implemented** | Same `generate-persona/` with `persona_id` param. Free tier capped at 4 regenerations |
| FR17 | Persona slots by tier | **Changed** | Free=1, Starter=1, Growth=3, Scale=10. PRD said Free=0 (blocked). Actual: free users CAN create 1 persona |

### Video Generation — Easy Mode (FR18–FR26)

| FR | Description | Status | Notes |
|----|-------------|--------|-------|
| FR18 | Select product + initiate Easy Mode | **Changed** | Two modes: "single" (1 variant per type) and "triple" (3 per type). No "easy/expert" labels. |
| FR19 | AI writes Hook/Body/CTA script variants | **Implemented** | OpenRouter generates scripts with coherence review pass |
| FR20 | POV composite image generation | **Implemented** | Separate `generate-composite-images/` function; uses Gemini (NanoBanana) |
| FR21 | Independent segment video generation | **Implemented** | Kling v2.6 (std) or v3 (HD) via `submitKlingJob` |
| FR22 | Body segments bounded at 10s max | **Implemented** | LLM constrains body to 5-9s; Kling duration clamped to 5 or 10 |
| FR23 | FFmpeg stitching | **Not implemented** | Deferred per plan. Individual segments only. |
| FR24 | 3 variants per segment type (triple mode) | **Implemented** | Triple mode: 3 hooks + 3 bodies + 3 CTAs = 9 segments |
| FR25 | Segment review + combination builder | **Partially** | Segments displayed by type. Preview player exists on `/generate/[id]`. No explicit combination builder UI found in frontend code. |
| FR26 | Download individual MP4 segments | **Implemented** | Signed URL download from Supabase Storage |

### Video Generation — Expert Mode (FR27–FR30) — Phase 2

| FR | Description | Status | Notes |
|----|-------------|--------|-------|
| FR27 | Edit/rewrite script segments before generation | **Implemented** | Script review/edit step (step 5 in wizard) + override_script on approval |
| FR28 | Mix AI + custom segments | **Implemented** | Users can edit individual segments in step 5 before approving |
| FR29 | Adjust pacing/duration per segment | **Partially** | Duration auto-estimated from word count; no explicit user-facing duration slider |
| FR30 | Select background/environment | **Partially** | Advanced Mode supports per-segment `image_path` (custom composite per segment) and `action_description`. No background environment selector UI. |

### Paywall & Billing (FR31–FR36)

| FR | Description | Status | Notes |
|----|-------------|--------|-------|
| FR31 | Paywall at first generation without subscription | **Changed** | Paywall triggers when credits insufficient, not subscription absence. Users with pack credits can generate without subscription. |
| FR32 | Plan comparison display | **Implemented** | Paywall dialog shows plans + packs with CRO copy |
| FR33 | Stripe checkout | **Implemented** | `stripe-checkout/` creates sessions for both subscriptions and packs |
| FR34 | 9 free segment credits | **Changed** | **0 free credits.** First video discount (50% off) replaces free trial |
| FR35 | Credit balance tracking | **Implemented** | `credit_balances` table + `credit-balance/` endpoint + dashboard display |
| FR36 | Overage billing | **Not implemented** | Deferred. Users must buy packs or upgrade |

### Dashboard & Video Library (FR37–FR38)

| FR | Description | Status | Notes |
|----|-------------|--------|-------|
| FR37 | Generation history with timestamps, product names | **Implemented** | `generation-history/` endpoint + `/history` page + dashboard recent generations |
| FR38 | Re-download previously generated videos | **Implemented** | `/generate/[id]` view with fresh signed URLs |

---

## 3. New Features Not in PRD

### 3.1 Advanced Mode (Per-Segment Kling Control)

**Not in PRD at all.** Implemented as a frontend panel (`AdvancedModePanel`) + backend support:

- Per-segment script text editing with inline emotion tags `[e:emotion:intensity]`
- Per-segment global emotion selector (happy, excited, surprised, serious, neutral)
- Per-segment intensity control (1-3 scale)
- Per-segment action descriptions
- Per-segment custom composite images (via `generate-segment-composite/` and `edit-composite-image/`)
- Emotions converted to Kling prompt directives (e.g., "warm smile, relaxed energy")

Frontend store: `advancedMode` boolean + `advancedSegments` config in `generation-wizard.ts`

### 3.2 Script Review/Approval Flow (Two-Phase Generation)

**Not in PRD.** The legacy single-call generation path was removed. All generations now follow:

1. **Phase "script"**: Create generation record with `awaiting_approval` status, generate script via OpenRouter with coherence review pass, return script + credits_to_charge to frontend
2. **Step 5 (Review)**: User reviews/edits script in wizard step 5
3. **Approval**: User approves with `generation_id`, credits are debited, Kling jobs submitted

Status flow: `awaiting_approval -> locking -> submitting_jobs -> generating_segments -> completed|failed`

The `locking` status provides atomic concurrency protection against double-approvals.

`script_raw` column stores the pre-coherence-review draft; `script` stores the final version.

### 3.3 Composite Image Generation as Separate Edge Function

PRD Story 5.3 embedded composite generation inside `generate-video/`. Implementation extracted it into:

- **`generate-composite-images/`**: Generates 4 composite previews (persona + product) for selection in wizard step 3. Uses Gemini via NanoBanana with staggered requests to avoid rate limits.
- **`generate-segment-composite/`**: Generates a single composite for per-segment custom images in Advanced Mode. Supports `custom_scene_prompt`.
- **`edit-composite-image/`**: Edits an existing composite via natural language prompt (NanoBanana `editCompositeFromReference`).

### 3.4 Per-Segment Regeneration

**Not in PRD.** `regenerate-segment/` Edge Function allows:

- Regenerating a single segment of a completed generation
- Costs 1 credit per regeneration
- Resubmits to Kling with the same composite image and script text
- Sets generation status back to `generating_segments` for that segment only
- Failed regeneration refunds the 1 credit

### 3.5 Delete Account

**Was deferred to Phase 1.5 in epics.** Actually implemented as `delete-account/` Edge Function:

- Requires `{ "confirm": true }` body
- Cancels Stripe subscription
- Deletes storage objects across all 4 buckets
- Deletes all DB records (credit_ledger, credit_balances, generations, personas, products, subscriptions, audit_logs, profiles)
- Deletes auth.users record via admin API

### 3.6 Send Email (Auth Hook)

**Was deferred to Phase 1.5 in epics (NFR8).** Implemented as `send-email/` Supabase Auth Hook:

- Intercepts Supabase Auth emails (signup, recovery, magiclink, email_change)
- Delivers via Resend
- Signup uses 6-digit OTP code (custom branded HTML)
- Recovery/magiclink use custom branded HTML with action links
- HMAC-SHA256 signature verification for webhook security
- Branded as "CineRads" (product name in production)

### 3.7 Admin Panel

**Not in PRD at all.** Full admin dashboard implemented:

Components:
- `AdminShell.tsx` — Layout wrapper
- `UsersTable.tsx` — Full user listing
- `UserActionsModal.tsx` — Ban/unban, credit adjustments
- `StatCard.tsx`, `OverviewChart.tsx`, `RevenueChart.tsx`, `FunnelChart.tsx`, `UsageCharts.tsx` — Analytics

Database:
- `profiles.role` column (`user` | `admin`)
- `profiles.banned_at` column
- Admin RLS policies were created (migration `0131_admin_panel.sql`) then **dropped** (migration `20260228000001_drop_admin_rls_policies.sql`) as a security fix — they caused data leakage through the regular client. Admin panel now exclusively uses service role key.

Credits:
- `ADMIN_UNLIMITED_CREDITS = 2_147_483_647` — admins bypass credit checks entirely
- `credit-balance/` returns `is_unlimited: true` for admin users

### 3.8 Video Quality Tiers (Standard vs HD)

**Not in PRD.** Two quality tiers added:

| Quality | Model | Single Cost | Triple Cost |
|---------|-------|-------------|-------------|
| Standard | kling-v2-6 | 5 credits | 15 credits |
| HD | kling-v3 | 10 credits | 30 credits |

`generations.video_quality` column tracks the tier. `generations.kling_model` column tracks the actual model name used (for cost reconciliation).

### 3.9 Generation Mode: Single vs Triple

**PRD only defined "Easy Mode" (3 variants) and "Expert Mode" (Phase 2).** Implementation replaced this with:

- **Single**: 1 hook + 1 body + 1 CTA = 3 segments (cheaper, faster)
- **Triple**: 3 hooks + 3 bodies + 3 CTAs = 9 segments (matches PRD Easy Mode count)

The `generations.mode` column was changed from `easy/expert` to `single/triple` via migration `005`.

### 3.10 Per-Segment Script Generation Edge Function

`generate-segment-script/` is a standalone Edge Function for generating individual segment scripts. Used by Advanced Mode to regenerate individual segment scripts without running the full pipeline. Supports CTA style constraints and per-segment variant diversity.

### 3.11 Persona Images Edge Function

`persona-images/` is a batch signed-URL generator for persona images. Takes an array of storage paths, validates ownership, and returns signed URLs. Used by the frontend to resolve persona image displays.

### 3.12 CRO / Conversion Optimizations

Not in PRD but implemented:
- Paywall dialog with aspirational copy, value framing ($150-$500 traditional UGC comparison)
- Subscriptions displayed first (recurring revenue), credit packs secondary
- "Most popular" badge on growth plan
- Per-video cost comparison on plans
- First-purchase offer system with time-limited coupons (`use-first-purchase-offer` hook)
- Analytics tracking via DataFast (trackProductImported, trackPreviewGenerated, trackScriptGenerated, etc.)
- Post-checkout success modal with confetti (`PurchaseSuccessModal.tsx`)

### 3.13 CTA Style Configuration

**Not in PRD.** The generation wizard (step 4) includes a CTA style selector with 8 options:
- auto, product_name_drop, link_in_bio, link_in_comments, comment_keyword, check_description, direct_website, discount_code

This feeds into the script generation prompt and per-segment script regeneration.

### 3.14 Format Selection (9:16 / 16:9)

**Not in PRD.** Users can choose portrait (9:16) or landscape (16:9) format for composite images. Stored in wizard state and passed to composite generation functions.

---

## 4. Edge Functions Inventory

| Function | Purpose | Auth | Method |
|----------|---------|------|--------|
| `scrape-product/` | Scrape products from URL (Shopify + generic), generate brand summary | Optional (affects rate limits) | POST |
| `confirm-products/` | Confirm scraped products, apply inline edits | Required | POST |
| `upload-product/` | Manual product upload with images (multipart) | Required | POST |
| `generate-persona/` | Generate AI persona images (2 per call) from attributes + LLM scene prompt | Required | POST |
| `select-persona-image/` | Set selected_image_url on persona | Required | POST |
| `persona-images/` | Batch sign persona image storage paths | Required | POST |
| `generate-composite-images/` | Generate 4 composite preview images (persona + product) | Required | POST |
| `generate-segment-composite/` | Generate 1 composite for per-segment Advanced Mode | Required | POST |
| `edit-composite-image/` | Edit composite image via natural language prompt | Required | POST |
| `generate-segment-script/` | Generate a single segment script (hook/body/cta) | Required | POST |
| `generate-video/` | Two-phase generation: phase="script" (create + script) or approval (debit + Kling) | Required | POST |
| `video-status/` | Poll generation status, download/store completed Kling segments | Required | GET |
| `regenerate-segment/` | Re-submit a single completed segment to Kling (1 credit) | Required | POST |
| `generation-history/` | Paginated generation history with product/persona joins | Required | GET |
| `credit-balance/` | Return credit balance, plan, admin unlimited flag | Required | GET |
| `stripe-checkout/` | Create Stripe checkout session (subscription or pack) | Required | POST |
| `stripe-webhook/` | Process Stripe webhooks (checkout, invoice, subscription) | Stripe signature | POST |
| `stripe-portal/` | Create Stripe billing portal session | Required | POST |
| `delete-account/` | Full account deletion (Stripe, storage, DB, auth) | Required | POST |
| `send-email/` | Supabase Auth hook for transactional emails via Resend | HMAC signature | POST |

**Total: 20 Edge Functions** (epics planned ~10)

### Shared Utilities (`_shared/`)

| Module | Purpose |
|--------|---------|
| `auth.ts` | Extract + verify user ID from Authorization header |
| `cors.ts` | CORS headers for cross-origin requests |
| `credits.ts` | checkCredits, debitCredit, debitCredits, refundCredits + admin bypass |
| `email.ts` | Send email via Resend API |
| `kling.ts` | Kling API wrapper (submitJob, checkStatus) |
| `nanobanana.ts` | NanoBanana/Gemini API wrapper (image generation + editing) |
| `openrouter.ts` | OpenRouter API wrapper |
| `rate-limit.ts` | In-memory rate limiter |
| `response.ts` | JSON response helper |
| `retry.ts` | Generic retry with exponential backoff |
| `ssrf.ts` | URL validation (SSRF protection) |
| `supabase.ts` | Admin Supabase client factory |

---

## 5. Generation Status Flow (Actual)

### Standard Generation (Two-Phase)

```
awaiting_approval  ─→  locking  ─→  submitting_jobs  ─→  generating_segments  ─→  completed
         │                  │               │                      │                   │
         │                  │               │                      └──→ failed (refund)
         │                  │               └──→ failed (refund + revert discount)
         │                  └──→ failed (if insufficient credits: revert to awaiting_approval)
         └──→ failed (if script generation fails)
```

### Phase Breakdown

1. **`awaiting_approval`**: Generation record created, script generated by OpenRouter + coherence review. No credits charged yet. User reviews script.
2. **`locking`**: Atomic transition to prevent double-approval race conditions.
3. **`submitting_jobs`**: Credits debited, Kling jobs being submitted.
4. **`generating_segments`**: All Kling jobs submitted, polling for completion.
5. **`completed`**: All segments downloaded and stored.
6. **`failed`**: Any step failure. Credits refunded. First-video discount restored if applicable.

### Segment Regeneration Flow

```
completed  ─→  generating_segments  ─→  completed
                        │
                        └──→ failed (1 credit refunded)
```

### Status Values in DB Constraint (Final)

```sql
CHECK (status IN (
  'pending', 'scripting', 'awaiting_approval', 'locking',
  'submitting_jobs', 'generating_segments', 'completed', 'failed'
))
```

Note: `pending`, `scripting` exist in the constraint but are not actively written by current code. The two-phase flow starts at `awaiting_approval`. Legacy statuses `content_ready`, `generating_video`, `stitching`, `generating_image` were removed through migrations.

---

## 6. Database Schema (Actual vs Planned)

### Key Tables

All tables from the planned schema exist: `profiles`, `subscriptions`, `credit_balances`, `credit_ledger`, `products`, `personas`, `generations`, `audit_logs`.

### Columns Added Beyond Plan

| Table | Column | Type | Notes |
|-------|--------|------|-------|
| `profiles` | `role` | TEXT (user/admin) | Admin panel support |
| `profiles` | `banned_at` | TIMESTAMPTZ | Admin ban functionality |
| `profiles` | `first_video_discount_used` | BOOLEAN | First-video 50% off tracking |
| `generations` | `video_quality` | TEXT (standard/hd) | Quality tier selection |
| `generations` | `kling_model` | TEXT | Actual Kling model used |
| `generations` | `script_raw` | JSONB | Pre-coherence-review script draft |
| `personas` | `regen_count` | INTEGER | Free-tier regeneration rate limiting |

### Column Changes

| Table | Column | Planned | Actual |
|-------|--------|---------|--------|
| `generations.mode` | `easy/expert` | `single/triple` |
| `generations.status` | `pending, scripting, generating_image, submitting_jobs, generating_segments, generating_video, stitching, completed, failed` | `pending, scripting, awaiting_approval, locking, submitting_jobs, generating_segments, completed, failed` |
| `credit_ledger.reason` | `subscription_renewal, generation, refund, bonus, free_trial` | Added: `subscription_purchase`, `credit_pack_purchase`, `free_plan` |
| `products.source` | `shopify, generic` | Added: `manual` |

### Trigger Changes

`handle_new_user()`:
- PRD/initial: Seeds 9 free credits + ledger entry
- Migration 011: Changed to 0 credits, no free trial
- Migration 20260228120000: Seeds 0 credits with reason `free_plan`
- Migration 20260228200000: Added `SET search_path = public` for security

### RLS Policies

Standard user-owns-own-data policies in place. Admin RLS policies were added then removed (security fix). Service role key used for admin operations.

---

## 7. Deferred Items Actually Built

Items marked "Phase 1.5" or "Phase 2" or "deferred" in epics.md that were actually implemented:

| Item | Epics Status | Actual Status |
|------|-------------|---------------|
| **Account deletion** (Story 2.6) | Deferred to Phase 1.5 | **Fully implemented** (`delete-account/` Edge Function) |
| **Email notifications** (NFR8) | Deferred to Phase 1.5 | **Fully implemented** (`send-email/` Auth Hook via Resend) |
| **Expert Mode script editing** (FR27-FR28) | Phase 2 | **Implemented** as script review step 5 + Advanced Mode panel |
| **Scale tier** | Phase 2 | **Implemented** ($180/mo, 250 credits) |
| **Pacing/duration control** (FR29) | Phase 2 | **Partially** — auto-estimated from word count, emotion tags affect Kling prompts |
| **Background/environment selection** (FR30) | Phase 2 | **Partially** — per-segment composite image selection in Advanced Mode |

### Items Still Deferred

| Item | Notes |
|------|-------|
| FFmpeg stitching (FR23) | Still deferred. Individual segments only. |
| Overage billing (FR36) | Not implemented. Packs replace this. |
| Watermark on free tier (DR3) | Not implemented. |
| NPS survey (SC7) | Not implemented. |
| Shopify native app | Not implemented. |
| Team/agency features | Not implemented. |
| Video analytics | Not implemented. |
| Direct social publishing | Not implemented. |
| Multi-language scripts | Not implemented. |
| Redis-based rate limiting | In-memory rate limiter used instead. |

---

## 8. Generation Wizard Steps (Actual)

From `generation-wizard.ts` and `generate/page.tsx`:

```
Step 1: Product Selection
  - Browse confirmed products
  - Inline product import (URL scrape or manual upload)
  - Select a product to use

Step 2: Persona Selection
  - Browse existing personas
  - Link to create new persona
  - Select a persona to use

Step 3: Preview (Composite Image)
  - Select format: 9:16 (portrait) or 16:9 (landscape)
  - Auto-generates 4 composite images (persona + product via NanoBanana/Gemini)
  - User selects preferred composite
  - Option to edit composite via natural language prompt
  - Option to regenerate composites

Step 4: Configure
  - Mode: Single (1 variant, 5cr std / 10cr HD) or Triple (3 variants, 15cr std / 30cr HD)
  - Quality: Standard (Kling v2.6) or HD (Kling v3)
  - CTA Style: 8 options (auto, name_drop, link_in_bio, etc.)
  - Advanced Mode toggle: per-segment emotion, action, custom composite
  - Shows credit cost summary
  - Paywall triggers if insufficient credits
  - "Generate Script" button → fires phase="script" to generate-video/

Step 5: Review Script
  - Displays AI-generated script (hooks, bodies, CTAs)
  - Editable text fields for each segment
  - Shows variant labels (hook angle, body structure, CTA pattern)
  - Shows credits to be charged
  - "Approve & Generate" button → fires approval to generate-video/ with generation_id
  - On approval: redirects to /generate/[id] for progress monitoring
```

### Wizard State (Zustand + localStorage persistence)

```typescript
{
  step: number,
  productId: string | null,
  personaId: string | null,
  mode: "single" | "triple",
  quality: "standard" | "hd",
  format: "9:16" | "16:9" | null,
  ctaStyle: "auto" | ... (8 options),
  ctaCommentKeyword: string,
  compositeImagePath: string | null,
  pendingGenerationId: string | null,
  pendingScript: { hooks, bodies, ctas } | null,
  creditsToCharge: number | null,
  advancedMode: boolean,
  advancedSegments: AdvancedSegmentsConfig | null,  // excluded from persistence
}
```

The `resumeFromGeneration` action allows resuming a draft from the dashboard (hydrates wizard to step 5 with existing generation data).

---

## 9. Summary of Critical Deltas

### Pricing Model Overhaul
The credit system was completely redesigned from segment-based (1 credit = 1 segment) to dollar-value-based (1 credit = $1) with variable costs per generation mode and quality tier. All plan prices and credit allocations changed. Free trial removed; replaced with first-video discount.

### Generation Flow Restructured
The single-call generation was replaced with a mandatory two-phase review flow (script generation -> user approval -> video generation). This adds the `awaiting_approval` and `locking` statuses and means credits are only charged after explicit user approval.

### Feature Scope Exceeded MVP
Multiple Phase 2 items were built: Expert Mode (script editing + Advanced Mode), Scale tier, account deletion, transactional emails. Additionally, entirely new features not in any PRD phase were added: admin panel, credit packs, composite image editing, per-segment regeneration, CTA style configuration, format selection, video quality tiers (Standard/HD).
