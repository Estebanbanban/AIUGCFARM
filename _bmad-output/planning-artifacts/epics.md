---
stepsCompleted: ['step-01-validate-prerequisites']
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

{{requirements_coverage_map}}

## Epic List

{{epics_list}}
