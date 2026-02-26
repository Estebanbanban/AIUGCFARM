---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics']
inputDocuments: ['_bmad-output/planning-artifacts/ai-ugc-generator-prd.md']
---

# AIUGC - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for AIUGC, decomposing the requirements from the PRD v2.0 (BMAD Standard) into implementable stories. Scope is limited to **MVP (Phase 1)** as defined in PRD Product Scope.

## Requirements Inventory

### Functional Requirements

**Product Import & Scraping**
FR1: Users can submit a store URL to initiate automatic product data scraping
FR2: Scraper extracts product name, images (primary + variants), description, price, and category/tags per product
FR3: System generates an AI-powered brand summary (tone of voice, target demographic, key selling points) from scraped data
FR4: Users can review, inline-edit, and confirm imported product data before proceeding
FR5: Users can manually upload product images, name, and description when scraping fails or no website exists
FR6: Scraping supports Shopify stores as primary target with generic HTML fallback for other platforms

**Authentication & User Management**
FR7: Users can create an account using email + password
FR8: Users can authenticate via Google OAuth
FR9: Authentication gate appears after product scraping (soft gate — value demonstrated first)
FR10: Users can view and manage their account settings, subscription, and billing

**Persona Creation**
FR11: Users can build an AI persona using a visual character builder with 9 configurable attributes (gender, skin tone, age range, hair color, hair style, eye color, body type, clothing style, accessories)
FR12: Each attribute provides predefined options selectable via visual controls (sliders, gradient pickers, option grids)
FR13: System generates 4 AI persona images from configured attributes
FR14: Users can select their preferred persona image from the 4 generated options
FR15: Selected persona image persists as reference for all future video generations
FR16: Users can regenerate persona images by adjusting attributes and resubmitting
FR17: Persona slots limited by subscription tier: Starter = 1, Growth = 3

**Video Generation — Easy Mode**
FR18: Users can select a product from their library and initiate one-click video generation (Easy Mode)
FR19: System generates an AI-written script segmented into Hook (3–10s), Body (10–20s), and CTA (3–5s) tuned to the product's description and brand tone
FR20: System generates a composite POV-style image of the persona holding/using the selected product
FR21: System generates video segments independently (Hook, Body, CTA) to maintain lip-sync quality (each segment < 10s)
FR22: Body segments exceeding 10 seconds are split into 2 sub-segments for generation
FR23: System stitches video segments into a complete output with smooth transitions (crossfade or jump cut)
FR24: Each generation produces 4 complete video variations with slight prompt diversity
FR25: Users can review 4 generated videos side-by-side in a comparison view
FR26: Users can download any or all generated videos as MP4 files

**Paywall & Billing**
FR31: Paywall triggers when user initiates first video generation without an active subscription
FR32: Paywall displays plan comparison with Starter and Growth tiers
FR33: Users complete subscription purchase via Stripe checkout
FR34: 1 free generation (4 video outputs) available before paywall enforces payment
FR35: Credit balance decrements by 1 per generation, displayed in dashboard
FR36: Overage charges apply when credits exhausted: $2/credit (Starter), $1.50 (Growth)

**Dashboard & Video Library**
FR37: Users can view generation history with timestamps, product names, and video thumbnails
FR38: Users can re-download previously generated videos from their library

### NonFunctional Requirements

**Performance**
NFR1: Website scraping completes in < 15 seconds for stores with up to 50 products (p95)
NFR2: Persona image generation returns 4 images in < 30 seconds (p95)
NFR3: Video segment generation completes in < 3 minutes per segment (p95)
NFR4: Total video generation completes in < 10 minutes end-to-end (p95)
NFR5: System supports at least 50 concurrent video generation jobs

**Reliability**
NFR6: 99.5% uptime for web application (excluding announced maintenance)
NFR7: AI provider outages handled via job queuing with automatic retry (3 attempts, exponential backoff)
NFR8: Users receive email notification when video generation completes or fails

**Security**
NFR9: All user data encrypted at rest using AES-256
NFR10: All data in transit encrypted via TLS 1.3
NFR11: API rate limiting: max 10 scrape requests/IP/hour (unauth), 60/hour (auth)
NFR12: Authentication tokens expire after 24h inactivity, refresh tokens after 30 days
NFR13: No payment card data stored — all payment handling via Stripe (PCI DSS SAQ-A)

**Scalability**
NFR14: Video pipeline scales horizontally to handle 10x growth without architecture changes
NFR15: Generated video assets served via CDN with < 200ms TTFB globally
NFR16: Database handles 10,000 users with < 100ms query response (p95)

### Domain Requirements

DR1: Payment processing delegated to PCI DSS Level 1 compliant processor (Stripe). No card data on app servers
DR2: Unconfirmed scrape data purged within 24 hours. Scraping respects robots.txt. Users confirm rights via ToS
DR3: Users accept responsibility for AI-generated content. No real-person likeness. Watermark on free-tier outputs
DR4: AES-256 at rest, TLS 1.3 in transit. API keys in env vars only. Signed URLs for uploaded assets

### Project-Type Requirements

PT1: Multi-tenancy — each account isolated. Brand profiles: Starter = 1, Growth = 3
PT2: Subscription lifecycle — free exploration, paywall at generation, upgrade/downgrade, credit tracking, overage billing, annual discount
PT3: Browser compatibility — Chrome, Firefox, Safari, Edge (latest 2). Desktop-first, tablet functional, mobile view-only
PT4: Async job processing — real-time progress indicator, email notification, priority lanes per tier, auto-retry up to 3x

### Additional Requirements (Architecture Decisions — In Progress)

- Frontend: Next.js 15 + Tailwind v4, deployed on Vercel
- Auth: Clerk (Google + email + Shopify OAuth)
- Database: Supabase (PostgreSQL + RLS + Realtime)
- Job Orchestration: Inngest (step functions for multi-step video pipeline)
- Workers: Hono on Bun, deployed on Railway/Fly.io (for FFmpeg, API calls)
- Scraping: Shopify Storefront API (primary) + Playwright (generic fallback)
- AI Script Writing: OpenRouter (multi-model selection)
- AI Image Generation: NanoBanana API
- AI Video Generation: Kling 3.0 API
- Video Stitching: FFmpeg (server-side on workers)
- Payments: Stripe Billing (subscriptions + metered overage)
- Storage: Cloudflare R2 + CDN (zero egress fees for video delivery)

### FR Coverage Map

FR1 → Epic 1 (Store URL submission and scraping initiation)
FR2 → Epic 1 (Product data extraction)
FR3 → Epic 1 (AI brand summary generation)
FR4 → Epic 1 (Product data review and editing)
FR5 → Epic 1 (Manual upload fallback)
FR6 → Epic 1 (Shopify-first + generic fallback)
FR7 → Epic 2 (Email + password auth)
FR8 → Epic 2 (Google OAuth)
FR9 → Epic 2 (Soft auth gate after scraping)
FR10 → Epic 2 (Account settings and subscription management)
FR11 → Epic 3 (Visual character builder with 9 attributes)
FR12 → Epic 3 (Visual controls — sliders, pickers, grids)
FR13 → Epic 3 (4 persona image generation via NanoBanana)
FR14 → Epic 3 (Persona selection from 4 options)
FR15 → Epic 3 (Persistent persona reference)
FR16 → Epic 3 (Persona regeneration)
FR17 → Epic 3 (Persona slot limits per tier)
FR18 → Epic 5 (Product selection + Easy Mode initiation)
FR19 → Epic 5 (AI script generation — Hook/Body/CTA via OpenRouter)
FR20 → Epic 5 (POV composite image generation via NanoBanana)
FR21 → Epic 6 (Segmented video generation via Kling 3.0)
FR22 → Epic 6 (Body segment splitting for lip-sync quality)
FR23 → Epic 6 (FFmpeg segment stitching with transitions)
FR24 → Epic 6 (4 video variations with prompt diversity)
FR25 → Epic 6 (Side-by-side video comparison view)
FR26 → Epic 6 (MP4 download)
FR31 → Epic 4 (Paywall trigger at generation)
FR32 → Epic 4 (Plan comparison — Starter + Growth)
FR33 → Epic 4 (Stripe checkout)
FR34 → Epic 4 (Free trial — 1 generation)
FR35 → Epic 4 (Credit balance tracking + dashboard display)
FR36 → Epic 4 (Overage billing)
FR37 → Epic 7 (Generation history view)
FR38 → Epic 7 (Video library re-download)

## Epic List

### Epic 1: Product Discovery — Landing Page, Scraping & Import
Users can land on the platform, paste their store URL, and see their products auto-imported with an AI-generated brand summary — or manually upload products. The landing page serves as both marketing site and product entry point.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6
**NFRs addressed:** NFR1, NFR11
**Domain:** DR2 (scraping privacy, robots.txt, 24h purge)
**Note:** Landing page frontend (marketing content, URL input UI) can be parallelized with scraping backend — zero dependency between the two workstreams.

### Epic 2: User Authentication & Account Management
Users can create accounts via email or Google OAuth, log in, and manage their account settings. Auth gate appears after scraping to maximize conversion intent.
**FRs covered:** FR7, FR8, FR9, FR10
**NFRs addressed:** NFR12 (token expiry), NFR9 (encryption at rest), NFR10 (TLS 1.3)
**Domain:** DR4 (encryption standards)
**Project-type:** PT1 (multi-tenancy isolation), PT3 (browser compat)

### Epic 3: AI Persona Creation
Users build a custom AI spokesperson using the Sims-like visual character builder, generate 4 persona image options, select their preferred persona, and persist it for future video generations.
**FRs covered:** FR11, FR12, FR13, FR14, FR15, FR16, FR17
**NFRs addressed:** NFR2
**Depends on:** Epic 2 (auth required)
**Parallel with:** Epic 4 (Billing) — no dependency between persona and billing

### Epic 4: Paywall & Subscription Billing
Users can subscribe to Starter or Growth plans via Stripe checkout, receive a free trial generation, track credit balance in their dashboard, and handle overage charges. Credit management integrates with Inngest pipeline for generation gating.
**FRs covered:** FR31, FR32, FR33, FR34, FR35, FR36
**NFRs addressed:** NFR13 (PCI DSS via Stripe)
**Domain:** DR1 (PCI compliance, no card data on app servers)
**Project-type:** PT2 (subscription lifecycle)
**Depends on:** Epic 2 (auth required)
**Parallel with:** Epic 3 (Persona) — build simultaneously, both need auth, neither needs each other
**Priority note:** Must ship before Epic 6 (video pipeline) goes to production — billing gates generation.

### Epic 5: AI Script & POV Image Generation
Users select a product and persona, and the system generates an AI-written Hook/Body/CTA script (via OpenRouter) and a composite POV-style image of the persona holding/using the product (via NanoBanana). This is the content preparation stage before video generation.
**FRs covered:** FR18, FR19, FR20
**NFRs addressed:** NFR7 (retry on AI provider failure)
**Depends on:** Epic 1 (products), Epic 2 (auth), Epic 3 (persona)
**Independently testable:** Script quality and POV image compositing can be validated without the video pipeline. Faster feedback loops on prompt engineering.

### Epic 6: Video Generation, Assembly & Delivery
The system takes the script and POV image, generates video segments independently via Kling 3.0, stitches them via FFmpeg, and delivers 4 complete video variations. Users review videos side-by-side and download as MP4.
**FRs covered:** FR21, FR22, FR23, FR24, FR25, FR26
**NFRs addressed:** NFR3, NFR4, NFR5, NFR7, NFR8, NFR14, NFR15
**Project-type:** PT4 (async jobs, progress indicator, email notification, priority lanes, auto-retry)
**Depends on:** Epic 4 (billing gates production use), Epic 5 (script + POV image as input)

### Epic 7: User Dashboard & Video Library
Returning users can view their generation history with timestamps and thumbnails, browse their video library, and re-download previously generated videos.
**FRs covered:** FR37, FR38
**NFRs addressed:** NFR16 (database performance)
**Depends on:** Epic 2 (auth), Epic 6 (generated content to display)
