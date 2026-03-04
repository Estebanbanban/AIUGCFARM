---
epic: 7
title: 'User Dashboard & Video Library'
status: 'complete'
frs_covered: ['FR37', 'FR38']
nfrs_addressed: ['NFR16']
depends_on: ['Epic 2 (auth)', 'Epic 6 (video generation)']
architecture_stack: 'Next.js App Router, Supabase Edge Functions (Deno), Supabase PostgreSQL, TanStack React Query, Zustand'
auditDate: '2026-03-03'
---

# Epic 7 - User Dashboard & Video Library: User Stories [DONE]

## Epic Overview

Returning users access their account through the dashboard, view generation history, browse their video library, and re-download completed segments. The dashboard also serves as the hub for resuming draft generations and navigating to new generation workflows.

### Architecture Context

- **Auth:** Supabase Auth (JWT verified in Edge Functions via `requireUserId()`)
- **Backend:** Supabase Edge Functions (Deno runtime)
- **Database:** Supabase PostgreSQL with RLS (`generations`, `credit_balances`, `profiles`)
- **Data Fetching:** TanStack React Query for caching and stale-while-revalidate
- **State Management:** Zustand store for wizard resume (`generation-wizard.ts`)
- **Storage:** Supabase Storage (signed URLs for video/image access)
- **Credit Model:** `credit-balance/` returns remaining credits, plan name, admin unlimited flag

---

## [DONE] Story 7.1: Dashboard Overview

**As a** returning user,
**I want to** see an account overview when I log in,
**So that** I can quickly check my credits, see recent generations, and start new work.

### Acceptance Criteria

1. **Route**: Dashboard at `/dashboard`. Default landing page for authenticated users.
2. **Credit balance**: Displays remaining credits via `credit-balance/` Edge Function. Shows plan name (Free/Starter/Growth/Scale). Admin users see "Unlimited" badge (`is_unlimited: true`).
3. **Recent generations**: Shows latest generations with status badges (`awaiting_approval`, `generating_segments`, `completed`, `failed`). Limited to most recent ~5 entries.
4. **Quick actions**: Prominent buttons for "New Generation" (→ `/generate`) and "New Persona" (→ `/personas/new`).
5. **Draft resume**: Clicking an `awaiting_approval` generation card hydrates the wizard to step 5 via `resumeFromGeneration(generationId)` action in Zustand store. Navigates to `/generate` with script review pre-loaded.
6. **Post-purchase detection**: If URL contains `?checkout=success&plan=X` or `&pack=X`, triggers `PurchaseSuccessModal` with confetti animation and plan-specific benefits copy. URL cleaned via `router.replace()` after detection.
7. **Empty state**: First-time users see welcome message with CTA to import products and create persona.
8. **Loading state**: Skeleton cards while data loads.

### Implementation Details

- Page: `frontend/src/app/(dashboard)/dashboard/page.tsx`
- Credit balance hook: TanStack React Query wrapping `credit-balance/` Edge Function
- Recent generations: Supabase client query with RLS (or `generation-history/` with `limit=5`)
- Purchase modal: `frontend/src/components/checkout/PurchaseSuccessModal.tsx`
- Wizard resume: `frontend/src/stores/generation-wizard.ts` - `resumeFromGeneration()` action

---

## [DONE] Story 7.2: Generation History List

**As a** user,
**I want to** browse my full generation history,
**So that** I can find past generations, check their status, and access completed videos.

### Acceptance Criteria

1. **Route**: History page at `/history`.
2. **Data source**: `generation-history/` Edge Function returns paginated results with product and persona joins.
3. **Display**: Each entry shows:
   - Product name and thumbnail
   - Persona name and image
   - Generation mode (single/triple) and quality (standard/HD)
   - Status badge with color coding
   - Created timestamp (relative, e.g., "2 hours ago")
4. **Status badges**:
   - `awaiting_approval` → Yellow "Draft" badge (clickable → resume wizard)
   - `generating_segments` → Blue "Generating" badge with spinner
   - `completed` → Green "Completed" badge
   - `failed` → Red "Failed" badge
5. **Pagination**: Paginated results. Default 20 per page. Ordered by `created_at DESC`.
6. **Click action**: Clicking a completed generation navigates to `/generate/[id]` (segment review page).
7. **Empty state**: "No generations yet" with CTA to create first video.

### Implementation Details

- Page: `frontend/src/app/(dashboard)/history/page.tsx`
- Edge Function: `supabase/functions/generation-history/index.ts`
- Request: `GET ?page=1&limit=20`
- Response: `{ generations: Generation[], total: number }`
- Joins: Product name/image and persona name/image included in response

### Edge Function Details

- **Function**: `supabase/functions/generation-history/index.ts`
- **Method**: GET
- **Auth**: Required (`requireUserId()`)
- **Query params**: `page` (default 1), `limit` (default 20)
- **Response**: `{ data: { generations, total, page, limit } }`
- **Query**: Joins `products` and `personas` tables. Filters by `owner_id`. Orders by `created_at DESC`.

---

## [DONE] Story 7.3: Video Library - Re-download

**As a** user,
**I want to** re-download past video segments from completed generations,
**So that** I can access my content at any time without regenerating.

### Acceptance Criteria

1. **Access**: Clicking a completed generation in history or dashboard navigates to `/generate/[id]`.
2. **Fresh signed URLs**: Each visit generates fresh signed URLs for all video segments via `video-status/` Edge Function. URLs have 1-hour expiry.
3. **Segment display**: Segments organized by type (Hooks, Bodies, CTAs). Each segment playable via embedded video player.
4. **Download button**: Per-segment download button. Downloads MP4 file via signed URL.
5. **Metadata**: Shows generation settings (mode, quality, CTA style), product name, persona name.
6. **Regeneration access**: Regenerate button per segment (Story 6.9) available on completed generations.
7. **Status handling**: If generation is still in progress (`generating_segments`), shows progress UI instead of download. If failed, shows error message with retry option.

### Implementation Details

- Page: `frontend/src/app/(dashboard)/generate/[id]/page.tsx`
- Data source: `video-status/` Edge Function (returns status, segments, signed URLs)
- Video player: Custom video player component with download trigger
- Signed URLs: Generated server-side by `video-status/` from Supabase Storage paths

---

## Story Dependencies

```
Story 7.1 (Dashboard) ──> Depends on credit-balance/ (Epic 4), generation data (Epic 6)
                      └──> PurchaseSuccessModal (Story 4.8)
                      └──> resumeFromGeneration (Story 5.6)

Story 7.2 (History) ──> Depends on generation-history/ Edge Function, product/persona data

Story 7.3 (Re-download) ──> Depends on video-status/ (Story 5.5/6.2), signed URLs
                         └──> Regeneration UI (Story 6.9)
```

**All stories complete as of 2026-02-28.**

---

## Key Components

| Component | Story | Purpose |
|-----------|-------|---------|
| Dashboard page | 7.1 | Account overview, credit balance, recent generations |
| `PurchaseSuccessModal` | 7.1 | Post-checkout celebration with confetti |
| History page | 7.2 | Full generation history with pagination |
| Generation result page | 7.3 | Segment review, playback, and download |
| `resumeFromGeneration()` | 7.1 | Wizard hydration for draft generations |
