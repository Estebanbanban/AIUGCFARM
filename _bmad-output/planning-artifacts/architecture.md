---
workflowType: 'architecture'
project_name: 'AI UGC Generator'
user_name: 'Estebanronsin'
date: '2026-02-26'
status: 'complete'
stepsCompleted:
  - 'step-01-init'
  - 'step-02-context'
  - 'step-03-starter'
  - 'step-04-decisions'
  - 'step-05-patterns'
  - 'step-06-structure'
  - 'step-07-validation'
  - 'step-08-complete'
inputDocuments:
  - 'ai-ugc-generator-prd.md'
---

# Architecture Document  -  AI UGC Generator

**Author:** Architecture Agent
**Date:** February 2026
**Version:** 1.0
**Status:** Complete  -  Ready for Implementation

---

## Project Context Analysis

### Requirements Overview

The AI UGC Generator is a B2B SaaS platform enabling e-commerce brands to generate UGC-style video ads from their store URL. The core loop is: **Scrape → Persona → Generate → Download**.

**Functional Requirements:** 38 FRs across 6 domains (Product Import, Auth, Persona, Video Generation, Billing, Dashboard)
**Non-Functional Requirements:** 16 NFRs (Performance, Reliability, Security, Scalability)

### Scale & Complexity Assessment

| Dimension | Assessment |
|-----------|-----------|
| Expected users (M6) | ~1,000–5,000 registered, ~500 active |
| Concurrent video jobs | 50 (NFR5) |
| Data sensitivity | Low-medium (product data + payment via Stripe) |
| API integrations | 4 external (OpenAI, NanoBanana, Kling 3.0, Stripe) |
| Async complexity | High (video generation = multi-minute jobs) |
| Multi-tenancy | Per-user isolation with future team support |

### Technical Constraints

- Video generation (Kling 3.0) takes 2–10 minutes  -  must be async
- Edge Functions have ~60s execution timeout  -  long jobs require fire-and-poll pattern
- All payment data handled by Stripe (PCI compliance)
- Storage needed for generated videos and persona images

### Cross-Cutting Concerns

- Authentication & authorization on every Edge Function
- Credit balance checking before any generation
- Rate limiting on public endpoints (scraping)
- SSRF protection on URL scraping
- Consistent error handling and response format

---

## Starter Template Evaluation

### Primary Technology Domain

Full-stack TypeScript SaaS application with serverless backend.

### Selected Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 14 (App Router) | SSR/SSG, file-based routing, Vercel native |
| **Styling** | Tailwind CSS + shadcn/ui | Rapid UI development, consistent design system |
| **Backend** | Supabase Edge Functions (Deno) | Zero infra management, native DB/Auth/Storage integration |
| **Database** | Supabase PostgreSQL | Managed, RLS built-in, realtime capable |
| **Auth** | Supabase Auth | Native JWT, RLS integration, OAuth support |
| **Storage** | Supabase Storage | Managed buckets with access policies |
| **Payments** | Stripe | PCI compliant, subscription + one-time credits |
| **AI  -  Scripts** | OpenAI API (GPT-4o) | Best-in-class text generation for ad scripts |
| **AI  -  Images** | NanoBanana API | Persona image generation from attribute prompts |
| **AI  -  Video** | Kling 3.0 API | UGC-style video generation with lip-sync |
| **Data Fetching** | TanStack React Query v5 | Server state, caching, stale-while-revalidate |
| **Client State** | Zustand v4 | Multi-step generation wizard + localStorage persistence |
| **Error Tracking** | Sentry Browser SDK + Sentry SDK (Deno) | Error tracking + performance monitoring (frontend + edge functions) |
| **Analytics** | DataFast | Analytics event pipeline (client-side, `lib/datafast.ts`) |
| **Animations** | canvas-confetti | Post-purchase UX celebration animation |
| **Testing** | Vitest + Playwright | Unit tests and e2e tests |
| **Hosting** | Vercel (frontend) + Supabase (everything else) | 2 services total, minimal ops |

### Architectural Decisions Provided by Starter

- **Language & Runtime:** TypeScript (frontend + Edge Functions in Deno)
- **Styling:** Tailwind CSS with shadcn/ui component library
- **Build Tooling:** Next.js built-in (Turbopack dev, Webpack prod)
- **Testing:** Vitest (unit) + Playwright (e2e)
- **Code Organization:** Feature-based modules
- **Dev Experience:** Hot reload, type safety end-to-end

---

## Core Architectural Decisions

### AD1: Full Supabase Backend (No External Server)

**Decision:** All backend logic runs in Supabase Edge Functions. No Python/FastAPI server.

**Rationale:**
- Single backend platform = simpler ops, fewer services, lower cost
- Edge Functions handle all API calls (scraping, AI, Stripe) via `fetch()`
- Native integration with Auth, DB, Storage  -  no sync issues
- Scales automatically with Supabase infrastructure

**Trade-off:** Edge Functions have a ~60s timeout. Video generation (2–10 min) uses fire-and-poll pattern instead of long-running processes.

### AD2: Supabase Auth (Not Clerk)

**Decision:** Use Supabase Auth for all authentication.

**Rationale:**
- Native RLS integration  -  `auth.uid()` works everywhere
- No user sync between systems
- JWT verified natively in Edge Functions
- Free, included in Supabase plan
- OAuth (Google) built-in

### AD3: Fire-and-Poll for Video Generation

**Decision:** Video generation uses an async fire-and-poll pattern, not WebSockets.

**Flow:**
1. `generate-video/` Edge Function calls Kling 3.0 API → gets `job_id` → saves to DB with `status: 'processing'` → returns `job_id` to frontend
2. Frontend polls `video-status/` Edge Function every 5 seconds
3. `video-status/` checks Kling API with `job_id` → when ready, downloads video to Storage, updates DB `status: 'completed'`

**Rationale:**
- Simpler than WebSockets for MVP
- Works within Edge Function timeout
- Stateless  -  any Edge Function instance can check status
- Easy to add webhook callback from Kling later (Phase 2)

### AD4: Credit-Based Billing via Stripe

**Decision:** Stripe Checkout for subscriptions + credit balance managed in Supabase.

**Flow:**
1. Stripe webhook → Edge Function → updates `subscriptions` + `credit_balances` tables
2. Before generation: check `credit_balances.remaining >= 1`
3. After generation: decrement balance in `credit_ledger`

**Rationale:**
- Stripe handles all PCI-sensitive operations
- Credit ledger in DB provides audit trail
- Webhook idempotency via `audit_logs` table (check event ID before processing)

### AD5: Signed URLs for Storage Access

**Decision:** All generated media (videos, persona images) served via signed URLs with expiry.

**Rationale:**
- No public bucket access
- URLs expire after 1 hour  -  prevents hotlinking
- RLS not needed on Storage if Edge Functions generate signed URLs after auth check

### AD6: SSRF Protection on Scraping

**Decision:** URL scraping validates target before fetching.

**Rules:**
- Block private IPs (RFC1918, localhost, 169.254.x.x metadata)
- Block internal Supabase URLs
- Allow only HTTP/HTTPS schemes
- Enforce response size limit (5MB)
- Timeout after 15 seconds

---

## Database Schema

### Tables

#### `profiles`
Extends Supabase `auth.users`. Created automatically via trigger on signup.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'growth', 'scale')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  first_video_discount_used BOOLEAN NOT NULL DEFAULT false, -- tracks 50% first-video discount eligibility
  banned_at TIMESTAMPTZ, -- admin ban timestamp (null = not banned)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `subscriptions`
Stripe subscription state, managed by webhook.

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'growth', 'scale')),
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `credit_balances`
Current credit state per user.

```sql
CREATE TABLE credit_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  remaining INTEGER NOT NULL DEFAULT 0 CHECK (remaining >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `credit_ledger`
Immutable transaction log for credits.

```sql
CREATE TABLE credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- positive = credit, negative = debit
  reason TEXT NOT NULL CHECK (reason IN ('subscription_renewal', 'generation', 'refund', 'bonus', 'free_trial')),
  reference_id UUID, -- scan_id, subscription_id, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `products`
Scraped product data.

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_url TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  category TEXT,
  images JSONB NOT NULL DEFAULT '[]', -- array of image URLs
  brand_summary JSONB, -- { tone, demographic, selling_points }
  source TEXT NOT NULL CHECK (source IN ('shopify', 'generic', 'manual')),
  confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `personas`
AI personas created by users.

```sql
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  attributes JSONB NOT NULL, -- { gender, skin_tone, age, hair_color, hair_style, eye_color, body_type, clothing_style, accessories }
  selected_image_url TEXT, -- chosen from generated options
  generated_images JSONB DEFAULT '[]', -- array of 4 image URLs
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `generations`
Video generation jobs.

```sql
CREATE TABLE generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'easy' CHECK (mode IN ('easy', 'expert')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scripting', 'awaiting_approval', 'locking', 'submitting_jobs', 'generating_segments', 'completed', 'failed')),
  video_quality TEXT, -- 'standard' | 'hd'
  kling_model TEXT, -- actual model used ('kling-v2-6' | 'kling-v3')
  script JSONB, -- { hooks: [], bodies: [], ctas: [] } — final reviewed script
  script_raw JSONB, -- pre-review script before coherence pass
  override_script JSONB, -- user-edited script overrides from approval step
  composite_image_url TEXT, -- storage path to persona + product composite
  videos JSONB DEFAULT '[]', -- array of { url, thumbnail_url, duration, variation_index }
  error_message TEXT,
  external_job_ids JSONB DEFAULT '{}', -- { hook_1_job_id, body_1_job_id, cta_1_job_id, ... }
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `audit_logs`
Idempotency tracking + audit trail.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'generation', 'subscription', 'scrape', 'stripe_event', etc.
  event_id TEXT UNIQUE, -- Stripe event ID for idempotency
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Row Level Security Policies

```sql
-- profiles: users can only read/update their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- products: users can only CRUD their own products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own products" ON products FOR ALL USING (auth.uid() = owner_id);

-- personas: users can only CRUD their own personas
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own personas" ON personas FOR ALL USING (auth.uid() = owner_id);

-- generations: users can only read their own generations
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own generations" ON generations FOR SELECT USING (auth.uid() = owner_id);

-- credit_balances: users can only read their own balance
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own balance" ON credit_balances FOR SELECT USING (auth.uid() = owner_id);

-- credit_ledger: users can only read their own ledger
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own ledger" ON credit_ledger FOR SELECT USING (auth.uid() = owner_id);

-- subscriptions: users can only read their own subscription
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own subscription" ON subscriptions FOR SELECT USING (auth.uid() = owner_id);

-- audit_logs: service_role only (no direct user access)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

### Database Triggers

```sql
-- Auto-create profile on signup
CREATE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO credit_balances (owner_id, remaining) VALUES (NEW.id, 1); -- 1 free trial credit
  INSERT INTO credit_ledger (owner_id, amount, reason) VALUES (NEW.id, 1, 'free_trial');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON personas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON credit_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Indexes

```sql
CREATE INDEX idx_products_owner ON products(owner_id);
CREATE INDEX idx_personas_owner ON personas(owner_id);
CREATE INDEX idx_generations_owner ON generations(owner_id);
CREATE INDEX idx_generations_status ON generations(status);
CREATE INDEX idx_credit_ledger_owner ON credit_ledger(owner_id);
CREATE INDEX idx_audit_logs_event_id ON audit_logs(event_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
```

---

## Supabase Storage Buckets

| Bucket | Access | Purpose |
|--------|--------|---------|
| `persona-images` | Private  -  signed URLs via Edge Functions | Generated persona images (4 per generation) |
| `generated-videos` | Private  -  signed URLs via Edge Functions | Final video outputs (4 per generation) |
| `composite-images` | Private  -  signed URLs via Edge Functions | Persona + product composite images |
| `product-images` | Private  -  signed URLs via Edge Functions | Manually uploaded product images |

### Storage Policies

All buckets are **private**. Access is granted via signed URLs generated by Edge Functions after auth verification. No direct client-side uploads except for `product-images` (with auth).

```sql
-- product-images: authenticated users can upload to their own folder
CREATE POLICY "Users upload own product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- All buckets: service_role handles reads/writes from Edge Functions
-- No public SELECT policies  -  all access via signed URLs
```

---

## Edge Functions

### Shared Helpers (`_shared/`)

| File | Purpose |
|------|---------|
| `cors.ts` | CORS headers (allow frontend origin) |
| `auth.ts` | `requireUserId(req)`  -  extract & verify JWT, return user ID |
| `response.ts` | `json(body, cors, status)`  -  standard JSON response builder |
| `supabase.ts` | `getAdminClient()`  -  service_role Supabase client |
| `credits.ts` | `checkCredits(userId)` / `debitCredit(userId, generationId)` |
| `ssrf.ts` | `validateUrl(url)`  -  block private IPs, enforce scheme |
| `rate-limit.ts` | In-memory rate limiter (IP-based for public, user-based for auth) |
| `sentry.ts` | `captureException(error, context)` — error capture for edge functions via Sentry SDK (Deno) |
| `retry.ts` | Exponential backoff retry wrapper for external API calls |

### Endpoints

#### Product Import & Scraping

**`scrape-product/`**  -  POST
```
Input:  { url: string }
Auth:   Optional (soft gate  -  works without auth)
Flow:
  1. validateUrl(url)  -  SSRF check
  2. Rate limit check (10/hr unauthenticated, 60/hr authenticated)
  3. Fetch URL HTML
  4. Detect platform (Shopify JSON endpoint vs generic HTML)
  5. Extract: name, images, description, price, category
  6. Call OpenAI → generate brand_summary { tone, demographic, selling_points }
  7. If authenticated: save to products table (confirmed = false)
Output: { products: Product[], brand_summary: BrandSummary }
```

**`confirm-products/`**  -  POST
```
Input:  { product_ids: string[], edits: Record<string, Partial<Product>> }
Auth:   Required
Flow:
  1. Update products with edits
  2. Set confirmed = true
Output: { success: true }
```

**`upload-product/`**  -  POST (multipart)
```
Input:  { name, description, price, images: File[] }
Auth:   Required
Flow:
  1. Upload images to product-images bucket
  2. Create product record with source = 'manual'
Output: { product: Product }
```

#### Persona

**`generate-persona/`**  -  POST
```
Input:  { name: string, attributes: PersonaAttributes }
Auth:   Required
Flow:
  1. Check persona slot limit (Starter=1, Growth=3, Scale=10)
  2. Build prompt from attributes
  3. Call NanoBanana API → 4 images
  4. Upload images to persona-images bucket
  5. Create persona record with generated_images
Output: { persona: Persona }
Timeout: ~20-30s (within Edge Function limit)
```

**`select-persona-image/`**  -  POST
```
Input:  { persona_id: string, image_index: number }
Auth:   Required
Flow:
  1. Verify ownership
  2. Set selected_image_url from generated_images[index]
Output: { persona: Persona }
```

#### Video Generation

**`generate-video/`**  -  POST (Two-Phase)
```
Phase 1 — Script Generation (phase="script"):
Input:  { product_id, persona_id, mode, video_quality, format, cta_style, phase: "script" }
Auth:   Required
Flow:
  1. Create generation record (status: 'awaiting_approval')
  2. Call OpenRouter → generate Hook/Body/CTA script variants
  3. Coherence review pass → score & rewrite if < 70
  4. Save script_raw (pre-review) and script (final) on generation
  5. No credits charged — script phase is free
Output: { generation_id, status: 'awaiting_approval', script, credits_to_charge }

Phase 2 — Approval & Video Submission (phase="approve"):
Input:  { generation_id, override_script? }
Auth:   Required
Flow:
  1. Atomic lock: awaiting_approval → locking (prevents double-approval)
  2. Check credit balance >= cost (revert to awaiting_approval with 402 if insufficient)
  3. Debit credits → locking → submitting_jobs
  4. For each segment × variant count: call Kling API → get job_ids
  5. Store job_ids → status: generating_segments
Output: { generation_id, status: 'generating_segments' }

Status Flow:
  awaiting_approval → locking → submitting_jobs → generating_segments → completed
                                                                      ↘ failed
```

**`video-status/`**  -  GET
```
Input:  ?generation_id=xxx
Auth:   Required
Flow:
  1. Verify ownership
  2. Load generation record
  3. If status = 'generating_video':
     a. Check each Kling job_id status via API
     b. For completed segments: download video, upload to Storage
     c. If all segments done for all 4 variations:
        - Stitch segments (or return segments  -  MVP can skip stitching)
        - Update generation (status: 'completed', videos array populated)
  4. Return current status + completed videos (if any)
Output: { status: string, progress: { completed: number, total: number }, videos: Video[] }
Polling: Frontend calls every 5s until status = 'completed' or 'failed'
```

**`generation-history/`**  -  GET
```
Input:  ?page=1&limit=20
Auth:   Required
Flow:   Query generations for owner, ordered by created_at DESC
Output: { generations: Generation[], total: number }
```

#### Billing

**`stripe-checkout/`**  -  POST
```
Input:  { plan: 'starter' | 'growth' | 'scale' }
Auth:   Required
Flow:
  1. Get or create Stripe customer
  2. Create Checkout session with plan price_id
  3. Return checkout URL
Output: { url: string }
```

**`stripe-portal/`**  -  POST
```
Auth:   Required
Flow:   Create Stripe billing portal session
Output: { url: string }
```

**`stripe-webhook/`**  -  POST
```
Auth:   Stripe signature verification (no JWT)
Flow:
  1. Verify webhook signature
  2. Check event_id in audit_logs (idempotency)
  3. Handle events:
     - checkout.session.completed → create/update subscription, set plan, add credits
     - invoice.paid → renew credits for billing period
     - customer.subscription.updated → update plan/status
     - customer.subscription.deleted → set plan to 'free', clear credits
  4. Log event in audit_logs
Output: { received: true }
```

**`credit-balance/`**  -  GET
```
Auth:   Required
Flow:   Read credit_balances for user
Output: { remaining: number, plan: string }
```

#### Auth Helpers

**`delete-account/`**  -  POST
```
Auth:   Required
Flow:
  1. Delete all user data (products, personas, generations, credits)
  2. Delete Storage objects
  3. Cancel Stripe subscription
  4. Delete Supabase auth user
Output: { success: true }
```

---

## Frontend Architecture

### Pages (App Router)

```
app/
├── (marketing)/
│   ├── page.tsx                    # Landing page: hero + URL input + pricing + FAQ
│   ├── pricing/page.tsx            # Plan comparison + checkout CTA
│   └── layout.tsx                  # Marketing layout (Navbar + Footer)
│
├── (app)/
│   ├── layout.tsx                  # App layout (auth guard + sidebar)
│   ├── dashboard/page.tsx          # Overview: credits, recent generations, video library
│   ├── products/
│   │   ├── page.tsx                # Product library
│   │   └── [id]/page.tsx           # Product detail + edit
│   ├── personas/
│   │   ├── page.tsx                # Persona library
│   │   ├── new/page.tsx            # Persona creator (character builder)
│   │   └── [id]/page.tsx           # Persona detail
│   ├── generate/
│   │   ├── page.tsx                # Generation wizard: select product → persona → generate
│   │   └── [id]/page.tsx           # Generation result: 4 videos side-by-side
│   ├── settings/page.tsx           # Account settings
│   └── billing/page.tsx            # Subscription management
│
├── login/page.tsx                  # Auth page (email + Google OAuth)
├── signup/page.tsx                 # Registration page
├── auth/callback/route.ts          # OAuth callback handler
│
└── layout.tsx                      # Root layout (providers, fonts, metadata)
```

### Key Components

```
components/
├── ui/                             # shadcn/ui base components
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── slider.tsx
│   ├── badge.tsx
│   ├── skeleton.tsx
│   ├── toast.tsx
│   └── ...
│
├── layout/
│   ├── navbar.tsx                  # Top nav (marketing)
│   ├── sidebar.tsx                 # App sidebar (dashboard nav)
│   ├── footer.tsx                  # Marketing footer
│   └── auth-guard.tsx              # Redirect to login if unauthenticated
│
├── landing/
│   ├── hero-section.tsx            # Hero + URL input CTA
│   ├── how-it-works.tsx            # 3-step explainer
│   ├── pricing-section.tsx         # Plan cards
│   ├── faq-section.tsx             # Accordion FAQ
│   └── demo-video.tsx              # Product demo
│
├── products/
│   ├── product-card.tsx            # Product display card
│   ├── product-grid.tsx            # Grid of product cards
│   ├── scrape-form.tsx             # URL input + scrape trigger
│   ├── scrape-results.tsx          # Scraped products with edit/confirm
│   └── manual-upload.tsx           # Manual product upload form
│
├── personas/
│   ├── character-builder.tsx       # Main persona creator (9 attributes)
│   ├── attribute-selector.tsx      # Individual attribute control (slider/picker/grid)
│   ├── persona-preview.tsx         # Live preview of selected attributes
│   ├── persona-image-picker.tsx    # 4 generated images  -  select one
│   └── persona-card.tsx            # Persona display card
│
├── generate/
│   ├── generation-wizard.tsx       # Step-by-step: product → persona → generate
│   ├── script-preview.tsx          # Hook/Body/CTA script display
│   ├── generation-progress.tsx     # Progress bar with status polling
│   ├── video-grid.tsx              # 4 videos side-by-side comparison
│   ├── video-player.tsx            # Individual video player with download
│   └── paywall-modal.tsx           # Plan selection modal at generation step
│
├── dashboard/
│   ├── credit-badge.tsx            # Credit balance display
│   ├── generation-history.tsx      # Recent generations list
│   └── stats-cards.tsx             # Quick stats (videos generated, credits used)
│
└── billing/
    ├── plan-card.tsx               # Individual plan display
    ├── plan-comparison.tsx         # Feature comparison table
    └── billing-portal-button.tsx   # Redirect to Stripe portal
```

### Client Libraries

```
lib/
├── supabase.ts                     # Supabase browser client (createBrowserClient)
├── supabase-server.ts              # Supabase server client (createServerClient for SSR)
├── api.ts                          # Edge Function call wrappers (scrape, generate, etc.)
├── hooks/
│   ├── use-user.ts                 # Auth state hook
│   ├── use-credits.ts              # Credit balance hook
│   ├── use-generation-status.ts    # Polling hook for video generation progress
│   └── use-products.ts             # Products CRUD hook
├── types.ts                        # Shared TypeScript types (Product, Persona, Generation, etc.)
├── constants.ts                    # Plan limits, attribute options, pricing
└── utils.ts                        # cn() helper, formatters
```

---

## Implementation Patterns & Consistency Rules

### Edge Function Pattern

Every Edge Function follows this exact structure:

```typescript
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const userId = await requireUserId(req);
    const sb = getAdminClient();

    // ... business logic ...

    return json({ data }, cors);
  } catch (e: any) {
    if (e.message === "Unauthorized") return json({ detail: "Authentication required" }, cors, 401);
    if (e.message === "Forbidden") return json({ detail: "Access denied" }, cors, 403);
    if (e.message === "Rate limited") return json({ detail: "Too many requests" }, cors, 429);
    console.error(e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
```

### API Call Pattern (Frontend)

```typescript
// lib/api.ts
const EDGE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1";

async function callEdge<T>(fn: string, options: { method?: string; body?: any; token: string }): Promise<T> {
  const res = await fetch(`${EDGE_URL}/${fn}`, {
    method: options.method || "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `Edge function error: ${res.status}`);
  }

  return res.json();
}
```

### Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| DB tables | snake_case plural | `credit_balances` |
| DB columns | snake_case | `owner_id`, `created_at` |
| Edge Functions | kebab-case | `generate-video/`, `stripe-webhook/` |
| Frontend pages | kebab-case dirs | `app/(app)/dashboard/` |
| Components | PascalCase files | `PersonaCard.tsx` |
| Hooks | camelCase with `use` prefix | `useCredits.ts` |
| Types | PascalCase | `Generation`, `PersonaAttributes` |
| API wrappers | camelCase verbs | `scrapeProduct()`, `generateVideo()` |

### Error Handling

- **Edge Functions:** Always return JSON with `detail` field on error. Log to `console.error` for server-side. Never expose stack traces.
- **Frontend:** `try/catch` on all API calls. Show toast on error. Never swallow errors silently.
- **Stripe webhook:** Log + acknowledge (200) even on processing errors to prevent retry storms. Track failures in `audit_logs`.

### Response Format

All Edge Functions return:

```typescript
// Success
{ "data": { ... } }

// Error
{ "detail": "Human-readable error message" }
```

---

## Project Directory Structure

```
ugcfarmai/
├── frontend/
│   ├── src/
│   │   ├── app/                    # Next.js App Router pages
│   │   ├── components/             # React components (ui/, layout/, landing/, etc.)
│   │   ├── lib/                    # Utilities, API client, hooks, types
│   │   └── styles/
│   │       └── globals.css         # Tailwind base + custom styles
│   ├── public/                     # Static assets (logo, OG images)
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.local                  # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql  # Tables, RLS, triggers, indexes
│   │   ├── 002_storage_buckets.sql # Bucket creation + policies
│   │   └── ...
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── cors.ts
│   │   │   ├── auth.ts
│   │   │   ├── response.ts
│   │   │   ├── supabase.ts
│   │   │   ├── credits.ts
│   │   │   ├── ssrf.ts
│   │   │   └── rate-limit.ts
│   │   ├── scrape-product/index.ts
│   │   ├── confirm-products/index.ts
│   │   ├── upload-product/index.ts
│   │   ├── generate-persona/index.ts
│   │   ├── select-persona-image/index.ts
│   │   ├── generate-video/index.ts
│   │   ├── video-status/index.ts
│   │   ├── generation-history/index.ts
│   │   ├── stripe-checkout/index.ts
│   │   ├── stripe-portal/index.ts
│   │   ├── stripe-webhook/index.ts
│   │   ├── credit-balance/index.ts
│   │   └── delete-account/index.ts
│   └── config.toml
│
├── _bmad/                          # BMAD framework (planning)
├── _bmad-output/                   # Planning artifacts (PRD, architecture)
│
├── .env                            # Local dev: Supabase keys, Stripe test keys
├── .gitignore
└── README.md
```

---

## External API Integration Contracts

### OpenAI (Script Generation)

```typescript
// Used in: generate-video/ Edge Function
// Model: gpt-4o
// Purpose: Generate Hook/Body/CTA ad script

const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a UGC ad scriptwriter. Write short-form video ad scripts in Hook/Body/CTA structure."
      },
      {
        role: "user",
        content: `Product: ${product.name}\nDescription: ${product.description}\nBrand tone: ${brand_summary.tone}\nTarget: ${brand_summary.demographic}\nSelling points: ${brand_summary.selling_points.join(', ')}`
      }
    ],
    response_format: { type: "json_object" }
  }),
});
// Expected output: { hook: { text, duration_seconds }, body: { text, duration_seconds }, cta: { text, duration_seconds } }
```

### NanoBanana (Persona Image Generation)

```typescript
// Used in: generate-persona/, generate-video/ (composite image)
// Purpose: Generate 4 persona images from attribute prompt

const prompt = buildPersonaPrompt(attributes);
// prompt example: "UGC-style portrait photo, female, 25-30 years old, light skin, brown wavy hair, green eyes, athletic build, casual streetwear, gold earrings, looking at camera, natural lighting"

const response = await fetch("https://api.nanobanana.com/v1/generate", {
  method: "POST",
  headers: { Authorization: `Bearer ${NANOBANANA_API_KEY}` },
  body: JSON.stringify({
    prompt,
    num_images: 4,
    style: "photorealistic",
    aspect_ratio: "9:16" // vertical for UGC
  }),
});
// Expected output: { images: [{ url: string }] }
```

### Kling 3.0 (Video Generation)

```typescript
// Used in: generate-video/ (fire job), video-status/ (poll result)
// Purpose: Generate video segment from script + persona image

// Step 1: Submit job
const submitResponse = await fetch("https://api.kling.ai/v1/videos/generate", {
  method: "POST",
  headers: { Authorization: `Bearer ${KLING_API_KEY}` },
  body: JSON.stringify({
    image_url: compositeImageUrl,
    script: segmentText,
    duration: segmentDuration,
    aspect_ratio: "9:16",
    mode: "standard" // or "professional" for Scale tier
  }),
});
// Expected output: { job_id: string, status: "processing" }

// Step 2: Poll status
const statusResponse = await fetch(`https://api.kling.ai/v1/videos/${jobId}`, {
  headers: { Authorization: `Bearer ${KLING_API_KEY}` },
});
// Expected output: { job_id, status: "processing" | "completed" | "failed", video_url?: string }
```

### Stripe

```typescript
// Used in: stripe-checkout/, stripe-webhook/, stripe-portal/
// Standard Stripe Node SDK patterns  -  same as ZeriFlow implementation

// Price IDs (env vars)
// STRIPE_PRICE_STARTER_MONTHLY
// STRIPE_PRICE_GROWTH_MONTHLY
// STRIPE_PRICE_SCALE_MONTHLY
```

---

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Supabase Edge Functions (Secrets)
```
OPENAI_API_KEY=sk-...
NANOBANANA_API_KEY=nb-...
KLING_API_KEY=kl-...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_GROWTH_MONTHLY=price_...
STRIPE_PRICE_SCALE_MONTHLY=price_...
```

---

## Security Architecture

### Authentication
- Supabase Auth handles all auth flows (email/password + Google OAuth)
- JWT tokens issued by Supabase, verified in every Edge Function via `requireUserId()`
- Refresh tokens rotated automatically by Supabase client

### Authorization
- RLS on all tables  -  users can only access their own data
- Subscription tier limits enforced in Edge Functions (persona slots, generation quota)
- Admin role check for future admin endpoints

### Data Protection
- Supabase encrypts at rest (AES-256) and in transit (TLS 1.3)
- Signed URLs for all Storage access (1h expiry)
- No secrets in frontend code  -  only `SUPABASE_URL` and `ANON_KEY` are public

### Input Validation
- URL validation + SSRF protection on scraping endpoint
- Request body validation in every Edge Function
- File upload size limits (product images: 5MB, no executable types)

### Rate Limiting
- Scraping: 10/hr unauthenticated, 60/hr authenticated (NFR11)
- Generation: enforced by credit system (no credits = no generation)
- Stripe webhook: signature verification + idempotency via audit_logs

### Abuse Prevention
- Credit system inherently rate-limits generation
- Free trial: 1 credit (4 videos)  -  prevents bulk abuse
- Unconfirmed scrape data purged after 24h (DR2)

---

## Observability

### Error Tracking
- Sentry captures all unhandled errors in frontend and edge functions
- `supabase/functions/_shared/sentry.ts` exports `captureException(error, context)`
- Environment variables: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`

### Analytics
- DataFast tracks key conversion events (paywall shown, checkout started, credits purchased)
- `frontend/src/lib/datafast.ts` exports typed event functions
- Events: productImported, previewGenerated, scriptGenerated, videoGenerationStarted, paywallShown, checkoutStarted, creditsPurchased, purchaseConfirmed

### Testing
- Unit tests: Vitest (`frontend/vitest.config.ts`)
- E2E tests: Playwright (`playwright.config.ts`)
- CI: GitHub Actions (`.github/workflows/`)

---

## Architecture Validation Results

### Requirements Coverage

| FR Range | Domain | Covered By |
|----------|--------|-----------|
| FR1–FR6 | Product Import & Scraping | `scrape-product/`, `confirm-products/`, `upload-product/`, `products` table |
| FR7–FR10 | Auth & User Management | Supabase Auth, `profiles` table, `settings/` page |
| FR11–FR17 | Persona Creation | `generate-persona/`, `select-persona-image/`, `personas` table, character builder UI |
| FR18–FR26 | Video Generation (Easy Mode) | `generate-video/`, `video-status/`, `generations` table, generation wizard UI |
| FR27–FR30 | Expert Mode (Phase 2) | Deferred  -  `mode` field in generations, UI not in MVP |
| FR31–FR36 | Paywall & Billing | `stripe-checkout/`, `stripe-webhook/`, `credit_balances`, `credit_ledger`, paywall modal |
| FR37–FR38 | Dashboard & Video Library | `generation-history/`, dashboard page, video library UI |

### NFR Coverage

| NFR | Requirement | How Met |
|-----|------------|---------|
| NFR1 | Scraping < 15s | Single Edge Function fetch + parse |
| NFR2 | Persona images < 30s | NanoBanana API call within Edge Function timeout |
| NFR3 | Video segment < 3 min | Kling async  -  not blocked by Edge Function timeout |
| NFR4 | Total generation < 10 min | Parallel segment generation via multiple Kling jobs |
| NFR5 | 50 concurrent jobs | Each job is independent Kling API calls  -  no shared resources |
| NFR6 | 99.5% uptime | Supabase SLA + Vercel SLA |
| NFR7 | Retry on AI failure | Edge Function retries (3x exponential backoff) on Kling/NanoBanana failures |
| NFR9–10 | Encryption at rest + in transit | Supabase default (AES-256 + TLS 1.3) |
| NFR11 | Rate limiting | `rate-limit.ts` shared helper |
| NFR12 | Token expiry | Supabase Auth default token lifecycle |
| NFR13 | No card data stored | Stripe handles all payment data |
| NFR15 | CDN for videos | Supabase Storage CDN + signed URLs |
| NFR16 | DB performance | Indexed queries, RLS optimized |

### Architecture Readiness Assessment

- **Overall Status:** READY FOR IMPLEMENTATION
- **Confidence Level:** High
- **Key Strengths:**
  - Simple 2-service architecture (Vercel + Supabase)
  - All external APIs are fire-and-forget HTTP calls
  - Credit system provides natural rate limiting
  - RLS provides data isolation without custom middleware
- **Known Gaps (acceptable for MVP):**
  - Video stitching (crossfade between segments) may need a simple ffmpeg step  -  evaluate during implementation
  - Email notifications on generation completion (NFR8)  -  defer to Phase 2
  - Expert Mode (FR27–30)  -  deferred by design
