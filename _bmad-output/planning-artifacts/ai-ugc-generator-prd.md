---
workflowType: 'prd'
workflow: 'edit'
classification:
  domain: 'e-commerce'
  projectType: 'saas_b2b'
  complexity: 'medium'
inputDocuments:
  - 'ai-ugc-generator-prd-v1-draft.md'
stepsCompleted:
  - 'step-e-01-discovery'
  - 'step-e-01b-legacy-conversion'
  - 'step-e-02-review'
  - 'step-e-03-edit'
  - 'step-e-04-implementation-sync'
lastEdited: '2026-03-04'
editHistory:
  - date: '2026-02-26'
    changes: 'Full restructure from legacy format to BMAD standard. Extracted 38 FRs from narrative. Created SMART success criteria. Converted UI flow to user journeys. Added domain requirements, innovation analysis, project-type requirements. Removed tech stack and epic breakdown sections (relocated to Architecture and Epics docs). Tightened all NFRs with measurement methods.'
  - date: '2026-02-28'
    changes: 'Synchronized PRD with implemented codebase (Feb 2026 audit). Updated credit model from segment-based to dollar-value (1 credit = $1). Updated all plan prices and credit allocations to match implementation. Moved Expert Mode, Scale tier, account deletion, email notifications from Phase 2/deferred to Phase 1. Added new FRs (FR39-FR50) for: script review/approval, Advanced Mode, per-segment regeneration, composite image editing, credit packs, admin panel, CTA style, format selection, video quality tiers, coupon system. Updated Phase 2 scope to reflect only genuinely unbuilt features. Updated pricing appendix with actual tiers, credit packs, and generation costs.'
  - date: '2026-03-03'
    changes: 'March 2026 docs-sync audit (pass 1). Added Key Frontend Libraries section (React Query, Zustand, Sentry, Vitest+Playwright, DataFast, canvas-confetti). Added FR51-FR55: annual billing, single-video paywall purchase, post-purchase email, first-video discount tracking, offer banner. Added observability NFRs (NFR-OBS1, NFR-OBS2). Updated Phase 2 with deferred-item notes (FFmpeg worker, Redis rate limiting, failure recovery). Confirmed persona image count (2), free tier persona slot (1), admin panel and Advanced Mode in Phase 1.'
  - date: '2026-03-04'
    changes: 'March 2026 docs-sync audit (pass 2). Added ffmpeg.wasm + fflate to tech stack. Updated FR23 from Deferred to client-side implemented. Updated FR41 per-segment regen to dynamic credit cost (1cr standard / 2cr HD). Added FR56-FR63: client-side video stitching, auto-stitch, batch stitch+zip, paywall pre-check, EdgeError typed API errors, credit polling after purchase, NanoBananaLoader progress HUD, quality labels. Updated Phase 1 scope with stitching, paywall pre-check, EdgeError, credit polling, NanoBananaLoader, quality labels, mobile responsive. Updated Phase 2 FFmpeg note. Updated credit cost matrix and added single-video pricing appendix.'
---

# Product Requirements Document  -  AI UGC Generator

**Author:** Axel Ronsin
**Date:** February 2026
**Version:** 3.1  -  Implementation-Synchronized
**Product Name:** CineRads

---

## Executive Summary

**Vision:** AI UGC Generator (CineRads) eliminates the cost, speed, and consistency bottleneck of UGC-style video ad production for e-commerce brands.

**Product:** A micro-SaaS platform where users paste their store URL, auto-import product data, build a custom AI persona via a Sims-like character creator, and generate short-form UGC video ads (Hook / Body / CTA structure) in minutes  -  not days.

**Differentiator:** Unlike generic AI video tools, AI UGC Generator combines three capabilities no competitor unifies: automated store-data scraping (zero manual input), persistent AI persona creation (consistent brand spokesperson across all videos), and UGC-optimized segmented video generation (Hook/Body/CTA structure tuned for paid social).

**Target Users:**
- Shopify/WooCommerce store owners running paid social ads
- DTC brands scaling ad creative volume
- E-commerce agencies managing multiple client accounts
- Dropshippers needing fast, cheap video ads for product testing

**Business Model:** Dollar-value credit-based SaaS with subscriptions and one-time credit packs. 1 credit = $1 value. Users generate video ads through a two-phase flow: AI script generation (free) followed by user-approved video generation (credits debited on approval). Credit costs vary by generation mode and quality tier: Standard single = 5 credits, Standard triple = 15 credits, HD single = 10 credits, HD triple = 30 credits. Three subscription tiers: Starter ($25/mo, 30 credits), Growth ($80/mo, 100 credits), Scale ($180/mo, 250 credits). One-time credit packs available: 10 credits ($12), 30 credits ($33), 100 credits ($95). First-video 50% discount replaces free trial credits.

**Problem:** UGC creators cost $150-$500+ per video, take days-to-weeks, and deliver inconsistent quality. Brands needing 10-50+ variations per product face a production bottleneck that directly limits ad spend scaling.

---

## Key Frontend Libraries

> Full tech stack documented in `architecture.md`. The following are notable frontend additions implemented beyond the original architecture spec:

| Library | Purpose |
|---|---|
| React Query (TanStack Query) | Data fetching & caching (all data hooks: useProducts, usePersonas, useCredits, useGenerations) |
| Zustand | Generation wizard state management with localStorage persistence (`stores/generation-wizard.ts`) |
| Sentry | Production error tracking + performance monitoring (frontend SDK + Edge Function `_shared/sentry.ts`) |
| Vitest + Playwright | Unit testing (Vitest) and end-to-end testing (Playwright) framework |
| DataFast | Analytics event tracking (`lib/datafast.ts`: product imported, preview generated, script generated, video generation started, paywall shown, checkout started, credits purchased) |
| canvas-confetti | Post-purchase celebration animation in `PurchaseSuccessModal.tsx` |
| @ffmpeg/ffmpeg + @ffmpeg/util | Client-side video stitching via WebAssembly — trims silence, concatenates Hook+Body+CTA segments into a single MP4 (`hooks/use-video-stitcher.ts`) |
| fflate | Client-side zip compression for batch stitch export (`hooks/use-batch-stitcher.ts`, `hooks/use-zip-download.ts`) |

---

## Success Criteria

All criteria measured from public launch date. Baselines are zero (greenfield product).

| ID | Criterion | Target (Month 3) | Target (Month 6) | Measurement Method |
|---|---|---|---|---|
| SC1 | Landing page visitors who initiate a store scrape | 40% | 50% | Analytics: URL submit events / unique landing page sessions |
| SC2 | Users who scrape -> complete signup | 25% | 35% | Analytics: signup completion events / scrape initiation events |
| SC3 | Signed-up users who convert to paid plan or pack | 8% | 12% | Stripe: paying customers / total registered accounts |
| SC4 | Monthly Recurring Revenue | $5,000 | $25,000 | Stripe MRR dashboard |
| SC5 | Monthly churn rate | < 15% | < 10% | Stripe: churned subscriptions / active subscriptions at period start |
| SC6 | Average video generations per active user per month | 8 | 15 | Database: total generations / active users in period |
| SC7 | Net Promoter Score | 30+ | 45+ | In-app NPS survey triggered after 5th generation (deferred) |

**Traceability:** SC1-SC2 validate the value-first funnel (UJ1). SC3-SC5 validate monetization (UJ3). SC6 validates core product utility (UJ2). SC7 validates overall satisfaction.

---

## Product Scope

### Phase 1: MVP (v1.0)  -  IMPLEMENTED

Core value loop: Scrape -> Persona -> Script Review -> Generate -> Download.

- Landing page with URL input CTA and marketing content
- Website scraping: Shopify stores (primary), generic HTML fallback (JSON-LD + OG tags), manual upload fallback
- Authentication: Email + password, Google OAuth
- AI-powered brand summary generation from scraped data (tone, demographic, selling points via OpenRouter)
- Persona creation: visual character builder with 8 configurable attributes (gender, ethnicity/skin_tone, age, hair color, hair style, eye color, body type, clothing style) plus accessories
- AI persona image generation: 2 variants per request via Gemini/NanoBanana, user selects preferred. Free tier capped at 4 regenerations
- Two-phase generation flow: AI writes script (phase 1, no credit charge) -> user reviews/edits script (step 5) -> user approves -> credits debited and video generation begins
- Single mode (1 variant per segment type = 3 segments, 5cr standard / 10cr HD) and Triple mode (3 variants per type = 9 segments, 15cr standard / 30cr HD)
- Standard quality (Kling v2.6) and HD quality (Kling v3)
- Composite image generation: 4 previews per request (persona + product via NanoBanana/Gemini), user selects preferred
- Advanced Mode: per-segment emotion/action control, inline emotion tags `[e:emotion:intensity]`, per-segment custom composite images, per-segment script regeneration
- CTA style configuration: 8 options (auto, product_name_drop, link_in_bio, link_in_comments, comment_keyword, check_description, direct_website, discount_code)
- Format selection: portrait (9:16) or landscape (16:9)
- Segmented video pipeline: generates Hook, Body, CTA segments independently via Kling
- Script review step with coherence review pass (OpenRouter two-pass: generation + quality scoring/revision)
- Per-segment regeneration (dynamic credit cost: 1cr standard / 2cr HD, refunded on failure)
- Composite image editing via natural language prompts
- Segment review by type + preview player on `/generate/[id]`
- Download individual MP4 segments via signed URLs
- Paywall triggers when credits insufficient (not subscription absence). Users with pack credits can generate without subscription
- Three subscription tiers: Starter ($25/mo, 30cr), Growth ($80/mo, 100cr), Scale ($180/mo, 250cr)
- One-time credit packs: Starter Pack (10cr, $12), Creator Pack (30cr, $33), Pro Pack (100cr, $95)
- First-video 50% discount (replaces free trial credits). Discount restored on failure
- Coupon system: allowlisted Stripe coupon IDs for promotional offers
- CRO-optimized paywall dialog: aspirational copy, value framing, subscriptions-first layout, "Most popular" badge, per-video cost comparison
- Post-checkout success modal with confetti animation
- User dashboard with generation history, credit balance, recent generations
- Video library with re-download via fresh signed URLs
- Account settings page with billing management via Stripe portal
- Account deletion: full cleanup (Stripe subscription cancellation, storage deletion across 4 buckets, all DB records, auth user)
- Transactional email via Resend (signup OTP, recovery, magic link, email change) through Supabase Auth hook
- Admin panel: user listing, ban/unban, credit adjustments, analytics dashboards (overview, revenue, funnel, usage). Admin users bypass credit checks entirely
- Persona slots by tier: Free=1, Starter=1, Growth=3, Scale=10
- Analytics tracking via DataFast
- Client-side video stitching via ffmpeg.wasm: silence trimming + concatenation of Hook+Body+CTA into single MP4. Auto-stitch on completion. Batch stitch+zip export via fflate
- Paywall pre-check: client-side credit check before script generation to avoid wasted API calls
- Structured API error handling via EdgeError class + ErrorCodes enum across all Edge Functions
- Credit polling after purchase: staggered smart-refresh with optimistic profile updates to prevent balance flash
- NanoBananaLoader: branded progress HUD with step-by-step visualization for async operations
- Quality labels (Standard/HD) displayed throughout generation wizard, paywall, and review pages
- Mobile responsive: dashboard, video library, and landing page functional on mobile viewports (generation wizard desktop-optimized)

### Phase 2: Growth (v1.1-v1.3)

Features not yet implemented:

- Direct publishing to TikTok, Meta, YouTube Shorts
- A/B testing framework: auto-generate variations, track performance, suggest winners
- Multi-language script generation (10+ languages)
- Marketplace: community-created persona templates
- White-label offering for agencies
- Server-side FFmpeg stitching (client-side stitching via ffmpeg.wasm implemented in Phase 1; server-side stitching for higher reliability and mobile support requires an external worker service, not possible in Deno Edge Functions; evaluate Lambda/Cloud Function worker)
- Bulk zip download of segments
- Shopify native app integration (OAuth + embedded admin)
- Team/agency features: multi-seat accounts, shared personas, brand profiles
- Video analytics: view counts, click-through tracking per video
- Watermark on free-tier outputs
- NPS survey integration
- Redis-backed rate limiting hardening (in-memory rate limiting implemented in Phase 1; Redis version deferred to Phase 2)
- Generation failure recovery workflow (retry logic exists for individual API calls; user-facing retry-after-failure workflow with exponential backoff and one-click manual retry deferred to Phase 2)
- Explicit pacing/duration slider per segment (currently auto-estimated from word count)
- Background/environment selector UI (currently per-segment composite image selection only)

---

## User Journeys

### UJ1: First-Time Store Owner  -  Discovery to First Scrape

**Persona:** Sarah, Shopify store owner running TikTok ads. Spends $2K/mo on ad creative. Needs 20+ video variations per product launch.

**Goal:** Discover the platform and see immediate value with zero commitment.

**Journey:**

| Step | Action | System Response | Pain Point Addressed |
|---|---|---|---|
| 1 | Lands on homepage from ad/search | Sees hero tagline + URL input field | No signup wall  -  instant engagement |
| 2 | Pastes Shopify store URL | Scraping begins, progress indicator shown | Zero manual data entry |
| 3 | Views scraped products | Product cards with images, names, prices, descriptions displayed. AI brand summary generated (tone, demographic, selling points) | Immediate "wow" moment  -  data already organized |
| 4 | Edits/confirms product data | Inline editing, confirm button | User retains control over accuracy |

**Success:** User sees their products organized with AI-generated brand insights before creating an account. Conversion intent established through demonstrated value.

### UJ2: Authenticated User  -  Persona Creation to Video Generation

**Persona:** Sarah (continued). Has signed up. Wants to create her first AI spokesperson and generate a video ad.

**Goal:** Build a custom AI persona and generate a professional UGC video ad for a specific product.

**Journey:**

| Step | Action | System Response | Pain Point Addressed |
|---|---|---|---|
| 1 | Prompted to sign up / log in | Auth gate with Email, Google OAuth options | Soft gate after value demonstrated |
| 2 | Opens persona creator | Visual character builder with 8 attribute selectors | No design skills needed |
| 3 | Configures persona attributes | Attribute selectors for gender, ethnicity, age, hair color/style, eye color, body type, clothing | WYSIWYG control |
| 4 | Submits persona for generation | 2 AI-generated persona images returned | Fast iteration, multiple options |
| 5 | Selects preferred persona (or regenerates) | Selected image stored as persistent reference | Consistent brand spokesperson |
| 6 | Selects a product from library | Product data and brand tone pre-loaded | No re-entry of product info |
| 7 | Selects composite format (9:16 or 16:9), reviews composite previews | 4 composite images generated (persona + product), user selects preferred | Visual control before generation |
| 8 | Configures generation: mode (Single/Triple), quality (Standard/HD), CTA style | Credit cost displayed. Optional: Advanced Mode for per-segment emotion/action control | Flexible cost vs. volume tradeoff |
| 9 | Hits "Generate Script" | AI writes Hook/Body/CTA script variants. Script review step shows editable segments | User approves before any charges |
| 10 | Reviews/edits script, hits "Approve & Generate" | Credits debited, video pipeline generates segments independently | One-click from approval to video |
| 11 | Views generation progress | Redirect to `/generate/[id]` with polling progress | Real-time feedback |
| 12 | Views stitched video or downloads segments | Auto-stitch combines Hook+Body+CTA into single MP4 (client-side ffmpeg.wasm). Also available: individual segment downloads via signed URLs, batch stitch+zip for all combos | Ready for ad platform upload |

**Success:** User goes from persona creation to downloadable stitched video ad with full script review control. Gets up to 27 possible video combinations from a triple-mode generation.

### UJ3: Free User  -  Paywall Conversion

**Persona:** Sarah (continued). Has created persona and selected a product. Hits Generate but has insufficient credits.

**Goal:** Convert from free exploration to paid subscriber or credit pack purchaser.

**Journey:**

| Step | Action | System Response | Pain Point Addressed |
|---|---|---|---|
| 1 | Hits "Generate Script" or "Approve & Generate" with insufficient credits | Paywall dialog appears with aspirational copy and value framing ($150-$500 traditional UGC vs. per-video cost with CineRads) | Triggered after maximum sunk-cost investment |
| 2 | Reviews plan options | Subscriptions displayed first (Starter, Growth, Scale) with feature comparison. Credit packs shown below as alternative. "Most popular" badge on Growth. Per-video cost comparison | Clear value-per-dollar, multiple purchase paths |
| 3 | Selects plan or pack | Stripe checkout | Trusted payment processing |
| 4 | Completes payment | Success modal with confetti, redirect to dashboard or generation | Instant positive reinforcement |
| 5 | First video at 50% off | First generation costs half price | Low-risk first purchase experience |

**Success:** Multiple conversion paths (subscription for recurring value, packs for commitment-free). First-video discount reduces friction. Paywall placement after persona + product investment maximizes conversion.

### UJ4: Returning User  -  Bulk Generation Workflow

**Persona:** Marcus, agency owner managing 5 e-commerce clients. Growth plan subscriber.

**Goal:** Generate video ads for multiple products across multiple brand profiles efficiently.

**Journey:**

| Step | Action | System Response | Pain Point Addressed |
|---|---|---|---|
| 1 | Logs in, views dashboard | Generation history, video library, credit balance displayed | Quick status overview |
| 2 | Resumes a draft generation | "Resume" from dashboard hydrates wizard to step 5 with existing script | No lost work on interrupted sessions |
| 3 | Selects product, selects existing persona | Pre-configured  -  no rebuild needed | Persona persistence saves time |
| 4 | Generates video (Triple mode) | Script review -> approval -> 9 segments delivered | Consistent quality across clients |
| 5 | Uses per-segment regeneration for weak segments | Re-generates individual segments (1cr standard / 2cr HD) | Surgical improvement without full re-generation |

**Success:** Marcus generates segments for multiple products efficiently, using draft resume and per-segment regeneration to optimize output quality.

---

## Domain Requirements

**Domain Classification:** E-commerce SaaS with payment processing and web scraping.

### DR1: Payment Processing Compliance
- All payment processing delegated to PCI DSS Level 1 compliant processor (Stripe)
- No credit card data stored, transmitted, or processed by application servers
- Subscription management handled entirely via Stripe Billing API
- Coupon system uses allowlisted Stripe coupon IDs only

### DR2: Data Privacy  -  Scraping
- Scraped product data (names, images, descriptions, prices) stored only for authenticated users who confirm the import
- Unconfirmed scrape data purged within 24 hours
- Scraping respects robots.txt directives
- Users must confirm they have rights to scraped store data (ToS agreement)
- GDPR compliance: full account deletion implemented (delete-account Edge Function)
- CCPA compliance: California users can opt out of data sale (no data is sold)
- SSRF protection: URL validation on scraping inputs

### DR3: AI-Generated Content Regulations
- Terms of Service: users accept full responsibility for AI-generated content usage
- No real-person likeness replication  -  persona builder creates synthetic faces only
- Watermark on free-tier outputs (deferred  -  not yet implemented)
- Generated content metadata includes AI-generation disclosure tag

### DR4: Data Encryption
- All user data encrypted at rest (AES-256 via Supabase/PostgreSQL)
- All data in transit encrypted (TLS 1.3)
- API keys and secrets stored in environment variables, never in source code
- Uploaded product images and generated assets stored in access-controlled Supabase Storage with signed URLs
- HMAC-SHA256 signature verification on auth email webhook

---

## Innovation Analysis

### Competitive Landscape

| Competitor | Approach | Limitation AI UGC Generator Addresses |
|---|---|---|
| Real UGC creators (Billo, Insense) | Human creators film custom videos | $150-$500/video, days turnaround, inconsistent quality |
| Arcads | AI avatar video generation | No store scraping, no persistent persona builder, limited customization |
| Creatify | AI ad generation from URLs | Generates ad creatives, not UGC-style persona videos. No character builder |
| Synthesia | AI spokesperson videos | Corporate talking-head style, not UGC aesthetic. No e-commerce integration |
| Generic AI video (Runway, Pika) | General-purpose AI video | No UGC optimization, no script structure, no e-commerce workflow |

### Key Differentiators
1. **Zero-input product import**  -  paste URL, get structured product data + AI brand summary
2. **Persistent AI persona**  -  build once, generate consistently across all products
3. **UGC-optimized output**  -  Hook/Body/CTA structure designed for paid social conversion
4. **Two-phase generation with script review**  -  users approve AI scripts before any charge, with full editing capability
5. **Segmented generation**  -  avoids lip-sync degradation that plagues longer AI videos
6. **Advanced Mode**  -  per-segment emotion/action control with inline emotion tags for fine-grained creative direction
7. **Flexible monetization**  -  subscriptions for committed users, credit packs for try-before-you-commit, first-video discount for conversion

---

## Project-Type Requirements

**Project Type:** SaaS Web Application (B2B/B2C hybrid)

### PT1: Multi-Tenancy
- Each user account isolated with own products, personas, and generated videos
- Persona slots scale by tier: Free=1, Starter=1, Growth=3, Scale=10
- Admin users have unlimited credits and full user management capabilities

### PT2: Subscription Lifecycle
- Free exploration (scraping + persona creation) without payment
- Paywall at generation step when credits insufficient
- Plan upgrade/downgrade via self-service Stripe billing portal
- Credit balance tracking with ledger audit trail
- One-time credit pack purchases as alternative to subscription
- Cancellation with credits cleared and profile downgraded to free
- First-video 50% discount for new users (tracked via `first_video_discount_used`)

### PT3: Browser Compatibility
- Chrome, Firefox, Safari, Edge  -  latest 2 major versions
- Responsive design: desktop-first, functional on tablet
- Mobile: view-only for dashboard and video library (generation is desktop-optimized)

### PT4: Async Job Processing
- Video generation runs asynchronously (up to 10 minutes per generation)
- Real-time progress indicator via polling (`video-status/` endpoint)
- Transactional email notifications implemented via Resend (signup, recovery, magic link, email change)
- Generation completion email notification (deferred)
- Failed jobs: credits refunded automatically. First-video discount restored on failure
- Atomic concurrency protection: `locking` status prevents double-approval race conditions

---

## Functional Requirements

### Product Import & Scraping

| ID | Requirement | Status | Traces To |
|---|---|---|---|
| FR1 | Users can submit a store URL to initiate automatic product data scraping | Implemented | UJ1.2 |
| FR2 | Scraper extracts product name, images (primary + variants), description, price, and category/tags per product | Implemented | UJ1.3 |
| FR3 | System generates an AI-powered brand summary (tone of voice, target demographic, key selling points) from scraped product data via OpenRouter | Implemented | UJ1.3 |
| FR4 | Users can review, inline-edit, and confirm imported product data before proceeding | Implemented | UJ1.4 |
| FR5 | Users can manually upload product images, name, and description when scraping fails or no website exists (`upload-product/` with multipart/form-data) | Implemented | UJ1 (fallback) |
| FR6 | Scraping supports Shopify stores as primary target (Shopify API), with generic HTML fallback (JSON-LD, then OG tags) | Implemented | UJ1.2 |

### Authentication & User Management

| ID | Requirement | Status | Traces To |
|---|---|---|---|
| FR7 | Users can create an account using email + password | Implemented | UJ2.1 |
| FR8 | Users can authenticate via Google OAuth | Implemented | UJ2.1 |
| FR9 | Authentication gate appears after product scraping. Scraping works unauthenticated (affects rate limits); save requires auth | Implemented (partial) | UJ1->UJ2 transition |
| FR10 | Users can view and manage their account settings, subscription, and billing via Stripe portal | Implemented | UJ4.1 |

### Persona Creation

| ID | Requirement | Status | Traces To |
|---|---|---|---|
| FR11 | Users can build an AI persona using a visual character builder with 8 configurable attributes: gender, ethnicity/skin_tone, age range, hair color, hair style, eye color, body type, clothing style (plus accessories) | Implemented | UJ2.2, UJ2.3 |
| FR12 | Each attribute provides predefined options selectable via visual controls (option grids, selectors) | Implemented | UJ2.3 |
| FR13 | System generates 2 AI persona images from configured attributes via Gemini/NanoBanana | Implemented (changed from 4 to 2) | UJ2.4 |
| FR14 | Users can select their preferred persona image from the generated options | Implemented | UJ2.4 |
| FR15 | Selected persona image persists as reference for all future video generations (stored as `selected_image_url`) | Implemented | UJ2.5, UJ4.3 |
| FR16 | Users can regenerate persona images by adjusting attributes and resubmitting. Free tier capped at 4 regenerations | Implemented | UJ2.4 (iteration) |
| FR17 | Persona slots limited by subscription tier: Free=1, Starter=1, Growth=3, Scale=10 | Implemented | PT1, Scope |

### Video Generation  -  Single & Triple Mode

| ID | Requirement | Status | Traces To |
|---|---|---|---|
| FR18 | Users can select a product from their library and choose Single mode (1 variant per segment type = 3 segments) or Triple mode (3 variants per type = 9 segments) | Implemented | UJ2.6, UJ2.7 |
| FR19 | System generates AI-written script variants per segment type tuned to the product's scraped description and brand tone. Credit cost varies: Standard single=5cr, Standard triple=15cr, HD single=10cr, HD triple=30cr. Script generated in two-phase flow: script phase (free) then approval (credits debited) | Implemented | UJ2.7 |
| FR20 | System generates composite POV-style images of the persona holding/using the selected product. 4 previews generated per request; user selects preferred. Editing via natural language prompts supported | Implemented | UJ2.7 |
| FR21 | System generates video segments independently (Hook, Body, CTA) via Kling v2.6 (Standard) or Kling v3 (HD) to maintain lip-sync quality (each segment < 10 seconds) | Implemented | UJ2.7 |
| FR22 | Body segments are bounded at 10 seconds maximum. The script generation LLM enforces 5-9s body duration. Kling duration clamped to 5 or 10 | Implemented | UJ2.7 |
| FR23 | FFmpeg stitching of segment combinations | **Client-side implemented** via ffmpeg.wasm (`use-video-stitcher.ts`). Trims leading/trailing silence via silencedetect, re-encodes to frame-accurate cuts, concatenates Hook+Body+CTA into single MP4 blob URL. Auto-stitch triggers automatically when all segments complete. Batch stitch+zip export via `use-batch-stitcher.ts` + fflate. Server-side stitching remains deferred (requires external worker, not possible in Deno Edge Functions) | UJ2.7 |
| FR24 | Each Triple mode generation produces 3 variants per segment type (3 hooks + 3 bodies + 3 CTAs = 9 segments). Single mode produces 1 variant per type (3 segments) | Implemented | UJ2.8 |
| FR25 | Users can review generated segments by type (hooks, bodies, CTAs). Preview player exists on `/generate/[id]`. Combination builder UI deferred | Implemented (partial) | UJ2.8 |
| FR26 | Users can download individual generated video segments as MP4 files via signed URL. Bulk zip download deferred | Implemented | UJ2.9 |

### Video Generation  -  Advanced Mode (Script Editing & Per-Segment Control)

| ID | Requirement | Status | Traces To |
|---|---|---|---|
| FR27 | Users can edit or rewrite individual script segments (Hook, Body, CTA) before generation via script review step (wizard step 5) and `override_script` on approval | Implemented | UJ2.9 |
| FR28 | Users can mix AI-generated and custom-written segments by editing individual segments in step 5 before approving | Implemented | UJ2.9 |
| FR29 | Duration auto-estimated from word count at ~2.5 words/sec. No explicit user-facing duration slider | Implemented (partial) | UJ2.9 |
| FR30 | Advanced Mode supports per-segment custom composite images (`image_path`) and action descriptions. No background environment selector UI | Implemented (partial) | UJ2.9 |

### Paywall & Billing

| ID | Requirement | Status | Traces To |
|---|---|---|---|
| FR31 | Paywall triggers when user has insufficient credits for the selected generation configuration (not subscription absence  -  pack-only users can generate) | Implemented | UJ3.1 |
| FR32 | Paywall displays plan comparison with all three tiers (Starter, Growth, Scale) plus credit packs, with CRO-optimized layout | Implemented | UJ3.2 |
| FR33 | Users complete subscription or pack purchase via Stripe checkout | Implemented | UJ3.3 |
| FR34 | First-video 50% discount (ceil(cost/2)) for new users. No free trial credits. Discount tracked via `profiles.first_video_discount_used`. Restored on generation failure | Implemented (changed from 9 free credits) | UJ3 |
| FR35 | Credit balance tracking via `credit_balances` table + `credit-balance/` endpoint. Balance displayed in dashboard. Ledger tracks all credit movements | Implemented | UJ4.1 |
| FR36 | Overage billing | **Not implemented**. Users must purchase credit packs or upgrade plan when credits exhausted | PT2 |

### Dashboard & Video Library

| ID | Requirement | Status | Traces To |
|---|---|---|---|
| FR37 | Users can view generation history with timestamps, product names via `generation-history/` endpoint + `/history` page + dashboard recent generations | Implemented | UJ4.1 |
| FR38 | Users can re-download previously generated videos from `/generate/[id]` view with fresh signed URLs | Implemented | UJ4.1 |

### New Functional Requirements (Implemented Beyond Original PRD)

| ID | Requirement | Status | Traces To |
|---|---|---|---|
| FR39 | Two-phase script review/approval flow: phase "script" creates generation with `awaiting_approval` status and returns script + cost preview. Approval with `generation_id` debits credits and submits Kling jobs. Atomic `locking` status prevents double-approval | Implemented | UJ2.9, UJ2.10 |
| FR40 | Advanced Mode panel: per-segment emotion selector (happy, excited, surprised, serious, neutral), intensity control (1-3), action descriptions, inline emotion tags `[e:emotion:intensity]`, per-segment custom composite images | Implemented | UJ2.8 |
| FR41 | Per-segment regeneration: re-generate a single segment of a completed generation. Dynamic credit cost: 1 credit for Standard quality, 2 credits for HD quality (resolved from `generations.video_quality`). Resubmits to Kling with same composite and script. Failed regeneration refunds the debited credits. Insufficient credits returns HTTP 402 with `INSUFFICIENT_CREDITS` error code | Implemented | UJ4.5 |
| FR42 | Composite image editing: edit existing composite via natural language prompt (`edit-composite-image/` Edge Function using NanoBanana `editCompositeFromReference`) | Implemented | UJ2.7 |
| FR43 | One-time credit packs: Starter Pack (10cr, $12), Creator Pack (30cr, $33), Pro Pack (100cr, $95). Priced higher per credit than subscriptions to incentivize recurring revenue | Implemented | UJ3.2, PT2 |
| FR44 | Admin panel: full user listing, ban/unban, credit adjustments, analytics dashboards (overview, revenue, funnel, usage). Admin users (`profiles.role = 'admin'`) bypass credit checks with unlimited credits. Admin operations use service role key exclusively | Implemented | Operations |
| FR45 | CTA style configuration: 8 options (auto, product_name_drop, link_in_bio, link_in_comments, comment_keyword, check_description, direct_website, discount_code). Feeds into script generation and per-segment script regeneration | Implemented | UJ2.8 |
| FR46 | Format selection: portrait (9:16) or landscape (16:9) for composite image generation | Implemented | UJ2.7 |
| FR47 | Video quality tiers: Standard (Kling v2.6, 5cr single / 15cr triple) and HD (Kling v3, 10cr single / 30cr triple). Stored in `generations.video_quality` and `generations.kling_model` | Implemented | UJ2.8 |
| FR48 | Account deletion: full cleanup via `delete-account/` Edge Function. Cancels Stripe subscription, deletes storage objects across 4 buckets, deletes all DB records, deletes auth user | Implemented | DR2 |
| FR49 | Transactional email via Resend: `send-email/` Supabase Auth Hook intercepts signup (6-digit OTP), recovery, magic link, email change. HMAC-SHA256 signature verification. Branded as CineRads | Implemented | NFR8, PT4 |
| FR50 | Coupon system: allowlisted Stripe coupon IDs (30% off once for new users, 50% off once for Starter). Applied via `stripe-checkout/` Edge Function | Implemented | UJ3 |
| FR51 | Annual Billing Option: users may choose annual vs monthly billing at checkout. Annual pricing configured via Stripe price IDs with discount vs monthly. Billing frequency parameter (`monthly` \| `annual`) passed to `stripe-checkout/` Edge Function | Implemented | UJ3, PT2 |
| FR52 | Single-Video Paywall Purchase: when credits are insufficient mid-generation, user may purchase exactly one video (5 credits standard at $5, or 10 credits HD at $10) without committing to a plan or pack. Purchase routed via `single_standard` / `single_hd` Stripe price IDs. "Buy just one video" option shown in paywall modal | Implemented | UJ3.1, FR31 |
| FR53 | Post-Purchase Email Notification: after a credit pack or single-video purchase, system sends a transactional email (via Resend) confirming credits added and linking to the generation wizard | Implemented | PT4, FR49 |
| FR54 | First-Video Discount: first-time buyers are eligible for a 50% discount on their first purchase. Tracked via `profiles.first_video_discount_used` column. Coupon applied via Stripe coupon code. Discount restored on generation failure | Implemented | UJ3, FR34 |
| FR55 | Offer Banner: after account creation or first login, a 30-minute countdown banner shows a 30% subscription discount (Stripe coupon `t9QmsQTe`). Timer persisted in localStorage (`cr_offer_started_at`). Dismissed permanently once user purchases or closes (`cr_offer_used`). Also offers 50% off first single-video via coupon `STARTER50`. Managed by `useFirstPurchaseOffer` hook | Implemented | UJ3, SC3 |
| FR56 | Client-Side Video Stitching: completed segments are stitched client-side via ffmpeg.wasm (non-multithreaded build, no COOP/COEP headers required). Pipeline: fetch segments, detect speech boundaries via silencedetect, trim leading/trailing silence, concatenate Hook+Body+CTA into single MP4. Singleton FFmpeg instance with mutex lock prevents concurrent stitches. Progress bar with 7 status phases (idle, loading_ffmpeg, fetching, detecting, trimming, concat, done, error) | Implemented | FR23, UJ2.12 |
| FR57 | Auto-Stitch on Completion: when all three segments of a combination (hook, body, CTA) finish generating, the system automatically triggers client-side stitching without user action. Debounced via `autoStitchTriggered` ref. User can switch between sequential preview and stitched video view | Implemented | FR56, UJ2.12 |
| FR58 | Batch Stitch & Zip Export: users can stitch multiple segment combinations sequentially and download all stitched videos as a single zip file. Uses `useBatchStitcher` hook with `stitchToBlob()` for each combo, compressed via fflate (level 0). Progress shows current/total combo count. Filename format: `cinerades-{id}-batch-{date}.zip` | Implemented | FR56, UJ4.4 |
| FR59 | Paywall Pre-Check: before script generation (both auto-fire on composite selection and manual "Generate Script"), system checks credit balance client-side. If insufficient, paywall opens immediately without wasting an API call. Paywall tab auto-selects "single" for low-cost generations or "subscription" for higher-cost ones | Implemented | FR31, UJ3.1 |
| FR60 | EdgeError Typed API Errors: all Edge Function calls return structured errors via `EdgeError` class (carries HTTP status code). Backend uses `ErrorCodes` enum (`INSUFFICIENT_CREDITS`, `RATE_LIMITED`, `VIDEO_GENERATION_FAILED`, `CONTENT_POLICY_VIOLATION`, `UNAUTHORIZED`, `INVALID_INPUT`, `INTERNAL_ERROR`) with `errorResponse()` helper. Frontend catches `EdgeError` for status-specific handling (e.g., 401 triggers sign-out + redirect, 402 triggers paywall) | Implemented | NFR-OBS1, NFR7 |
| FR61 | Credit Polling After Purchase: after Stripe checkout redirect, `CheckoutSuccessHandler` polls credit balance every 2s for 15s (pack/single-video) or uses staggered smart-refresh at 3s/8s/15s/30s/60s (subscription) to catch webhook processing delay. Optimistic profile update for plan changes prevents "free" flash. On `/generate` page, shows toast instead of modal to keep user in flow | Implemented | FR35, UJ3.4 |
| FR62 | NanoBananaLoader Progress HUD: branded full-screen progress indicator used during persona generation and composite image generation. Features: dual concentric ring spinner (amber-500), CineRads logo center, step-by-step checklist with checkmarks, progress bar with glow effect, "CineRads / Online" branded footer. Reusable component at `components/ui/nano-loader.tsx` | Implemented | NFR7, UJ2.4 |
| FR63 | Quality Labels in UI: generation wizard displays "Standard" and "HD" quality labels throughout. Standard maps to Kling v2.6, HD maps to Kling v3. Labels shown in quality selector, credit cost display, paywall, and generation review page. Per-segment regeneration error messages include quality-specific cost ("Regenerating an HD segment costs 2 credits") | Implemented | FR47, UJ2.8 |

---

## Non-Functional Requirements

### Performance

| ID | Requirement | Measurement |
|---|---|---|
| NFR1 | Website scraping completes in < 15 seconds for stores with up to 50 products | Server-side timer from URL submit to product data response, measured at p95 |
| NFR2 | Persona image generation returns 2 images in < 30 seconds | Server-side timer from generation request to image delivery, measured at p95 |
| NFR3 | Video segment generation completes in < 3 minutes per segment | Job queue timer per segment, measured at p95 |
| NFR4 | Total video generation (all segments) completes in < 10 minutes | End-to-end job timer from approval to all segments ready, measured at p95 |
| NFR5 | System supports at least 50 concurrent video generation jobs without degradation | Load testing with 50 simultaneous generation requests, all completing within NFR4 targets |

### Reliability

| ID | Requirement | Measurement |
|---|---|---|
| NFR6 | 99.5% uptime for web application (excluding scheduled maintenance windows announced 24h in advance) | Uptime monitoring service (e.g., BetterUptime), measured monthly |
| NFR7 | AI provider outages (image/video generation APIs) handled via retry with exponential backoff (generic retry utility in `_shared/retry.ts`) | Retry metrics: retry count, success-after-retry rate |
| NFR8 | Users receive transactional emails for auth events (signup OTP, recovery, magic link, email change) via Resend | Implemented. Generation completion email deferred |

### Security

| ID | Requirement | Measurement |
|---|---|---|
| NFR9 | All user data encrypted at rest using AES-256 | Database encryption configuration audit, quarterly |
| NFR10 | All data in transit encrypted via TLS 1.3 | SSL Labs scan: A+ rating, quarterly |
| NFR11 | API rate limiting: in-memory rate limiter for unauthenticated scraping. Redis-based rate limiting deferred | Rate limiter metrics: blocked request count |
| NFR12 | Authentication tokens managed by Supabase Auth with standard expiry policies | Token expiry audit via automated test suite |
| NFR13 | No payment card data stored or processed by application  -  all payment handling via Stripe | PCI DSS self-assessment questionnaire (SAQ-A), annually |
| NFR14 | SSRF protection on scraping endpoints via URL validation (`_shared/ssrf.ts`) | Implemented |
| NFR15 | Webhook signature verification: Stripe webhook uses `stripe-signature` header; send-email uses HMAC-SHA256 | Implemented |
| NFR16 | Admin RLS policies removed as security fix (caused data leakage). Admin panel uses service role key exclusively | Implemented |

### Scalability

| ID | Requirement | Measurement |
|---|---|---|
| NFR17 | Video generation pipeline scales via external APIs (Kling, NanoBanana/Gemini) with staggered requests to avoid rate limits | Composite generation uses staggered requests |
| NFR18 | Generated video assets served from Supabase Storage with signed URLs | Signed URL generation on demand |
| NFR19 | Database handles 10,000 registered users with < 100ms query response time for dashboard operations | Database query monitoring at p95, measured weekly |

### Observability

| ID | Requirement | Measurement |
|---|---|---|
| NFR-OBS1 | Error Tracking: all generation failures, webhook errors, and API errors captured via Sentry with full stack traces and user context. Covers frontend SDK + Edge Function `_shared/sentry.ts` `captureException()` | Sentry error dashboard: error count, resolution rate, mean-time-to-detect |
| NFR-OBS2 | Analytics Events: key user actions tracked via DataFast — product imported, preview generated, script generated, video generation started, paywall shown, checkout started, credits purchased. Event functions exported from `frontend/src/lib/datafast.ts` | DataFast event dashboard: event counts, funnel drop-off rates |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI lip-sync quality inconsistent across segments | High | High | Segment videos at < 10s each (FR21-FR22). Per-segment regeneration (FR41). Two quality tiers (FR47) |
| AI image/video provider API downtime or breaking changes | Medium | High | Abstract API layer behind internal interface (`_shared/kling.ts`, `_shared/nanobanana.ts`). Retry with exponential backoff (NFR7) |
| AI provider API rate limits constrain generation volume | Medium | Medium | Staggered requests for composite generation. Kling model fallback tracking. Monitor usage against limits |
| Store scraping blocked by anti-bot measures | Medium | Low | Manual upload fallback (FR5). Shopify API integration (FR6). SSRF protection (NFR14) |
| Low conversion at paywall step | Medium | High | First-video 50% discount (FR34). CRO-optimized paywall (FR32). Credit packs as low-commitment alternative (FR43). Coupon system (FR50). Post-checkout success modal |
| Copyright/likeness legal challenges | Low | High | ToS: user responsible for usage (DR3). No real-person replication. Legal review pending (OQ4) |
| Double-approval race condition on generation | Medium | Medium | Atomic `locking` status transition prevents concurrent approvals (FR39). Credits refunded on any pipeline failure |

---

## Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| OQ1 | Pricing validation: dollar-value credit model ($25/$80/$180) implemented and differs from original segment-based model ($29/$79/$199). COGS analysis should be updated for Kling v2.6 and v3 pricing | Axel | **Resolved** (implemented, monitoring needed) |
| OQ2 | AI image provider (NanoBanana/Gemini) pricing at scale  -  enterprise deal negotiation | Axel | Open |
| OQ3 | AI video provider (Kling v2.6 and v3) API availability and rate limits for commercial use | Axel | Open |
| OQ4 | Legal review: AI-generated likeness, Terms of Service, usage rights | TBD | Open |
| OQ5 | Scraping legality per-region: GDPR, CCPA considerations for automated data collection | TBD | Open |
| OQ6 | Free tier/freemium: first-video discount implemented instead of free-forever plan. Monitor conversion impact vs. free trial credits | Axel | **Resolved** (first-video discount implemented) |
| OQ7 | Multi-language script generation priority for Phase 2 | Axel | Open |
| OQ8 | FFmpeg stitching: evaluate alternatives to Deno Edge Function limitation (external service, client-side, dedicated worker) | Axel | Open |

---

## Appendix A: Feature Map by Tier

| Feature | Free | Starter | Growth | Scale |
|---|---|---|---|---|
| Monthly price | $0 | $25/mo | $80/mo | $180/mo |
| Credits / month | 0 | 30 | 100 | 250 |
| Credit value | - | $30 | $100 | $250 |
| Standard videos (single, 5cr each) | - | 6 | 20 | 50 |
| HD videos (single, 10cr each) | - | 3 | 10 | 25 |
| First-video discount | 50% off | 50% off | 50% off | 50% off |
| Persona slots | 1 | 1 | 3 | 10 |
| Brand profiles | 1 | 1 | 3 | 10 |
| Script review & editing | Yes | Yes | Yes | Yes |
| Advanced Mode (emotion/action control) | Yes | Yes | Yes | Yes |
| CTA style configuration | Yes | Yes | Yes | Yes |
| Format selection (9:16, 16:9) | Yes | Yes | Yes | Yes |
| Per-segment regeneration | Yes | Yes | Yes | Yes |
| Composite image editing | Yes | Yes | Yes | Yes |
| Export resolution | 720p | 720p | 1080p | 1080p |
| Video model | - | Kling v2.6 (std) | Kling v2.6/v3 | Kling v2.6/v3 |

## Appendix B: Credit Cost Matrix

| Mode | Quality | Model | Segments | Credit Cost | With First-Video Discount |
|---|---|---|---|---|---|
| Single | Standard | Kling v2.6 | 3 (1H+1B+1C) | 5 credits | 3 credits |
| Single | HD | Kling v3 | 3 (1H+1B+1C) | 10 credits | 5 credits |
| Triple | Standard | Kling v2.6 | 9 (3H+3B+3C) | 15 credits | 8 credits |
| Triple | HD | Kling v3 | 9 (3H+3B+3C) | 30 credits | 15 credits |
| Per-segment regeneration | Standard | Same as original | 1 | 1 credit | N/A |
| Per-segment regeneration | HD | Same as original | 1 | 2 credits | N/A |

## Appendix C: Credit Pack Pricing

| Pack | Credits | Price | Per Credit | Equivalent Standard Videos |
|---|---|---|---|---|
| Starter Pack | 10 | $12 | $1.20 | 2 standard or 1 HD |
| Creator Pack | 30 | $33 | $1.10 | 6 standard or 3 HD |
| Pro Pack | 100 | $95 | $0.95 | 20 standard or 10 HD |

**Single-Video Purchases (paywall "Try 1 Video" tab):**

| Pack | Credits | Price | Quality |
|---|---|---|---|
| Single Video - Standard | 5 | $5 | Kling v2.6 |
| Single Video - HD | 10 | $10 | Kling v3 |

Note: Subscription credit rate is $0.72-$0.83/credit. Pack rates ($0.95-$1.20/credit) are intentionally higher to incentivize subscriptions. Single-video purchases are at $1.00/credit (no markup, no subscription required).

## Appendix D: Edge Functions Inventory

| Function | Purpose | Auth | Method |
|---|---|---|---|
| `scrape-product/` | Scrape products from URL (Shopify + generic), generate brand summary | Optional | POST |
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

**Total: 20 Edge Functions**

## Appendix E: Generation Status Flow

```
awaiting_approval  -->  locking  -->  submitting_jobs  -->  generating_segments  -->  completed
         |                  |               |                      |
         |                  |               |                      └──> failed (refund)
         |                  |               └──> failed (refund + revert discount)
         |                  └──> failed (if insufficient credits: revert to awaiting_approval)
         └──> failed (if script generation fails)
```

Status values: `pending`, `scripting`, `awaiting_approval`, `locking`, `submitting_jobs`, `generating_segments`, `completed`, `failed`

Per-segment regeneration: `completed --> generating_segments --> completed` (1 credit refunded on failure)
