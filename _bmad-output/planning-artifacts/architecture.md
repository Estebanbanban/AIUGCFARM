---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments: ['ai-ugc-generator-prd.md']
workflowType: 'architecture'
project_name: 'AIUGC'
user_name: 'Estebanronsin'
date: '2026-02-26'
status: 'complete'
completedAt: '2026-02-26'
---

# Architecture Decision Document

## AI UGC Generator

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
- Landing page with URL input CTA and marketing content
- Website scraping engine (Shopify-first via Storefront API, generic fallback via Playwright)
- Product data import with AI-generated brand summary
- Authentication (email + Google OAuth + Shopify OAuth)
- Sims-like persona creator with configurable attributes
- AI image generation via NanoBanana API (4 persona variants)
- AI script generation via OpenRouter (Hook / Body / CTA structure)
- AI video generation via Kling 3.0 (segmented for lip-sync quality)
- Video assembly via FFmpeg (segment stitching, crossfade/jump cut)
- 4-variant output per generation with side-by-side review
- Stripe billing (subscriptions + metered credits + overage)
- User dashboard with video library and download

**Non-Functional Requirements:**
- Website scraping: < 15s for up to 50 products
- Persona generation: < 30s for 4 images
- Video generation: < 3min per segment, < 10min total
- 50 concurrent generation jobs minimum
- 99.5% uptime SLA
- Graceful degradation on third-party API failure (queue + retry)
- Job status tracking with email notification on completion
- All scraped data encrypted at rest
- Rate limiting on scraping endpoints

### Scale & Complexity

- **Domain:** Media/E-commerce (high complexity — async pipelines, external AI APIs, video processing)
- **Project type:** Full-stack SaaS with heavy backend processing
- **Primary bottleneck:** Video pipeline throughput and third-party API reliability
- **Data volume:** Large binary assets (images, videos), moderate relational data (users, products, personas)

### Technical Constraints & Dependencies

- NanoBanana API — persona image generation (external dependency, rate limits unknown)
- Kling 3.0 API — video generation (external dependency, commercial rate limits TBD)
- OpenRouter — LLM script generation (multi-model, single billing)
- FFmpeg — must run on worker servers (not serverless-friendly without containers)
- Shopify Storefront API — requires app registration for native stores

### Cross-Cutting Concerns

- **Job orchestration:** Every generation involves 4+ async steps across multiple APIs
- **Credit management:** Must decrement credits atomically, handle overage billing
- **File lifecycle:** Generated assets need cleanup policies (storage costs)
- **Error recovery:** Each pipeline step can fail independently — need per-step retry

---

## Starter Template Evaluation

### Primary Technology Domain

Full-stack TypeScript web application with async processing pipeline.

### Selected Starter: `create-next-app` (Next.js 15 App Router)

**Initialization Command:**

```bash
bunx create-next-app@latest aiugc --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

**Rationale:**
- Next.js 15 App Router provides SSR for landing page SEO + client-side interactivity for the dashboard and persona builder
- Tailwind v4 for rapid UI development
- Bun as runtime and package manager (project preference)
- TypeScript throughout

**Architectural Decisions Provided by Starter:**
- Language & Runtime: TypeScript on Bun
- Styling: Tailwind CSS v4
- Build Tooling: Next.js built-in (Turbopack for dev)
- Routing: App Router (file-based)
- Code Organization: `src/` directory with `@/*` import alias

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Database: Supabase (PostgreSQL)
2. Auth: Clerk
3. Job Orchestration: Inngest
4. Worker Runtime: Hono on Bun (Railway)
5. Payment Processing: Stripe Billing
6. Object Storage: Cloudflare R2

**Important Decisions (Shape Architecture):**
1. LLM Provider: OpenRouter (multi-model)
2. Scraping Strategy: Shopify Storefront API + Playwright fallback
3. Video Pipeline: NanoBanana → Kling 3.0 → FFmpeg
4. Frontend State: Zustand for client state, React Query for server state
5. UI Components: shadcn/ui

**Deferred Decisions (Post-MVP):**
1. CDN strategy for video delivery (evaluate Cloudflare Stream vs R2 public buckets)
2. Multi-region deployment
3. WebSocket vs SSE for real-time generation progress
4. API access for Scale tier

---

### Data Architecture

**Database:** Supabase (PostgreSQL)
- Managed PostgreSQL with Row Level Security (RLS)
- Built-in realtime subscriptions for generation status updates
- Supabase Auth as backup/fallback (primary auth is Clerk)
- Direct SQL access + Supabase client SDK

**Data Modeling Approach:**
- Relational model with clear foreign keys
- UUID primary keys across all tables
- `created_at` / `updated_at` timestamps on all tables
- Soft deletes where needed (`deleted_at` nullable timestamp)

**Core Tables:**

| Table | Purpose |
|---|---|
| `users` | Synced from Clerk via webhook, stores subscription state |
| `brands` | Brand profiles created from scraped data |
| `products` | Imported product data per brand |
| `personas` | AI persona configurations + selected reference image URL |
| `generations` | Video generation jobs (status, credits used, metadata) |
| `generation_segments` | Individual segments per generation (hook/body/cta) |
| `videos` | Final assembled video outputs (4 per generation) |
| `subscriptions` | Stripe subscription state, credit balance |
| `credit_transactions` | Credit usage ledger (audit trail) |

**Data Validation:** Zod schemas shared between frontend and backend. Single source of truth for all data shapes.

**Migration Approach:** Supabase migrations via `supabase db push` for dev, `supabase db migrate` for production.

**Caching Strategy:**
- Product data: Cache scraped results in Supabase for 24h (avoid re-scraping)
- Session data: Clerk handles session caching
- No application-level Redis cache at MVP — Supabase connection pooling via Supavisor is sufficient

---

### Authentication & Security

**Authentication: Clerk**
- Handles email + password, Google OAuth, and custom Shopify OAuth
- Pre-built React components (`<SignIn>`, `<SignUp>`, `<UserButton>`)
- Webhook sync to Supabase `users` table on user creation/update
- JWT tokens for API route protection via `@clerk/nextjs` middleware

**Authorization Patterns:**
- Clerk middleware protects all `/dashboard/*` routes
- Supabase RLS policies enforce data isolation per user
- Clerk `userId` mapped to Supabase `users.clerk_id` for RLS context
- Tier-based feature gating checked at API route level (not frontend-only)

**Security Middleware:**
- Next.js middleware (`middleware.ts`) for route protection
- Rate limiting on public endpoints (scraping, generation triggers) via Vercel Edge Middleware or Upstash Rate Limit
- CORS restricted to application domains only
- Input sanitization on all user-provided URLs before scraping

**API Security:**
- All API routes require Clerk session token
- Inngest function signatures verified via webhook signing
- Stripe webhooks verified via `stripe.webhooks.constructEvent()`
- External API keys stored in environment variables, never client-side

---

### API & Communication Patterns

**API Design: Next.js Route Handlers (REST)**
- `/api/scrape` — Trigger website scraping
- `/api/brands` — CRUD brand profiles
- `/api/products` — CRUD products per brand
- `/api/personas` — CRUD persona configurations
- `/api/personas/generate` — Trigger NanoBanana image generation
- `/api/generations` — Trigger video generation, list generations
- `/api/generations/[id]` — Get generation status + video outputs
- `/api/webhooks/clerk` — Clerk user sync
- `/api/webhooks/stripe` — Stripe subscription events
- `/api/webhooks/inngest` — Inngest function endpoint

**API Response Format:**

```typescript
// Success
{ data: T, error: null }

// Error
{ data: null, error: { code: string, message: string } }
```

**Error Handling Standards:**
- HTTP status codes: 200 (success), 400 (validation), 401 (unauthorized), 403 (forbidden), 404 (not found), 429 (rate limited), 500 (server error)
- All errors include machine-readable `code` and human-readable `message`
- Validation errors include `field` property

**Service Communication:**
- Next.js API routes → Inngest: Event-driven (`inngest.send()`)
- Inngest → Worker (Hono): HTTP calls to worker endpoints
- Worker → External APIs: Direct HTTP (NanoBanana, Kling, OpenRouter)
- Worker → Supabase: Direct client for status updates
- Worker → R2: S3-compatible SDK for file uploads

---

### Frontend Architecture

**State Management:**
- **Server state:** TanStack Query (React Query) — handles caching, refetching, optimistic updates for all API data
- **Client state:** Zustand — minimal stores for UI state (persona builder selections, generation form state)
- **URL state:** `nuqs` for search params (filters, pagination)

**Component Architecture:**
- **UI primitives:** shadcn/ui (based on Radix UI) — fully owned, customizable components
- **Feature components:** Co-located by feature domain (`/components/persona-builder/`, `/components/generation/`, etc.)
- **Layout components:** App Router layouts for shared UI (sidebar, header)

**Persona Builder (Sims-like UI):**
- Custom React component with attribute selectors (dropdowns, sliders, color pickers)
- Real-time preview panel showing current attribute selections
- Uses canvas or SVG for visual persona preview (pre-generation)
- Communicates with NanoBanana API through server action for image generation

**Routing Strategy:**
- App Router file-based routing
- Route groups: `(marketing)` for public pages, `(dashboard)` for authenticated app
- Parallel routes for modals (generation progress, video review)

**Performance:**
- Landing page: Static generation (ISR) for SEO
- Dashboard: Client-side with React Query prefetching
- Images: Next.js `<Image>` with Cloudflare R2 loader
- Videos: Native `<video>` with R2 signed URLs

---

### Infrastructure & Deployment

**Architecture Overview:**

```
┌─────────────────────────────┐
│  Vercel                      │
│  ├── Next.js 15 (App Router)│  ← Landing page (SSR/ISR)
│  ├── Dashboard (CSR)         │  ← Authenticated app
│  ├── API Routes              │  ← CRUD operations
│  └── Inngest Endpoint        │  ← /api/webhooks/inngest
└──────────┬──────────────────┘
           │ inngest.send() events
           ▼
┌─────────────────────────────┐
│  Inngest (Cloud)             │
│  ├── scrape-website          │  Step function
│  ├── generate-persona-images │  Step function
│  ├── generate-video          │  Step function (fan-out)
│  │   ├── step: generate-hook-segment
│  │   ├── step: generate-body-segment
│  │   ├── step: generate-cta-segment
│  │   └── step: assemble-video
│  └── send-completion-email   │  Step function
└──────────┬──────────────────┘
           │ Executes on
           ▼
┌─────────────────────────────┐
│  Railway (Worker Service)    │
│  ├── Hono on Bun             │  ← Lightweight HTTP server
│  ├── FFmpeg (system binary)  │  ← Video stitching
│  ├── Playwright (headless)   │  ← Generic site scraping
│  └── External API clients    │
│      ├── NanoBanana SDK      │
│      ├── Kling 3.0 SDK       │
│      └── OpenRouter SDK      │
└──────────┬──────────────────┘
           │
     ┌─────┴──────────┐
     ▼                ▼
┌──────────┐   ┌──────────────┐
│ Supabase │   │ Cloudflare   │
│ Postgres │   │ R2 + CDN     │
│ + Auth   │   │ (videos,     │
│ + Realtime│  │  images)     │
└──────────┘   └──────────────┘
     │
     ▼
┌──────────┐
│ Stripe   │
│ Billing  │
└──────────┘
```

**Hosting:**
- **Frontend + API:** Vercel (Pro plan for team features + 100GB bandwidth)
- **Worker Service:** Railway (Docker container with FFmpeg + Playwright pre-installed)
- **Database:** Supabase (Pro plan for connection pooling + daily backups)
- **Storage:** Cloudflare R2 (free egress, S3-compatible)
- **Job Orchestration:** Inngest Cloud (managed, generous free tier)

**CI/CD Pipeline:**
- GitHub Actions for CI (lint, type-check, unit tests)
- Vercel auto-deploy on push to `main` (frontend + API)
- Railway auto-deploy on push to `main` (worker service)
- Supabase CLI for database migrations in CI

**Environment Configuration:**
- `.env.local` for development
- Vercel environment variables for production (frontend)
- Railway environment variables for production (worker)
- Shared secrets: Supabase URL/key, Stripe keys, Clerk keys, Inngest key, R2 credentials

**Monitoring & Logging:**
- Vercel Analytics for frontend performance
- Inngest Dashboard for pipeline observability (step-level visibility, retries, failures)
- Sentry for error tracking (frontend + worker)
- Supabase Dashboard for database monitoring

**Scaling Strategy (MVP → Growth):**
- Vercel: Scales automatically (serverless)
- Railway: Vertical scaling initially, horizontal with Railway replicas when needed
- Inngest: Handles concurrency limits and queue management
- Supabase: Connection pooler handles 200+ concurrent connections on Pro
- R2: No scaling concerns (object storage)

---

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database Naming Conventions:**
- Tables: `snake_case`, plural (`users`, `generations`, `credit_transactions`)
- Columns: `snake_case` (`created_at`, `user_id`, `brand_name`)
- Foreign keys: `{referenced_table_singular}_id` (`user_id`, `brand_id`, `persona_id`)
- Indexes: `idx_{table}_{columns}` (`idx_users_clerk_id`, `idx_generations_user_id_status`)
- Enums: `snake_case` values (`pending`, `processing`, `completed`, `failed`)

**API Naming Conventions:**
- Endpoints: `/api/{resource}` plural, lowercase (`/api/products`, `/api/generations`)
- Route params: `[id]` (Next.js convention)
- Query params: `camelCase` (`?brandId=xxx&status=pending`)
- Headers: Standard HTTP headers only, no custom `X-` headers at MVP

**Code Naming Conventions:**
- Files: `kebab-case.ts` for utilities, `PascalCase.tsx` for React components
- Functions: `camelCase` (`getProducts`, `triggerGeneration`)
- React components: `PascalCase` (`PersonaBuilder`, `VideoReviewGrid`)
- Types/Interfaces: `PascalCase` with no prefix (`User`, `Generation`, not `IUser`)
- Constants: `UPPER_SNAKE_CASE` (`MAX_SEGMENTS`, `DEFAULT_HOOK_DURATION`)
- Zod schemas: `camelCase` + `Schema` suffix (`createGenerationSchema`, `updatePersonaSchema`)
- Inngest functions: `kebab-case` event names (`app/generation.requested`, `app/scrape.completed`)

### Structure Patterns

**Project Organization:**
- Feature-first organization inside `src/` for the Next.js app
- Co-located tests: `*.test.ts` next to source files
- Shared utilities in `src/lib/`
- Zod schemas in `src/schemas/` (shared between frontend and API routes)

**File Structure Patterns:**
- One component per file
- Index files (`index.ts`) only for barrel exports of feature modules
- Environment variables accessed only through `src/lib/env.ts` (validated with Zod at startup)

### Format Patterns

**API Response Formats:**

```typescript
// Standard response wrapper
type ApiResponse<T> = {
  data: T;
  error: null;
} | {
  data: null;
  error: { code: string; message: string; field?: string };
};

// Paginated response
type PaginatedResponse<T> = {
  data: { items: T[]; total: number; page: number; pageSize: number };
  error: null;
};
```

**Date/Time Formats:**
- Database: `timestamptz` (PostgreSQL)
- API JSON: ISO 8601 strings (`2026-02-26T18:00:00.000Z`)
- Frontend display: `date-fns` for formatting

**ID Formats:**
- Database primary keys: UUID v4
- External references: Stored as `text` (Clerk IDs, Stripe IDs, etc.)

### Communication Patterns

**Inngest Event Naming:**

```
app/{domain}.{action}
```

Examples:
- `app/scrape.requested`
- `app/persona.generation.requested`
- `app/video.generation.requested`
- `app/video.segment.completed`
- `app/video.assembly.completed`

**Event Payload Structure:**

```typescript
{
  name: "app/video.generation.requested",
  data: {
    generationId: string;
    userId: string;
    personaId: string;
    productId: string;
    mode: "easy" | "expert";
    script?: { hook: string; body: string; cta: string };
  }
}
```

**State Updates:**
- Zustand stores: Immutable updates via Immer middleware
- React Query: Optimistic updates for CRUD, invalidation for generation status
- Database status: Updated by Inngest steps via Supabase client

### Process Patterns

**Error Handling:**
- API routes: Try/catch with consistent `ApiResponse` format
- Inngest steps: Built-in retry (max 3 attempts per step, exponential backoff)
- Frontend: React Error Boundaries for component errors, React Query `onError` for API errors
- User-facing errors: Friendly messages, never expose stack traces or internal codes

**Loading State Patterns:**
- React Query handles loading/error/success states for all server data
- Skeleton components for initial page loads
- Progress indicators for generation pipeline (poll generation status endpoint)
- Toast notifications for background task completions

**Credit Management Pattern:**

```
1. User triggers generation
2. API route checks credit balance (SELECT with FOR UPDATE)
3. If sufficient: Decrement credits atomically, create generation record
4. Send Inngest event to start pipeline
5. If pipeline fails completely: Refund credit via credit_transactions ledger
6. If overage: Calculate overage amount, create Stripe usage record
```

### Enforcement Guidelines

**All AI Agents MUST:**
- Use the Zod schemas in `src/schemas/` for all data validation — never inline validation
- Use the `ApiResponse<T>` wrapper for all API route responses — never return raw data
- Use Inngest step functions for all async pipeline work — never use `setTimeout` or manual queues
- Store all generated files in R2 via the storage utility in `src/lib/storage.ts` — never write to local filesystem
- Check credit balance before any generation — never generate without credit verification
- Use `src/lib/env.ts` for all environment variable access — never use `process.env` directly

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
aiugc/
├── .github/
│   └── workflows/
│       ├── ci.yml                          # Lint, type-check, test
│       └── deploy-worker.yml               # Railway worker deploy
├── .env.local                              # Local dev environment
├── .env.example                            # Template for env vars
├── .gitignore
├── bunfig.toml                             # Bun configuration
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── components.json                         # shadcn/ui config
├── middleware.ts                            # Clerk auth middleware
│
├── supabase/
│   ├── config.toml                         # Supabase local config
│   ├── seed.sql                            # Dev seed data
│   └── migrations/
│       ├── 001_create_users.sql
│       ├── 002_create_brands.sql
│       ├── 003_create_products.sql
│       ├── 004_create_personas.sql
│       ├── 005_create_generations.sql
│       ├── 006_create_videos.sql
│       ├── 007_create_subscriptions.sql
│       ├── 008_create_credit_transactions.sql
│       └── 009_create_rls_policies.sql
│
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx                      # Root layout (Clerk provider)
│   │   │
│   │   ├── (marketing)/
│   │   │   ├── layout.tsx                  # Marketing layout (header/footer)
│   │   │   ├── page.tsx                    # Landing page
│   │   │   └── pricing/
│   │   │       └── page.tsx                # Pricing page
│   │   │
│   │   ├── (auth)/
│   │   │   ├── sign-in/[[...sign-in]]/
│   │   │   │   └── page.tsx
│   │   │   └── sign-up/[[...sign-up]]/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                  # Dashboard layout (sidebar, header)
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx                # Dashboard home (video library)
│   │   │   ├── brands/
│   │   │   │   ├── page.tsx                # Brand list
│   │   │   │   └── [brandId]/
│   │   │   │       ├── page.tsx            # Brand detail + products
│   │   │   │       └── products/
│   │   │   │           └── [productId]/
│   │   │   │               └── page.tsx    # Product detail
│   │   │   ├── personas/
│   │   │   │   ├── page.tsx                # Persona list
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx            # Persona builder
│   │   │   │   └── [personaId]/
│   │   │   │       └── page.tsx            # Persona detail/edit
│   │   │   ├── generate/
│   │   │   │   ├── page.tsx                # Generation wizard (select product + persona)
│   │   │   │   └── [generationId]/
│   │   │   │       └── page.tsx            # Generation progress + video review
│   │   │   └── settings/
│   │   │       ├── page.tsx                # Account settings
│   │   │       └── billing/
│   │   │           └── page.tsx            # Subscription management
│   │   │
│   │   ├── api/
│   │   │   ├── scrape/
│   │   │   │   └── route.ts                # POST: Trigger website scraping
│   │   │   ├── brands/
│   │   │   │   ├── route.ts                # GET (list), POST (create)
│   │   │   │   └── [brandId]/
│   │   │   │       └── route.ts            # GET, PATCH, DELETE
│   │   │   ├── products/
│   │   │   │   ├── route.ts                # GET (list by brand)
│   │   │   │   └── [productId]/
│   │   │   │       └── route.ts            # GET, PATCH, DELETE
│   │   │   ├── personas/
│   │   │   │   ├── route.ts                # GET (list), POST (create)
│   │   │   │   ├── generate/
│   │   │   │   │   └── route.ts            # POST: Generate persona images
│   │   │   │   └── [personaId]/
│   │   │   │       └── route.ts            # GET, PATCH, DELETE
│   │   │   ├── generations/
│   │   │   │   ├── route.ts                # GET (list), POST (create + trigger)
│   │   │   │   └── [generationId]/
│   │   │   │       └── route.ts            # GET (status + videos)
│   │   │   ├── billing/
│   │   │   │   ├── checkout/
│   │   │   │   │   └── route.ts            # POST: Create Stripe checkout session
│   │   │   │   └── portal/
│   │   │   │       └── route.ts            # POST: Create Stripe portal session
│   │   │   └── webhooks/
│   │   │       ├── clerk/
│   │   │       │   └── route.ts            # POST: Clerk user sync
│   │   │       ├── stripe/
│   │   │       │   └── route.ts            # POST: Stripe subscription events
│   │   │       └── inngest/
│   │   │           └── route.ts            # POST: Inngest function endpoint
│   │   │
│   │   └── onboarding/
│   │       └── page.tsx                    # Post-scrape onboarding flow
│   │
│   ├── components/
│   │   ├── ui/                             # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── MarketingHeader.tsx
│   │   │   ├── MarketingFooter.tsx
│   │   │   ├── DashboardSidebar.tsx
│   │   │   └── DashboardHeader.tsx
│   │   ├── landing/
│   │   │   ├── HeroSection.tsx
│   │   │   ├── UrlInputCta.tsx
│   │   │   ├── FeatureShowcase.tsx
│   │   │   ├── PricingTeaser.tsx
│   │   │   ├── TestimonialSection.tsx
│   │   │   └── FaqSection.tsx
│   │   ├── persona-builder/
│   │   │   ├── PersonaBuilder.tsx          # Main builder component
│   │   │   ├── AttributeSelector.tsx       # Generic attribute picker
│   │   │   ├── SkinToneGradient.tsx        # Gradient color picker
│   │   │   ├── HairStylePicker.tsx
│   │   │   ├── ClothingStylePicker.tsx
│   │   │   ├── AccessoryPicker.tsx
│   │   │   ├── PersonaPreview.tsx          # Live preview panel
│   │   │   └── PersonaImageGrid.tsx        # 4-variant selection grid
│   │   ├── generation/
│   │   │   ├── GenerationWizard.tsx        # Multi-step generation flow
│   │   │   ├── ProductSelector.tsx
│   │   │   ├── PersonaSelector.tsx
│   │   │   ├── ScriptPreview.tsx           # AI-generated script display
│   │   │   ├── GenerationProgress.tsx      # Pipeline progress tracker
│   │   │   └── VideoReviewGrid.tsx         # 4-variant video review
│   │   ├── video/
│   │   │   ├── VideoPlayer.tsx             # Custom video player
│   │   │   ├── VideoCard.tsx               # Video thumbnail card
│   │   │   └── VideoLibrary.tsx            # Grid of generated videos
│   │   ├── billing/
│   │   │   ├── PricingCards.tsx            # Plan selection cards
│   │   │   ├── CreditBalance.tsx           # Current credit display
│   │   │   └── PaywallModal.tsx            # Paywall trigger modal
│   │   └── brand/
│   │       ├── BrandCard.tsx
│   │       ├── ProductCard.tsx
│   │       └── ProductImportReview.tsx     # Scraped data review/edit
│   │
│   ├── lib/
│   │   ├── env.ts                          # Zod-validated environment variables
│   │   ├── supabase/
│   │   │   ├── client.ts                   # Browser Supabase client
│   │   │   ├── server.ts                   # Server-side Supabase client
│   │   │   └── admin.ts                    # Service role client (webhooks)
│   │   ├── clerk.ts                        # Clerk helpers
│   │   ├── stripe.ts                       # Stripe client + helpers
│   │   ├── inngest.ts                      # Inngest client initialization
│   │   ├── storage.ts                      # R2 upload/download/signed URL helpers
│   │   ├── openrouter.ts                   # OpenRouter client + model selection
│   │   └── utils.ts                        # General utilities (cn, formatters)
│   │
│   ├── schemas/
│   │   ├── brand.ts                        # Brand Zod schemas
│   │   ├── product.ts                      # Product Zod schemas
│   │   ├── persona.ts                      # Persona attribute + creation schemas
│   │   ├── generation.ts                   # Generation request/response schemas
│   │   ├── billing.ts                      # Billing/subscription schemas
│   │   └── scrape.ts                       # Scrape request/response schemas
│   │
│   ├── hooks/
│   │   ├── use-brands.ts                   # React Query hooks for brands
│   │   ├── use-products.ts                 # React Query hooks for products
│   │   ├── use-personas.ts                 # React Query hooks for personas
│   │   ├── use-generations.ts              # React Query hooks for generations
│   │   ├── use-credits.ts                  # Credit balance hook
│   │   └── use-generation-progress.ts      # Polling hook for generation status
│   │
│   ├── stores/
│   │   ├── persona-builder.ts              # Zustand store for builder state
│   │   └── generation-wizard.ts            # Zustand store for wizard state
│   │
│   ├── inngest/
│   │   ├── client.ts                       # Inngest client config
│   │   ├── functions/
│   │   │   ├── scrape-website.ts           # Website scraping pipeline
│   │   │   ├── generate-persona-images.ts  # NanoBanana image generation
│   │   │   ├── generate-video.ts           # Full video generation pipeline
│   │   │   ├── generate-script.ts          # OpenRouter script generation
│   │   │   └── send-completion-email.ts    # Email notification
│   │   └── index.ts                        # Export all functions for registration
│   │
│   └── types/
│       ├── database.ts                     # Supabase generated types
│       └── api.ts                          # ApiResponse type + helpers
│
├── worker/                                 # Separate Hono service (Railway)
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile                          # Bun + FFmpeg + Playwright
│   ├── src/
│   │   ├── index.ts                        # Hono app entry point
│   │   ├── routes/
│   │   │   ├── scrape.ts                   # Scraping endpoints
│   │   │   ├── image-generate.ts           # NanoBanana proxy
│   │   │   ├── video-generate.ts           # Kling 3.0 proxy
│   │   │   ├── video-assemble.ts           # FFmpeg stitching
│   │   │   └── health.ts                   # Health check
│   │   ├── services/
│   │   │   ├── scraper/
│   │   │   │   ├── shopify.ts              # Shopify Storefront API client
│   │   │   │   └── generic.ts              # Playwright generic scraper
│   │   │   ├── nanobanana.ts               # NanoBanana API client
│   │   │   ├── kling.ts                    # Kling 3.0 API client
│   │   │   ├── openrouter.ts               # OpenRouter API client
│   │   │   └── ffmpeg.ts                   # FFmpeg wrapper
│   │   ├── lib/
│   │   │   ├── env.ts                      # Worker environment validation
│   │   │   ├── storage.ts                  # R2 client for worker
│   │   │   └── supabase.ts                 # Supabase client for status updates
│   │   └── types/
│   │       └── index.ts                    # Worker-specific types
│   └── tests/
│       ├── scraper.test.ts
│       ├── nanobanana.test.ts
│       └── ffmpeg.test.ts
│
├── public/
│   ├── og-image.png                        # Open Graph image
│   └── favicon.ico
│
└── tests/
    ├── setup.ts                            # Test setup (mocks, env)
    └── e2e/
        ├── landing.spec.ts
        ├── onboarding.spec.ts
        ├── persona-builder.spec.ts
        └── generation.spec.ts
```

### Architectural Boundaries

**API Boundaries:**
- Public API: `/api/scrape` (rate-limited, no auth required for initial scrape)
- Authenticated API: All other `/api/*` routes require Clerk session
- Webhook API: `/api/webhooks/*` verified by respective service signatures
- Worker API: `worker/src/routes/*` called only by Inngest (verified by Inngest signing key)

**Component Boundaries:**
- Marketing pages: No access to dashboard state or authenticated APIs
- Dashboard: Requires Clerk session, accesses only user-scoped data
- Persona Builder: Self-contained component with local Zustand store, communicates via React Query mutations
- Generation Pipeline: Event-driven, no direct coupling between steps

**Data Boundaries:**
- All database access through Supabase client (never raw SQL in app code)
- RLS enforces user data isolation — no user can access another user's data
- Worker service has service-role access (needed for cross-user operations like batch processing)
- R2 access: Signed URLs for reads (time-limited), direct upload for writes (worker only)

### Requirements to Structure Mapping

| Epic | Primary Location |
|---|---|
| E1: Landing Page | `src/app/(marketing)/`, `src/components/landing/` |
| E2: Website Scraper | `src/app/api/scrape/`, `worker/src/services/scraper/`, `src/inngest/functions/scrape-website.ts` |
| E3: Auth & User Mgmt | `src/app/(auth)/`, `middleware.ts`, `src/app/api/webhooks/clerk/` |
| E4: Persona Creator | `src/app/(dashboard)/personas/`, `src/components/persona-builder/`, `src/stores/persona-builder.ts` |
| E5: NanoBanana Integration | `worker/src/services/nanobanana.ts`, `src/inngest/functions/generate-persona-images.ts` |
| E6: AI Script Generator | `worker/src/services/openrouter.ts`, `src/inngest/functions/generate-script.ts` |
| E7: Kling Video Pipeline | `worker/src/services/kling.ts`, `src/inngest/functions/generate-video.ts` |
| E8: Video Assembly | `worker/src/services/ffmpeg.ts`, `worker/src/routes/video-assemble.ts` |
| E9: Paywall & Billing | `src/components/billing/`, `src/app/api/billing/`, `src/app/api/webhooks/stripe/` |
| E10: Dashboard & Library | `src/app/(dashboard)/dashboard/`, `src/components/video/` |

### External Integration Points

| Service | Integration Method | Key File |
|---|---|---|
| Clerk | SDK + webhooks | `src/lib/clerk.ts`, `src/app/api/webhooks/clerk/route.ts` |
| Supabase | Client SDK | `src/lib/supabase/` |
| Stripe | SDK + webhooks | `src/lib/stripe.ts`, `src/app/api/webhooks/stripe/route.ts` |
| Inngest | SDK + event-driven | `src/lib/inngest.ts`, `src/inngest/` |
| NanoBanana | REST API | `worker/src/services/nanobanana.ts` |
| Kling 3.0 | REST API | `worker/src/services/kling.ts` |
| OpenRouter | REST API | `worker/src/services/openrouter.ts` |
| Cloudflare R2 | S3-compatible SDK | `src/lib/storage.ts`, `worker/src/lib/storage.ts` |

### Data Flow: Video Generation Pipeline

```
User clicks "Generate"
    │
    ▼
POST /api/generations
    ├── Verify credit balance (Supabase, SELECT FOR UPDATE)
    ├── Decrement credits (Supabase, atomic UPDATE)
    ├── Create generation record (status: 'pending')
    └── inngest.send('app/video.generation.requested')
         │
         ▼
    Inngest: generate-video function
         │
         ├── step.run('generate-script')
         │   └── Worker: OpenRouter → script (hook/body/cta)
         │   └── Update generation record with script
         │
         ├── step.run('generate-pov-image')
         │   └── Worker: NanoBanana → POV composite image
         │   └── Upload to R2
         │
         ├── step.run('generate-hook-segment')    ─┐
         ├── step.run('generate-body-segment')     ├── Parallel (x4 variants)
         ├── step.run('generate-cta-segment')     ─┘
         │   └── Worker: Kling 3.0 → video segments
         │   └── Upload segments to R2
         │
         ├── step.run('assemble-videos')
         │   └── Worker: FFmpeg → stitch segments
         │   └── Upload final videos to R2
         │   └── Create video records in Supabase
         │
         └── step.run('notify-user')
             └── Update generation status: 'completed'
             └── Send email notification
                  │
                  ▼
         User reviews 4 videos in dashboard
```

---

## Architecture Validation Results

### Coherence Validation

- **Decision Compatibility:** All chosen technologies are proven to work together (Next.js + Clerk + Supabase + Stripe is a well-documented stack). Inngest natively integrates with Next.js and Vercel.
- **Pattern Consistency:** All naming, format, and communication patterns are consistent across frontend and worker service.
- **Structure Alignment:** Project structure maps directly to PRD epics and features.

### Requirements Coverage

- **All 12 PRD epics mapped** to specific directories and files
- **All MVP features covered:** Landing page, scraping, auth, persona builder, Easy Mode generation, 4-variant output, Starter + Growth tiers, Stripe checkout, MP4 download
- **NFRs addressed:** Concurrent jobs (Inngest), uptime (Vercel + Railway), graceful degradation (Inngest step retries), encryption (Supabase + R2), rate limiting (middleware)

### Implementation Readiness

- **Decision Completeness:** All critical and important decisions made. No blockers.
- **Structure Completeness:** Every file and directory specified. AI agents can begin implementation immediately.
- **Pattern Completeness:** All naming, format, and process patterns defined to prevent agent conflicts.

### Gap Analysis

**Known gaps (non-blocking for MVP):**
- Email notification service not specified (Resend recommended when needed)
- Video cleanup/retention policy not defined (define post-launch based on storage costs)
- Monitoring alerting thresholds not specified (configure after baseline metrics)

### Architecture Readiness Assessment

- **Overall Status:** READY FOR IMPLEMENTATION
- **Confidence Level:** High
- **Key Strengths:** Event-driven pipeline with per-step retry, clean separation between web app and worker, cost-efficient storage with R2
- **Areas for Future Enhancement:** Real-time progress via Supabase Realtime or SSE, multi-region workers, video CDN optimization

---

**End of Architecture Document**
