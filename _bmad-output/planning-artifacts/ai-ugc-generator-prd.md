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
lastEdited: '2026-02-26'
editHistory:
  - date: '2026-02-26'
    changes: 'Full restructure from legacy format to BMAD standard. Extracted 38 FRs from narrative. Created SMART success criteria. Converted UI flow to user journeys. Added domain requirements, innovation analysis, project-type requirements. Removed tech stack and epic breakdown sections (relocated to Architecture and Epics docs). Tightened all NFRs with measurement methods.'
---

# Product Requirements Document  -  AI UGC Generator

**Author:** Axel Ronsin
**Date:** February 2026
**Version:** 2.0  -  BMAD Standard

---

## Executive Summary

**Vision:** AI UGC Generator eliminates the cost, speed, and consistency bottleneck of UGC-style video ad production for e-commerce brands.

**Product:** A micro-SaaS platform where users paste their store URL, auto-import product data, build a custom AI persona via a Sims-like character creator, and generate short-form UGC video ads (Hook / Body / CTA structure) in minutes  -  not days.

**Differentiator:** Unlike generic AI video tools, AI UGC Generator combines three capabilities no competitor unifies: automated store-data scraping (zero manual input), persistent AI persona creation (consistent brand spokesperson across all videos), and UGC-optimized segmented video generation (Hook/Body/CTA structure tuned for paid social).

**Target Users:**
- Shopify/WooCommerce store owners running paid social ads
- DTC brands scaling ad creative volume
- E-commerce agencies managing multiple client accounts
- Dropshippers needing fast, cheap video ads for product testing

**Business Model:** Credit-based SaaS subscription. 1 credit = 1 video segment. Users generate hook, body, and CTA segments independently and combine them for exponential video variations (e.g., 3 hooks × 3 bodies × 3 CTAs = 27 unique videos from 9 credits). Two MVP tiers: Starter ($29/mo, 27 segment credits) and Growth ($79/mo, 90 segment credits). Paywall triggers after persona creation to maximize sunk-cost conversion.

**Problem:** UGC creators cost $150–$500+ per video, take days-to-weeks, and deliver inconsistent quality. Brands needing 10–50+ variations per product face a production bottleneck that directly limits ad spend scaling.

---

## Success Criteria

All criteria measured from public launch date. Baselines are zero (greenfield product).

| ID | Criterion | Target (Month 3) | Target (Month 6) | Measurement Method |
|---|---|---|---|---|
| SC1 | Landing page visitors who initiate a store scrape | 40% | 50% | Analytics: URL submit events / unique landing page sessions |
| SC2 | Users who scrape → complete signup | 25% | 35% | Analytics: signup completion events / scrape initiation events |
| SC3 | Signed-up users who convert to paid plan | 8% | 12% | Stripe: paying customers / total registered accounts |
| SC4 | Monthly Recurring Revenue | $5,000 | $25,000 | Stripe MRR dashboard |
| SC5 | Monthly churn rate | < 15% | < 10% | Stripe: churned subscriptions / active subscriptions at period start |
| SC6 | Average video generations per active user per month | 8 | 15 | Database: total generations / active users in period |
| SC7 | Net Promoter Score | 30+ | 45+ | In-app NPS survey triggered after 5th generation |

**Traceability:** SC1-SC2 validate the value-first funnel (UJ1). SC3-SC5 validate monetization (UJ3). SC6 validates core product utility (UJ2). SC7 validates overall satisfaction.

---

## Product Scope

### Phase 1: MVP (v1.0)

Core value loop: Scrape → Persona → Generate → Download.

- Landing page with URL input CTA and marketing content
- Website scraping: Shopify stores (primary), generic HTML fallback, manual upload fallback
- Authentication: Email + password, Google OAuth
- AI-powered brand summary generation from scraped data
- Persona creation: visual character builder with 9 configurable attributes (gender, skin tone, age, hair color, hair style, eye color, body type, clothing style, accessories)
- AI persona image generation: 4 variants per request, user selects preferred
- Easy Mode video generation: AI writes Hook/Body/CTA script from product data and brand tone
- Segmented video pipeline: generates Hook, Body, CTA segments independently via Kling V2.6 (std, 720p)
- 3 variants per segment type per generation (9 total segments) with prompt diversity
- Modular video assembly: users combine any hook + body + CTA into custom videos (N×N×N combinations)
- On-demand FFmpeg stitching of segment combinations at no additional credit cost
- Segment review by type + combination builder + assembled video preview and MP4 download
- Paywall at generation step with Stripe checkout
- Starter ($29/mo, 27 segment credits) and Growth ($79/mo, 90 segment credits) tiers
- User dashboard with generation history and video library

### Phase 2: Growth (v1.1–v1.3)

Power user features and expanded reach.

- Expert Mode: custom script editing per segment (Hook/Body/CTA), pacing control, background selection
- Scale tier ($199/mo, 270 segment credits) with priority queue and API access
- Shopify native app integration (OAuth + embedded admin)
- Team/agency features: multi-seat accounts, shared personas, brand profiles
- Video analytics: view counts, click-through tracking per video

### Phase 3: Vision (v2.0+)

Platform expansion and ecosystem.

- Direct publishing to TikTok, Meta, YouTube Shorts
- A/B testing framework: auto-generate variations, track performance, suggest winners
- Multi-language script generation (10+ languages)
- Marketplace: community-created persona templates
- White-label offering for agencies

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
| 2 | Opens persona creator | Visual character builder with 9 attribute sliders/selectors | No design skills needed |
| 3 | Configures persona attributes | Real-time preview updates as attributes change | WYSIWYG control |
| 4 | Submits persona for generation | 4 AI-generated persona images returned in < 30s | Fast iteration, multiple options |
| 5 | Selects preferred persona (or regenerates) | Selected image stored as persistent reference | Consistent brand spokesperson |
| 6 | Selects a product from library | Product data and brand tone pre-loaded | No re-entry of product info |
| 7 | Chooses Easy Mode, hits Generate | AI writes multiple Hook/Body/CTA script variants. Video pipeline generates segments independently | One-click from product to modular video segments |
| 8 | Reviews generated segments, combines favorites | Segment picker by type (hooks, bodies, CTAs) + combination builder. Assembled videos preview in player | Mix-and-match segments for exponential combinations |
| 9 | Downloads assembled video(s) as MP4 | Direct download, no watermark on paid plans | Ready for ad platform upload |

**Success:** User goes from persona creation to downloadable video ad in under 15 minutes. Gets 27 possible video combinations from a single batch generation.

### UJ3: Free User  -  Paywall Conversion

**Persona:** Sarah (continued). Has created persona and selected a product. Hits Generate for the first time.

**Goal:** Convert from free exploration to paid subscriber.

**Journey:**

| Step | Action | System Response | Pain Point Addressed |
|---|---|---|---|
| 1 | Hits "Generate Video" | Paywall modal appears: "Choose a plan to generate your first AI UGC video" | Triggered after maximum sunk-cost investment |
| 2 | Reviews plan options | Starter and Growth tiers with feature comparison | Clear value-per-dollar |
| 3 | Selects plan | Stripe checkout overlay | Trusted payment processing |
| 4 | Completes payment | Immediate redirect to generation in progress | No delay between payment and value delivery |
| 5 | Receives video segments | Segments ready for combination, preview, and download | Instant ROI justification |

**Success:** Free trial (9 segment credits = 1 full batch of 3 hooks + 3 bodies + 3 CTAs = 27 possible combinations) available for users who need proof before committing. Paywall placement maximizes conversion by triggering after persona investment.

### UJ4: Returning User  -  Bulk Generation Workflow

**Persona:** Marcus, agency owner managing 5 e-commerce clients. Growth plan subscriber.

**Goal:** Generate video ads for multiple products across multiple brand profiles efficiently.

**Journey:**

| Step | Action | System Response | Pain Point Addressed |
|---|---|---|---|
| 1 | Logs in, views dashboard | Generation history, video library, credit balance displayed | Quick status overview |
| 2 | Switches to client brand profile | Products and personas for that brand loaded | Multi-brand management |
| 3 | Selects product, selects existing persona | Pre-configured  -  no rebuild needed | Persona persistence saves time |
| 4 | Generates video (Easy Mode) | 4 variations delivered | Consistent quality across clients |
| 5 | Repeats for 3 more products | Batch workflow  -  select product, generate segments, combine, download | Volume production in minutes |

**Success:** Marcus generates segments for 4 products and assembles 100+ unique video combinations in under 40 minutes.

---

## Domain Requirements

**Domain Classification:** E-commerce SaaS with payment processing and web scraping.

### DR1: Payment Processing Compliance
- All payment processing delegated to PCI DSS Level 1 compliant processor (Stripe)
- No credit card data stored, transmitted, or processed by application servers
- Subscription management handled entirely via Stripe Billing API

### DR2: Data Privacy  -  Scraping
- Scraped product data (names, images, descriptions, prices) stored only for authenticated users who confirm the import
- Unconfirmed scrape data purged within 24 hours
- Scraping respects robots.txt directives
- Users must confirm they have rights to scraped store data (ToS agreement)
- GDPR compliance: EU users can request full data deletion within 30 days
- CCPA compliance: California users can opt out of data sale (no data is sold)

### DR3: AI-Generated Content Regulations
- Terms of Service: users accept full responsibility for AI-generated content usage
- No real-person likeness replication  -  persona builder creates synthetic faces only
- Watermark applied on free-tier outputs
- Generated content metadata includes AI-generation disclosure tag

### DR4: Data Encryption
- All user data encrypted at rest (AES-256)
- All data in transit encrypted (TLS 1.3)
- API keys and secrets stored in environment variables, never in source code
- Uploaded product images stored in access-controlled cloud storage with signed URLs

---

## Innovation Analysis

### Competitive Landscape

| Competitor | Approach | Limitation AI UGC Generator Addresses |
|---|---|---|
| Real UGC creators (Billo, Insense) | Human creators film custom videos | $150–$500/video, days turnaround, inconsistent quality |
| Arcads | AI avatar video generation | No store scraping, no persistent persona builder, limited customization |
| Creatify | AI ad generation from URLs | Generates ad creatives, not UGC-style persona videos. No character builder |
| Synthesia | AI spokesperson videos | Corporate talking-head style, not UGC aesthetic. No e-commerce integration |
| Generic AI video (Runway, Pika) | General-purpose AI video | No UGC optimization, no script structure, no e-commerce workflow |

### Key Differentiators
1. **Zero-input product import**  -  paste URL, get structured product data + AI brand summary
2. **Persistent AI persona**  -  build once, generate consistently across all products
3. **UGC-optimized output**  -  Hook/Body/CTA structure designed for paid social conversion
4. **Segmented generation**  -  avoids lip-sync degradation that plagues longer AI videos
5. **Modular segment combinations**  -  3 variants per segment type (hook/body/CTA) yield 27 unique video combinations per batch, giving advertisers exponential creative variety from minimal generation cost

---

## Project-Type Requirements

**Project Type:** SaaS Web Application (B2B/B2C hybrid)

### PT1: Multi-Tenancy
- Each user account isolated with own products, personas, and generated videos
- Brand profiles enable multiple stores per account (Growth: 3, Scale: unlimited)
- Team seats share brand profile access with role-based permissions (Scale: 5 seats)

### PT2: Subscription Lifecycle
- Free exploration (scraping + persona creation) without payment
- Paywall at generation step
- Plan upgrade/downgrade via self-service billing portal
- Credit balance tracking with overage billing
- Annual billing option with 20% discount
- Cancellation with access through end of billing period

### PT3: Browser Compatibility
- Chrome, Firefox, Safari, Edge  -  latest 2 major versions
- Responsive design: desktop-first, functional on tablet
- Mobile: view-only for dashboard and video library (generation is desktop-optimized)

### PT4: Async Job Processing
- Video generation runs asynchronously (up to 10 minutes per generation)
- Real-time progress indicator via WebSocket or polling
- Email notification on generation completion
- Job queue with priority lanes per subscription tier (Scale = high priority)
- Failed jobs auto-retry up to 3 times before notifying user

---

## Functional Requirements

### Product Import & Scraping

| ID | Requirement | Traces To |
|---|---|---|
| FR1 | Users can submit a store URL to initiate automatic product data scraping | UJ1.2 |
| FR2 | Scraper extracts product name, images (primary + variants), description, price, and category/tags per product | UJ1.3 |
| FR3 | System generates an AI-powered brand summary (tone of voice, target demographic, key selling points) from scraped product data | UJ1.3 |
| FR4 | Users can review, inline-edit, and confirm imported product data before proceeding | UJ1.4 |
| FR5 | Users can manually upload product images, name, and description when scraping fails or no website exists | UJ1 (fallback) |
| FR6 | Scraping supports Shopify stores as primary target with generic HTML fallback for other platforms | UJ1.2 |

### Authentication & User Management

| ID | Requirement | Traces To |
|---|---|---|
| FR7 | Users can create an account using email + password | UJ2.1 |
| FR8 | Users can authenticate via Google OAuth | UJ2.1 |
| FR9 | Authentication gate appears after product scraping (soft gate  -  value demonstrated first) | UJ1→UJ2 transition |
| FR10 | Users can view and manage their account settings, subscription, and billing | UJ4.1 |

### Persona Creation

| ID | Requirement | Traces To |
|---|---|---|
| FR11 | Users can build an AI persona using a visual character builder with 9 configurable attributes: gender, skin tone, age range, hair color, hair style, eye color, body type, clothing style, accessories | UJ2.2, UJ2.3 |
| FR12 | Each attribute provides predefined options selectable via visual controls (sliders, gradient pickers, option grids) | UJ2.3 |
| FR13 | System generates 4 AI persona images from configured attributes | UJ2.4 |
| FR14 | Users can select their preferred persona image from the 4 generated options | UJ2.4 |
| FR15 | Selected persona image persists as reference for all future video generations | UJ2.5, UJ4.3 |
| FR16 | Users can regenerate persona images by adjusting attributes and resubmitting | UJ2.4 (iteration) |
| FR17 | Persona slots limited by subscription tier: Starter = 1, Growth = 3, Scale = 10 | PT1, Scope |

### Video Generation  -  Easy Mode

| ID | Requirement | Traces To |
|---|---|---|
| FR18 | Users can select a product from their library and initiate one-click video generation (Easy Mode) | UJ2.6, UJ2.7 |
| FR19 | System generates multiple AI-written script variants per segment type: 3 Hook variants (3–5s each), 3 Body variants (5–10s each), and 3 CTA variants (3–5s each), tuned to the product's scraped description and brand tone | UJ2.7 |
| FR20 | System generates a composite POV-style image of the persona holding/using the selected product | UJ2.7 |
| FR21 | System generates video segments independently (Hook, Body, CTA) to maintain lip-sync quality (each segment < 10 seconds) | UJ2.7 |
| FR22 | Body segments are bounded at 10 seconds maximum. The script generation LLM enforces this constraint (5–10s body duration cap)  -  no runtime splitting required. Body sub-segment splitting deferred to Phase 1.5 if needed. | UJ2.7 |
| FR23 | **[Deferred  -  Phase 1.5]** System assembles user-selected segment combinations via on-demand FFmpeg stitching. MVP: individual segments delivered; client-side sequential preview only. FFmpeg not available in Deno Edge Functions. | UJ2.7 |
| FR24 | Each Easy Mode generation produces 3 variants per segment type (3 hooks + 3 bodies + 3 CTAs = 9 segments), each with slight prompt diversity. Combinatorially yields 27 unique video outputs | UJ2.8 |
| FR25 | Users can review generated segments by type (hooks, bodies, CTAs), select favorites, combine them into custom videos, and preview assembled combinations | UJ2.8 |
| FR26 | Users can download individual generated video segments as MP4 files via signed URL. Bulk zip download deferred to Phase 1.5. | UJ2.9 |

### Video Generation  -  Expert Mode (Phase 2)

| ID | Requirement | Traces To |
|---|---|---|
| FR27 | Users can edit or rewrite individual script segments (Hook, Body, CTA) before generation | Scope Phase 2 |
| FR28 | Users can mix AI-generated and custom-written segments (e.g., AI hook + custom body) | Scope Phase 2 |
| FR29 | Users can adjust pacing/duration per segment | Scope Phase 2 |
| FR30 | Users can select background setting/environment for video generation | Scope Phase 2 |

### Paywall & Billing

| ID | Requirement | Traces To |
|---|---|---|
| FR31 | Paywall triggers when user initiates first video generation without an active subscription | UJ3.1 |
| FR32 | Paywall displays plan comparison with Starter and Growth tiers (MVP), Scale tier (Phase 2) | UJ3.2 |
| FR33 | Users complete subscription purchase via Stripe checkout | UJ3.3 |
| FR34 | 9 free segment credits (1 full batch: 3 hooks + 3 bodies + 3 CTAs = 27 possible video combinations) available before paywall enforces payment | UJ3 (free trial) |
| FR35 | Credit balance decrements by 1 per segment generated, displayed in dashboard | UJ4.1 |
| FR36 | Overage charges apply when segment credits exhausted: $1.50/credit (Starter), $1.00/credit (Growth), $0.75/credit (Scale) | PT2 |

### Dashboard & Video Library

| ID | Requirement | Traces To |
|---|---|---|
| FR37 | Users can view generation history with timestamps, product names, and video thumbnails | UJ4.1 |
| FR38 | Users can re-download previously generated videos from their library | UJ4.1 |

---

## Non-Functional Requirements

### Performance

| ID | Requirement | Measurement |
|---|---|---|
| NFR1 | Website scraping completes in < 15 seconds for stores with up to 50 products | Server-side timer from URL submit to product data response, measured at p95 |
| NFR2 | Persona image generation returns 4 images in < 30 seconds | Server-side timer from generation request to image delivery, measured at p95 |
| NFR3 | Video segment generation completes in < 3 minutes per segment | Job queue timer per segment, measured at p95 |
| NFR4 | Total video generation (all segments + stitching) completes in < 10 minutes | End-to-end job timer from generation initiation to 4 outputs ready, measured at p95 |
| NFR5 | System supports at least 50 concurrent video generation jobs without degradation | Load testing with 50 simultaneous generation requests, all completing within NFR4 targets |

### Reliability

| ID | Requirement | Measurement |
|---|---|---|
| NFR6 | 99.5% uptime for web application (excluding scheduled maintenance windows announced 24h in advance) | Uptime monitoring service (e.g., BetterUptime), measured monthly |
| NFR7 | AI provider outages (image/video generation APIs) handled via job queuing with automatic retry (3 attempts, exponential backoff) | Job queue metrics: retry count, success-after-retry rate |
| NFR8 | Users receive email notification when video generation completes or fails | Email delivery tracking: sent within 60 seconds of job completion |

### Security

| ID | Requirement | Measurement |
|---|---|---|
| NFR9 | All user data encrypted at rest using AES-256 | Database encryption configuration audit, quarterly |
| NFR10 | All data in transit encrypted via TLS 1.3 | SSL Labs scan: A+ rating, quarterly |
| NFR11 | API rate limiting: max 10 scrape requests per IP per hour for unauthenticated users, max 60 per hour for authenticated users | Rate limiter metrics: blocked request count, false positive rate |
| NFR12 | Authentication tokens expire after 24 hours of inactivity, refresh tokens after 30 days | Token expiry audit via automated test suite |
| NFR13 | No payment card data stored or processed by application  -  all payment handling via Stripe | PCI DSS self-assessment questionnaire (SAQ-A), annually |

### Scalability

| ID | Requirement | Measurement |
|---|---|---|
| NFR14 | Video generation pipeline scales horizontally to handle 10x load growth without architecture changes | Load test: 500 concurrent jobs complete within 2x NFR4 targets |
| NFR15 | Generated video assets served via CDN with < 200ms first-byte time globally | CDN analytics: TTFB at p95 across major regions (NA, EU, APAC) |
| NFR16 | Database handles 10,000 registered users with < 100ms query response time for dashboard operations | Database query monitoring at p95, measured weekly |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI lip-sync quality inconsistent across segments | High | High | Segment videos at < 10s each (FR21-FR22). Generate 4 variants (FR24). Allow regeneration (FR16) |
| AI image/video provider API downtime or breaking changes | Medium | High | Abstract API layer behind internal interface. Queue + retry on failure (NFR7). Maintain fallback provider evaluation |
| AI provider API rate limits constrain generation volume | Medium | Medium | Job queue with priority lanes (PT4). Negotiate enterprise rates. Monitor usage against limits |
| Store scraping blocked by anti-bot measures | Medium | Low | Manual upload fallback (FR5). Shopify API integration in Phase 2. Respect robots.txt (DR2) |
| Low conversion at paywall step | Medium | High | Free trial: 1 generation (FR34). Maximize investment before gate (UJ3). A/B test pricing in Phase 2 |
| Copyright/likeness legal challenges | Low | High | ToS: user responsible for usage (DR3). No real-person replication. Watermark on free tier. Legal review pending (OQ4) |

---

## Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| OQ1 | Pricing validation: segment-based model ($29/$79/$199) confirmed based on Kling V2.6 COGS analysis (62-80% margin). Monitor competitor pricing for adjustments | Axel | Resolved |
| OQ2 | AI image provider (NanoBanana) pricing at scale  -  enterprise deal negotiation | Axel | Open |
| OQ3 | AI video provider (Kling 3.0) API availability and rate limits for commercial use | Axel | Open |
| OQ4 | Legal review: AI-generated likeness, Terms of Service, usage rights | TBD | Open |
| OQ5 | Scraping legality per-region: GDPR, CCPA considerations for automated data collection | TBD | Open |
| OQ6 | Free tier/freemium: should a limited free-forever plan exist alongside free trial? | Axel | Open |
| OQ7 | Multi-language script generation priority for Phase 2 | Axel | Open |

---

## Appendix: Feature Map by Tier

Retained from original PRD for reference. Tier features are reflected in FRs and Scope above.

| Feature | Starter | Growth | Scale |
|---|---|---|---|
| Monthly price | $29/mo | $79/mo | $199/mo |
| Segment credits / month | 27 | 90 | 270 |
| Full batches (3H+3B+3C) | 3 | 10 | 30 |
| Max video combinations | 81 | 270 | 810 |
| Overage rate (per credit) | $1.50 | $1.00 | $0.75 |
| Persona slots | 1 | 3 | 10 |
| Easy Mode | Yes | Yes | Yes |
| Expert Mode | No | Yes | Yes |
| Custom script editing | No | Yes | Yes |
| Priority generation queue | No | No | Yes |
| API access | No | No | Yes |
| Team seats | 1 | 1 | 5 |
| Brand profiles | 1 | 3 | Unlimited |
| Export resolution | 720p | 720p | 720p |
| Video model | Kling V2.6 std | Kling V2.6 std | Kling V2.6 std |
