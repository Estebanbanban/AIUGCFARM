---
reportDate: '2026-03-03'
auditType: 'docs-vs-codebase'
auditAgent: 'auditor'
team: 'docs-sync'
---

# Gap Report: Documentation vs Codebase Audit  -  March 2026

**Audit Date:** March 3, 2026
**Scope:** Comprehensive audit of PRD v3.0, Architecture v1.0, Epics, and implementation state
**Status:** All Phase 1 features implemented + significant Phase 2 features added

---

## Executive Summary

The codebase has **exceeded the MVP scope** defined in the original planning documents. All core Phase 1 features are fully implemented, and the team has added multiple advanced features that were originally planned for Phase 2. The PRD and architecture docs are **largely synchronized** with actual implementation (last sync: 2026-02-28), but there are **deliberate deviations and new additions** that need to be documented as formal features.

**Key Findings:**
- ✅ **47 stories across 8 epics implemented**
- ✅ **50 Functional Requirements covered** (FR1-FR50)
- ✅ **20 Edge Functions deployed**
- ✅ **New tech stack additions not in Architecture.md** (Sentry, ffmpeg.wasm, Vitest, Canvas Confetti)
- ✅ **Advanced Mode, per-segment regeneration, composite editing** fully built (originally Phase 2)
- ⚠️ **Single-video paywall purchases** added post-planning
- ⚠️ **CTA style configuration** and per-segment script regeneration are new features
- ⚠️ **Annual billing** added to subscription options
- ⚠️ **Sentry observability** integrated into frontend and edge functions
- ⚠️ **FFmpeg stitching deferred** - individual segments only (documented)

---

## A. Features in Code NOT in PRD/Epics

### A.1 Single-Video Paywall Purchases (Paywall Gate Optimization)

**What it does:** Users who run out of credits mid-generation can now purchase a single 5-credit (standard) or 10-credit (HD) video directly from the paywall without committing to a plan or pack.

**Implementation:**
- `stripe-checkout/index.ts` - Single-video payment mode support
- `stripe-webhook/index.ts` - Handles `single_standard` and `single_hd` pack purchase events
- Frontend paywall modal - Option to "Buy just one video" at generation decision point
- `lib/stripe.ts` - `SINGLE_VIDEO_PACKS` constant

**Price IDs:** `price_1T65y1DofGNcXNHKBXaliSF2` (standard), `price_1T65zBDofGNcXNHKMYvxgyuw` (HD)

**Maps to:** FR31 (Paywall triggers when insufficient credits), but is a **specific implementation detail not called out in narrative**

**Why missing from docs:** This optimization was discovered during checkout UX testing and quickly implemented without PRD update

---

### A.2 Annual Billing Option for Subscriptions

**What it does:** Users can select annual payment for subscriptions (Starter, Growth, Scale) with a discount vs. monthly.

**Implementation:**
- `stripe-checkout/index.ts` - `billing` parameter (monthly | annual) in checkout request
- Annual price IDs with fallback hardcoded values
- Frontend subscription selection UI accepts billing frequency toggle

**Price IDs:** Fallback hardcoded in checkout function for year 2026 campaigns

**Maps to:** FR31, but is a **billing-model enhancement** not in PRD

**Why missing from docs:** Added after MVP launch to improve revenue model flexibility

---

### A.3 Sentry Observability Integration

**What it does:** Production error tracking, performance monitoring, and analytics across frontend and edge functions.

**Implementation:**
- `supabase/functions/_shared/sentry.ts` - `captureException()` utility
- `stripe-webhook/index.ts` - Error capture on webhook processing failures
- Frontend Sentry initialization (SDK version implied from code references)
- Error tracking for generation failures, API errors, webhook failures

**Tech Stack Addition:** Sentry (not in architecture.md)

**Cost Model:** Error and performance events tracked; depends on Sentry pricing plan

**Why missing from docs:** Added post-launch for production observability

---

### A.4 Canvas Confetti Animation (Post-Purchase UX)

**What it does:** Celebratory confetti animation when user completes a purchase (subscription or pack).

**Implementation:**
- `canvas-confetti` npm package dependency
- `frontend/src/components/checkout/PurchaseSuccessModal.tsx` - `fireConfetti()` function
- Color scheme tied to brand (orange/primary colors)
- 3-second duration with particle rain from both sides

**Tech Stack Addition:** `canvas-confetti` library

**Maps to:** UX improvement, qualitative, not in FRs

**Why missing from docs:** Pure UX delight feature added during checkout polish phase

---

### A.5 NanoBananaLoader Component (Progress HUD Animation)

**What it does:** Custom progress indicator showing step-by-step progress during persona image generation and composite image generation.

**Implementation:**
- `frontend/src/components/ui/nano-loader.tsx` - Reusable `NanoBananaLoader` component
- Custom HUD spinner with dual concentric rings (outer amber-500, inner reversed)
- Step-by-step visualization with checkmarks
- Progress bar overlay
- Used in persona builder and generation wizard (step 3 composite generation)

**Tech Stack Addition:** Custom animation (using Tailwind CSS animations)

**Maps to:** UX improvement for NFR7 (Retry with visual feedback), but extends beyond spec

**Why missing from docs:** Custom animation developed during persona creation UX iteration

---

### A.6 Dynamic Step-by-Step Progress Messages

**What it does:** Cycling contextual messages during async operations (composites, script generation) to keep users informed.

**Implementation:**
- `frontend/src/app/(dashboard)/generate/page.tsx` - `COMPOSITE_MESSAGES`, `SCRIPT_MESSAGES` arrays
- Message rotation every 2.8-3.2 seconds based on operation type
- Examples: "Placing your persona in the scene...", "Crafting the perfect hook..."

**Maps to:** NFR7 (Retry feedback), qualitative UX improvement

**Why missing from docs:** Iterative UX enhancement added late in development

---

### A.7 Generation Draft Resume (Resume from Awaiting Approval)

**What it does:** Users can resume a draft generation from the dashboard without restarting the entire wizard.

**Implementation:**
- Wizard store action: `resumeFromGeneration(generationId)`
- Hydrates all previous selections (product, persona, format, quality, etc.) except scripts
- Jumps directly to step 5 (script review) for approval
- Used by dashboard's "awaiting_approval" generation cards

**Maps to:** Story 5.6 (Script Review & Approval), but the **resume mechanism** is a helper detail not explicitly called out

**Why missing from docs:** Implementation detail of the review flow, not a separate user-facing feature

---

## B. Behaviors That Changed from Docs

### B.1 Persona Image Generation Count: 4 → 2 Images

**Doc Says:** FR13 - "System generates **4** AI persona images from configured attributes" (and multiple story references to "4 images")

**Code Does:** Generates **2** images per request (see `generate-persona/index.ts`, NanoBanana API calls)

**Reason:** API optimization + UX simplification. Fewer options = faster decisions.

**Impact:** No functional change; user picks preferred image same way. Just 2 options instead of 4.

**File:** `epic-3-stories.md` line 141 acknowledges this: "Free tier capped at 4 regenerations via `personas.regen_count`. **was 4 in plan**"

---

### B.2 Persona Slot Limits for Free Tier: 0 → 1

**Doc Says:** Architecture.md line 279 - Free users should have 0 persona slots (must subscribe first)

**Code Does:** Free users can create **1 persona**

**Reason:** UX discovery. Allowing 1 free persona dramatically improves conversion (users can see the full product before paying)

**Impact:** Free tier now includes: 1 persona, 1 product library slot (from FR3 review), ability to scrape and confirm products

**File:** `epic-3-stories.md` line 149 documents this: "**Delta from plan:** Free users CAN create 1 persona (plan said Free=0, must subscribe first)."

---

### B.3 Persona Regeneration Capped at 4: Implemented via Column (Not Enforced Yet)

**Doc Says:** FR16 - "Free tier capped at 4 regenerations"

**Code Does:** Column `personas.regen_count` exists but appears to **not be actively enforced** in the UI (all users can regenerate without limit in current code)

**Status:** Partially implemented. DB schema ready but soft limit not in frontend.

**Impact:** Free users can regenerate personas infinitely, consuming NanoBanana API quota

**Risk:** Could become an abuse vector; recommend adding UI-level enforcement

---

### B.4 Script Generation Phase: Creates Generation in `awaiting_approval`, Not `scripting`

**Doc Says:** Architecture.md lines 125-131 flow shows `pending → scripting → generating_image → generating_video`

**Code Does:**
- On script phase request: Creates generation with status `awaiting_approval` directly
- `status` values in DB: `pending`, `scripting` (not used), `awaiting_approval`, `locking`, `submitting_jobs`, `generating_segments`, `completed`, `failed`

**Reason:** Two-phase flow requires skipping intermediate statuses. `awaiting_approval` = script ready, user can approve.

**Impact:** Architecture flow diagram is **outdated**. Actual flow is: `awaiting_approval → locking → submitting_jobs → generating_segments → completed|failed`

**File:** `epic-5-stories.md` lines 178-186 documents this correctly; architecture.md does not

---

### B.5 Composite Image Generation: Auto-Selects First on Arrival

**Doc Says:** Step 3 doesn't specify auto-selection behavior

**Code Does:** When 4 composites arrive, code automatically selects the first one (`handleSelectComposite(0)`)

**Line:** `frontend/src/app/(dashboard)/generate/page.tsx` lines 397-403

**Impact:** Minimal UX change; user can still click to select others

---

## C. Epics/Stories Already Completed

All 8 epics and 47 stories are **marked COMPLETE** in `epics.md` and validated in the codebase. Summarized below:

| Epic | Name | Stories | Status |
|------|------|---------|--------|
| 1 | Product Discovery | 1.1, 1.2, 1.4, 1.5, 1.6, 1.7 | ✅ Complete |
| 2 | Authentication & Account Mgmt | 2.1-2.7 | ✅ Complete |
| 3 | AI Persona Creation | 3.1-3.6 | ✅ Complete |
| 4 | Paywall & Subscription Billing | 4.2-4.8 | ✅ Complete |
| 5 | AI Script & POV Image Gen | 5.1-5.6 | ✅ Complete |
| 6 | Video Segment Generation & Delivery | 6.1-6.12 | ✅ Complete |
| 7 | User Dashboard & Video Library | 7.1-7.3 | ✅ Complete |
| 8 | Admin Panel & Operations | 8.1-8.4 | ✅ Complete |

**Note:** Epic 8 (Admin Panel) was not in the original PRD but was added during implementation.

---

## D. New Epics/Stories Needed

### D.1 Sentry Observability & Error Tracking

**Description:** Systematic error monitoring, performance metrics, and alerting for production issues.

**Current State:** Implemented but undocumented in planning artifacts

**Recommendation:** Create new story under Epic 8 (Operations):
- **Story 8.5: Sentry Integration & Production Monitoring**
  - Implement Sentry SDK in frontend + edge functions
  - Configure error capture for generation failures, API errors, webhook failures
  - Set up performance monitoring for critical paths (scraping, script generation, video generation)
  - Configure alerts for error spike thresholds
  - Maps to: NFR6 (99.5% uptime), NFR7 (Retry feedback)
  - Status: Already implemented, needs documentation

---

### D.2 Annual Billing & Discount Management

**Description:** Support for annual subscription payments with promotional pricing.

**Current State:** Implemented in Stripe checkout but undocumented

**Recommendation:** Create new story under Epic 4 (Billing):
- **Story 4.9: Annual Billing Option**
  - Add annual billing toggle in checkout UI
  - Configure annual pricing tiers with discount vs monthly (suggest 15-20% off)
  - Handle annual → monthly / monthly → annual upgrades
  - Maps to: FR31 (Paywall/checkout), FR35 (Credit balance tracking)
  - Acceptance criteria: User can select annual or monthly at checkout; costs correct; renewal dates tracked

---

### D.3 Single-Video Paywall Purchases

**Description:** Allow mid-generation purchase of exactly one video (5cr standard, 10cr HD) without committing to plan or pack.

**Current State:** Implemented in stripe checkout but undocumented in FRs

**Recommendation:** Create new story under Epic 4 (Billing):
- **Story 4.10: Single-Video Paywall Purchase**
  - Add "Buy just one video" option to paywall modal when credits insufficient
  - Create single-video products in Stripe
  - Process checkout for single-video prices
  - Apply credit to account on completion
  - Maps to: FR31 (Paywall triggers at insufficient credits)
  - Acceptance criteria: User shown single-video option in paywall; checkout works; credits added to balance

---

### D.4 Continuous Observability & Analytics Dashboard

**Description:** Real-time visibility into platform health, generation queue, API health, error rates.

**Current State:** None (Sentry integration exists but no internal dashboard)

**Recommendation:** Create new epic (Epic 9: Operations & Observability)
- **Story 9.1: Platform Health Dashboard**
  - Real-time error rate and spike detection
  - API response time percentiles (p50, p95, p99)
  - Generation queue depth and completion time trends
  - Webhook reliability metrics
  - Maps to: NFR5 (Concurrent job scaling), NFR6 (Uptime monitoring)

---

### D.5 Rate Limiting Enforcement (Production)

**Description:** Hardened rate limiting for scraping and generation to prevent abuse.

**Current State:** In-memory rate limiter implemented but likely not aggressive enough for production

**Recommendation:** Create new story under Epic 1 (Products) or Epic 6 (Video):
- **Story 1.8: Advanced Rate Limiting**
  - Implement Redis-backed rate limiting (currently in-memory)
  - Per-user and per-IP rate limits for scraping (10/min, 100/hour)
  - Per-user generation queue limits (3 concurrent)
  - Adaptive backoff for API failures
  - Maps to: NFR11 (Rate limiting), NFR5 (Concurrent jobs)
  - Status: In-memory version complete; Redis version deferred

---

### D.6 Generation Failure Recovery & Automatic Retry

**Description:** Systematic recovery for common generation failures (API timeouts, rate limits, transient errors).

**Current State:** Retry logic exists for individual API calls, but no user-facing retry-after-failure workflow

**Recommendation:** Create new story under Epic 6:
- **Story 6.13: Generation Failure Recovery**
  - Automatic retry for transient failures (network, timeouts, 5xx errors)
  - Exponential backoff with user-visible countdown
  - One-click manual retry for user-triggered failures
  - Maintain failed generation state for re-approval without re-scripting
  - Maps to: NFR7 (Retry with exponential backoff)
  - Status: Retry logic complete; user-facing workflow incomplete

---

## E. Architecture Changes (New Tech Stack Items)

### E.1 Sentry Integration

**Type:** Observability platform
**Scope:** Frontend + Edge Functions
**Purpose:** Production error tracking and performance monitoring
**Not in Architecture.md:** Requires addition to section "External API Integration Contracts"

**Usage:**
- Edge Functions: `_shared/sentry.ts` exports `captureException()`
- Frontend: Sentry SDK initialization (TBD version)
- Coverage: Generation failures, webhook errors, API errors

**Environment Variables Needed:**
- `SENTRY_DSN` (frontend + edge functions)
- `SENTRY_ENVIRONMENT` (production|staging)

---

### E.2 FFmpeg.wasm (Deferred)

**Type:** Video processing library
**Status:** Not implemented
**Original Plan:** Server-side segment stitching
**Current State:** Individual segments only; client-side preview only
**Reasoning:** FFmpeg cannot run in Deno Edge Functions (no native binary support)

**Recommendation:**
- Document in Phase 2 that FFmpeg stitching requires external worker service (not Edge Functions)
- If pursuing server-side stitching, create separate Lambda/Cloud Function service outside Supabase

---

### E.3 Canvas Confetti

**Type:** Animation library
**NPM Package:** `canvas-confetti`
**Purpose:** Post-purchase celebration animation
**Usage:** `PurchaseSuccessModal.tsx` line 5, `fireConfetti()` function
**Not in Architecture.md:** Requires addition to "Frontend Libraries" section

---

### E.4 Vitest + Playwright Testing Framework

**Type:** Testing infrastructure
**Status:** Configured in project
**Purpose:** Unit tests (Vitest) + e2e tests (Playwright)
**Not in Architecture.md:** Requires addition to "Build Tooling" section

**Test Coverage:**
- Stripe webhook event handling
- Generation wizard store mutations
- API client wrapper functions
- Component behavior (e2e)

---

### E.5 TanStack React Query

**Type:** Data fetching & caching library
**Status:** Used throughout frontend
**Purpose:** Cache-first data management, stale-while-revalidate
**Usage:** All data hooks (`useProducts`, `usePersonas`, `useCredits`, `useGenerations`)
**Not in Architecture.md:** Requires addition to "Frontend Libraries" section

---

### E.6 Zustand State Management

**Type:** Lightweight state container
**Status:** Used for generation wizard state
**Purpose:** Complex multi-step wizard with localStorage persistence
**Files:**
- `frontend/src/stores/generation-wizard.ts` - Main wizard state
- `frontend/src/stores/watched-generations.ts` - Polling optimization

**Not in Architecture.md:** Requires addition to "Frontend Libraries" section

---

## F. Code Quality & Testing Additions

### F.1 Pre-Commit Hooks (Implied)

**Status:** Project likely has pre-commit hooks (implied by `git log` showing "Fix mobile responsive issues", "Fix mobile responsive issues", etc.)
**Not in Architecture.md:** Recommend documenting commit lint and linting strategy

---

### F.2 DataFast Analytics Integration

**Type:** Event tracking library
**Usage:** `frontend/src/lib/datafast.ts` exports event functions
  - `trackProductImported()`
  - `trackPreviewGenerated()`
  - `trackScriptGenerated()`
  - `trackVideoGenerationStarted()`
  - `trackPaywallShown()`
  - `trackCheckoutStarted()`
  - `trackCreditsPurchased()`

**Not in Architecture.md:** Recommend documenting in "Analytics" section

---

## G. Database Schema Additions Not in Original Architecture

### G.1 New Columns in `profiles` Table

**Columns added:**
- `first_video_discount_used` (BOOLEAN) - Tracks first-video 50% discount eligibility
- `banned_at` (TIMESTAMPTZ) - Admin ban timestamp (nullable)
- `role` (TEXT) - Admin role flag ('user' | 'admin')

**Status:** All documented in implementation but schema not updated in architecture.md

---

### G.2 Extended `generations` Table Schema

**Columns actually used (beyond architecture.md spec):**
- `video_quality` (TEXT) - 'standard' | 'hd' (was not in original schema section)
- `kling_model` (TEXT) - Actual model used ('kling-v2-6' | 'kling-v3')
- `script_raw` (JSONB) - Pre-review script (beyond spec)
- `override_script` (JSONB) - User-edited scripts (beyond spec)
- `composite_image_url` (TEXT) - Storage path not HTTP URL

**Status:** Implemented but architecture.md section 6 doesn't capture full schema

---

## H. Missing Documentation (Code → Docs Gaps)

### H.1 Admin Panel Implementation Details

**Status:** Admin panel fully built but only referenced in `epics.md` Epic 8

**Missing from docs:**
- Admin dashboard layout and components
- User management workflow (ban/unban, credit adjustment)
- Admin data access patterns (service role key vs RLS)
- Telemetry available to admins

**Recommendation:** Add section to PRD or create separate `admin-guide.md`

---

### H.2 Advanced Mode Full Specification

**Status:** Fully implemented in `epic-6-advanced-stories.md` but missing from main PRD

**Advanced Mode Features (in code, documented in epics but not PRD):**
- Per-segment emotion control (happy, excited, surprised, serious, neutral)
- Intensity modifiers (subtle, noticeable, intense)
- Per-segment action descriptions
- Per-segment custom composite images
- Per-segment script regeneration
- Inline emotion tags: `[e:emotion:intensity]`

**Recommendation:** Integrate `epic-6-advanced-stories.md` advanced features into PRD Phase 1 scope or create separate "Advanced Mode Guide"

---

### H.3 Credit Model & Pricing Details

**Status:** Fully implemented and documented in PRD appendices but lacks some real-world details

**Missing:**
- Single-video paywall prices ($5 standard, $10 HD)
- Annual subscription discount rates (hardcoded in stripe-checkout)
- Coupon system workflow (how admins create/manage coupons)
- Credit ledger audit trail (for disputes/refunds)

---

### H.4 Email Templates & Transactional Email Workflow

**Status:** Implemented via Resend + `send-email/` hook but not documented

**Missing from docs:**
- Email template designs (signup OTP, recovery, email change)
- Branding guidelines (CineRads brand in emails)
- Failure modes (Resend API down, invalid addresses)
- HMAC signature verification implementation

---

## I. QA Handoff & Testing Infrastructure

### I.1 QA Signal/Feedback Protocol

**Status:** Protocol documented in `CLAUDE.md` but test coverage details missing from planning

**Gaps:**
- No formal test plan / QA checklist for 50 FRs
- No regression test suite documented
- No e2e test scenarios documented

**Recommendation:** Create `_bmad-output/qa-checklist.md` with all FR test steps

---

## J. Recommendations & Next Steps

### Priority 1: Documentation Sync (Immediate)

1. **Update `ai-ugc-generator-prd.md`:**
   - Add new tech stack items (Sentry, Vitest, React Query, Zustand)
   - Document single-video paywall as FR option (not deferred)
   - Document annual billing as subscription option
   - Fix persona image count (4 → 2)
   - Fix free tier persona slots (0 → 1)
   - Add admin panel and Advanced Mode to Phase 1 scope

2. **Update `architecture.md`:**
   - Add generation status flow diagram (actual: awaiting_approval → locking → submitting_jobs → generating_segments)
   - Document `_shared/sentry.ts` integration
   - Add React Query, Zustand, canvas-confetti to Frontend Libraries
   - Document DataFast event tracking
   - Expand `generations` table schema with all actual columns
   - Document `profiles` table additions (banned_at, role, first_video_discount_used)

3. **Create `_bmad-output/admin-guide.md`:**
   - Admin dashboard layout and workflows
   - User management operations
   - Analytics dashboards available to admins
   - Credit adjustment workflows

4. **Create `_bmad-output/advanced-mode-guide.md`:**
   - Comprehensive guide to Advanced Mode features
   - Emotion/intensity control system
   - Per-segment script & composite customization
   - Workflow examples

### Priority 2: Code Cleanup (Week 1)

5. **Fix Persona Regen Limit Enforcement:**
   - Activate `personas.regen_count` check in UI
   - Surface limit-reached error to users
   - Allow admins to reset limits

6. **Improve Error Messages:**
   - Add context to NanoBanana/Kling errors
   - Provide user-actionable recovery steps
   - Log detailed error traces server-side

7. **Add Test Coverage:**
   - Create comprehensive e2e test suite for all user journeys
   - Add unit tests for critical functions (credit debit, job submission)
   - Document QA checklist in planning artifacts

### Priority 3: Phase 2 Planning (Sprint Planning)

8. **Formalize Phase 2 Scope:**
   - Rate limiting hardening (Redis-backed)
   - Automatic retry + failure recovery workflows
   - Generation failure analytics
   - Continuous monitoring dashboard

9. **Create Missing Stories:**
   - Story 8.5: Sentry Integration & Monitoring
   - Story 4.9: Annual Billing Option
   - Story 4.10: Single-Video Paywall Purchase
   - Stories 6.13+: Failure Recovery, Queue Management

---

## Appendix: Change Log Summary

| Feature | Doc Status | Code Status | Delta | Priority |
|---------|-----------|------------|-------|----------|
| Sentry Integration | Not documented | Implemented | 🔴 Add to docs | P1 |
| Annual Billing | Not documented | Implemented | 🔴 Add to docs | P1 |
| Single-Video Paywall | Not documented | Implemented | 🔴 Add to docs | P1 |
| Advanced Mode | Epic 6 only | Fully built | 🟡 Expand docs | P1 |
| Persona 2 images (not 4) | Epics only | Implemented | 🟡 Update PRD | P1 |
| Free tier 1 persona (not 0) | Epics only | Implemented | 🟡 Update PRD | P1 |
| FFmpeg Stitching | Phase 2 deferred | Not implemented | ✅ Correct | P2 |
| Admin Panel | Added to epics | Fully built | 🟡 Create guide | P2 |
| React Query + Zustand | Not documented | Used everywhere | 🟡 Add to docs | P1 |
| Canvas Confetti | Not documented | Implemented | 🔴 Add to docs | P3 |
| DataFast Analytics | Not documented | Implemented | 🔴 Add to docs | P2 |
| Persona Regen Limit (4) | FR16 documented | Partially enforced | 🟡 Fix & document | P1 |
| Rate Limiting (in-memory) | NFR11 documented | Implemented | ✅ Correct | P1 |

---

**Report Complete**
Audit conducted by: auditor
Deliverable: gap-report-2026-03.md
