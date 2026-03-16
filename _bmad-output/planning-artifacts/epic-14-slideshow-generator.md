# Epic 14: TikTok Slideshow Generator

**Priority:** P1
**Depends On:** Epic 2 (Auth), Epic 4 (Billing -- credit deduction reuse)
**Status:** ✅ Phase 1 Complete (2026-03-15)
**Stories:** 15 (Phase 1: 12 implemented, Phase 2: 3 planned)
**Estimated Credits Model:** 0 credits (export is client-side ZIP of PNGs, no server rendering)

---

## Overview

A TikTok/Instagram carousel creator integrated into CineRads. Users create 5-slide carousels (Hook + 4 Body/CTA) with AI-generated hooks and body copy via OpenRouter, Pinterest-scraped background images filtered by AI vision, multiple font options (TikTok Sans / DM Sans / Inter), and export as ZIP (1080x1920 PNG per slide). Images are stored on Cloudflare R2 (migrated from Supabase Storage due to 1GB free tier limit vs 2.6GB of scraped images).

**Key Differentiator from UGC Videos:** Slideshows are image-based (no AI video generation, no Kling API). The "secret sauce" is prompt engineering for authentic-sounding copy + visual compositing (image + dark overlay + white text). Much cheaper to produce per unit, enabling higher volume content.

**Core Loop:** Pinterest Scrape -> AI Filter -> Upload to R2 -> AI Generates Copy -> Compose Slideshow -> Export ZIP

**What Changed from Original Plan:**
- Export is **ZIP of PNGs** (not MP4 video) -- simpler, zero server cost, users add audio natively in TikTok/IG
- Storage is **Cloudflare R2** (not Supabase Storage) -- 10GB free, zero egress, public URLs eliminate signed URL overhead
- Images come from **Pinterest scraping pipeline** (not manual uploads or stock APIs) -- automated bulk sourcing with AI quality filtering
- **0 credits** per export (client-side rendering, no server compute)
- Collections UI is **inline in editor** (filmstrip + selector), not separate `/collections` routes
- No `/collections` or `/collections/[id]` routes -- collections managed through editor controls

---

## Implementation Status Summary

| Area | Status | Notes |
|------|--------|-------|
| Database tables (5) | ✅ Done | slideshows, slideshow_hooks, image_collections, collection_images, hook_library, format_instructions |
| Cloudflare R2 storage | ✅ Done | Bucket `cinerads`, public URL, CORS configured |
| Edge Functions (15) | ✅ Done | All deployed with --no-verify-jwt |
| Pinterest scraper pipeline | ✅ Done | scrape -> filter -> upload-to-r2 |
| Slideshow editor | ✅ Done | Full-page editor with preview, controls, export |
| Slideshow library | ✅ Done | Card grid with gallery below editor |
| AI hook generation | ✅ Done | 10 hooks per batch via OpenRouter (gpt-4o) |
| AI body copy generation | ✅ Done | 5 narrative styles, short/long modes |
| ZIP export | ✅ Done | html-to-image + JSZip, 1080x1920 PNGs |
| Auto-populate flow | ✅ Done | Product -> collection matching -> image assignment |
| Quick Publish (TikTok API) | 🔲 Future | Button exists, disabled |
| Video rendering (MP4) | 🔲 Deferred | Slides exported as static PNGs only |
| Undo/redo | 🔲 Future | Not implemented |
| Drag-and-drop reorder | 🔲 Future | Not implemented |

---

## Architecture Overview

### Frontend Architecture

**Pages:**

| Route | Purpose | Key Behaviors |
|-------|---------|---------------|
| `/slideshows` | List page | Card grid (exported + drafts), pagination, floating + button |
| `/slideshows/new` | Create entry point | Creates a new slideshow (5 default slides) and redirects to editor |
| `/slideshows/[id]` | Full-page editor | 100vh editor with gallery below |

**Editor Layout (`SlideshowEditorLayout.tsx`):**
- **Top bar:** Editable name (inline input), status badge, Export ZIP button, Save button
- **Left panel (400px, scrollable):** Product selector, hook selector, slide text editor, generate button, style controls, collection selector
- **Right panel (flex-1, fixed):** PreviewCanvas with all slides in horizontal row

**Key Components:**

1. **`EditorControlPanel.tsx`** -- All editor controls. Contains 2 critical useEffects:
   - Combined product + collection auto-select (fixes race condition where collection was picked before product resolved)
   - Auto-fill images from collection when slides are empty

2. **`PreviewCanvas.tsx`** -- Shows all slides in a row, click to select. Add Slide button uses `getState()` to read fresh store after mutation. Magnify button opens fullscreen modal.

3. **`SlidePreview.tsx`** -- Renders a single slide at variable scale. Three text overlays:
   - **Hook:** White extrabold text, 28% from top (below TikTok UI safe zone)
   - **Body title:** White pill/badge (inline-block div, NOT box-decoration-break) or plain white text
   - **Body subtitle/action:** White text with shadow
   - **Caption style:** tiktok (TikTok Sans), instagram (DM Sans), inter (Inter)
   - Fonts loaded in `layout.tsx` via `next/font/google`

4. **`HookSelector.tsx`** -- Carousel of AI-generated hooks. Arrow buttons auto-apply hook text to slide. "All Hooks" dialog for browsing. "Generate Hooks" creates 10 via edge function.

5. **`GenerateButton.tsx`** -- Short/Long copy toggle. Calls `generate-slide-copy` edge function. Does NOT auto-fire on hook select (user chooses copy length first).

6. **`ExportButton.tsx`** -- Renders each slide at scale=4 (1080x1920) using `createRoot`, captures with `html-to-image` `toPng`, packages as ZIP via JSZip. Converts data URL to blob via `atob()` (bypasses CSP connect-src). try/finally cleanup prevents DOM leaks. `waitForImages()` polls `img.complete` before capture.

7. **`SlideFilmstrip.tsx`** -- Shows collection images in a scrollable strip. Click to assign to selected slide. Upload button for adding custom images.

8. **`SlideshowGallery.tsx`** -- Below-editor gallery showing all user's slideshows. "My Slideshows (N)" header. Cards show hook text overlay, play button. Click navigates to that slideshow's editor. Plus button creates new slideshow.

9. **`ExportedSlideshowCard.tsx`** -- 9:16 card with background image, dark gradient, hook text, play button, exported date badge, Quick Publish button (disabled, future TikTok integration).

**Store (`slideshow-editor.ts` -- Zustand with immer + persist):**

| Behavior | Detail |
|----------|--------|
| `loadSlideshow` | Resets `selectedCollectionId` to null (forces re-matching on every load) |
| `selectedCollectionId` | NOT in partialize (never persisted) -- prevents stale collection from previous session |
| `isDirty` | NOT persisted -- prevents ghost auto-saves |
| `addSlide` | Inserts before last CTA slide, reorders, selects new slide |
| `setProductId` | Separate action (not abusing loadSlideshow) |
| `setStatus` | Does NOT set isDirty (status reflects server state) |
| `applyGeneratedCopy` | Handles overflow: inserts extra slides if model returns more body items than slides exist |

**Hooks:**

| Hook | Purpose | Key Details |
|------|---------|-------------|
| `use-slideshows.ts` | CRUD + list | Returns `{ slideshows, total }` |
| `use-collections.ts` | List collections, collection images, upload, delete | Uses `callEdge` and `callEdgeMultipart`. Image list limit=200 |
| `use-slide-copy.ts` | `useGenerateSlideCopy` mutation | Accepts `copy_length`, `carousel_style` |
| `use-slideshow-hooks.ts` | List hooks, generate hooks | Filtered by product |

**Auto-populate Flow (CRITICAL -- read carefully):**

This is the most complex frontend logic. A single combined useEffect handles the entire chain:

1. Page loads -> `loadSlideshow` resets `selectedCollectionId = null`
2. Combined useEffect waits for BOTH products AND collections to load
3. If no product set and products exist -> auto-selects first product, **returns early**
4. Effect re-fires with productId set -> now runs collection matching
5. Builds `productText` from ALL product fields (name, description, category, brand_summary, store_url)
6. Scores each collection against product keywords (`nicheKeywords` map with `collectionPatterns` + `keywords`)
7. Only score > 0 matches win. Fallback: education -> lifestyle -> first collection.
8. Sets `selectedCollectionId` -> triggers `useCollectionImages` query
9. When `collectionData` loads -> auto-fill effect assigns random unused images to empty slides (Fisher-Yates shuffle, dedup by imageId)

**Why combined effect:** Two separate effects caused a race condition where collection was picked before product loaded. Single effect with early return + re-fire pattern eliminates this.

---

### Backend Architecture

**Supabase Edge Functions (all deployed with `--no-verify-jwt`):**

#### Slideshow CRUD

| Function | Method | Purpose |
|----------|--------|---------|
| `create-slideshow` | POST | Creates with default settings + 5 slides |
| `get-slideshow` | GET | Returns slideshow with R2 public URLs for slide images |
| `update-slideshow` | POST | Updates name/settings/slides/hook_text/exported_at |
| `delete-slideshow` | POST | Deletes slideshow + R2 storage cleanup |
| `list-slideshows` | GET | Returns paginated list with R2 thumbnail URLs |

#### Hook Management

| Function | Method | Purpose |
|----------|--------|---------|
| `generate-slideshow-hooks` | POST | Generates 10 hooks via OpenRouter (gpt-4o) |
| `list-slideshow-hooks` | GET | Returns user's hooks filtered by product |
| `delete-slideshow-hook` | POST | Deletes a hook |
| `list-hook-library` | GET | Returns pre-seeded hook library |

#### Copy Generation

| Function | Method | Purpose |
|----------|--------|---------|
| `generate-slide-copy` | POST | Generates body copy via OpenRouter |

**`generate-slide-copy` details:**
- Extracts number from hook text via `/\b(\d+)\b/` regex
- Cleans product name (strips taglines, HTML entities, pipe separators)
- 5 carousel narrative styles: `tips_list`, `story_arc`, `myth_busting`, `before_after`, `open_loop`
- Two-thirds rule: product mention at ~67% position
- Short vs long copy modes
- Post-generation fallback: injects product name if LLM missed it
- Specificity rules: concrete objects, odd numbers, identity markers

#### Image Collections

| Function | Method | Purpose |
|----------|--------|---------|
| `create-image-collection` | POST | Creates a named collection |
| `list-image-collections` | GET | Returns collections with R2 preview URLs |
| `list-collection-images` | GET | Paginated (limit up to 500), R2 public URLs |
| `upload-collection-image` | POST (multipart) | Uploads to R2 via aws4fetch |
| `delete-collection-image` | POST | Deletes from R2 + DB (owner_id enforced) |
| `delete-image-collection` | POST | Batch deletes all images from R2 |

#### Shared Helpers

| File | Purpose |
|------|---------|
| `_shared/r2.ts` | aws4fetch client singleton, `r2Upload`, `r2Delete`, `r2DeleteMany`, `r2PublicUrl` |
| `_shared/cors.ts` | CORS headers with origin validation |
| `_shared/auth.ts` | Clerk JWT verification, profile resolution |
| `_shared/response.ts` | JSON response helper |
| `_shared/supabase.ts` | Admin client factory |

---

### Database Schema (Actual)

```sql
-- slideshows
CREATE TABLE slideshows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Slideshow',
  status TEXT NOT NULL DEFAULT 'draft',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  video_storage_path TEXT,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  hook_text TEXT,
  exported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- slideshow_hooks
CREATE TABLE slideshow_hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  niche TEXT,
  text TEXT NOT NULL,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- image_collections
CREATE TABLE image_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_count INTEGER DEFAULT 0, -- auto-updated by trigger
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- collection_images
CREATE TABLE collection_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES image_collections(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  content_hash TEXT, -- SHA-256 for dedup
  created_at TIMESTAMPTZ DEFAULT now()
);

-- hook_library (pre-seeded hooks)
CREATE TABLE hook_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  style TEXT,
  description TEXT,
  storage_path TEXT,
  sort_order INTEGER,
  is_active BOOLEAN DEFAULT true
);

-- format_instructions
CREATE TABLE format_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default',
  system_prompt TEXT NOT NULL,
  soft_cta TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Key schema differences from original plan:**
- `owner_id` instead of `user_id` (Clerk auth, not Supabase Auth)
- `slideshows.hook_text` column added (stores the selected hook text directly)
- `slideshows.exported_at` column added (tracks when ZIP was last exported)
- `slideshows.video_duration_seconds` column removed (no video rendering)
- `collection_images.content_hash` column added (SHA-256 dedup)

---

### Storage Architecture (Cloudflare R2)

**Why R2 over Supabase Storage:**
- Supabase free tier: 1GB. We had 2.6GB of scraped images.
- R2 free tier: 10GB with zero egress fees.
- Public URLs eliminate N+1 signed URL calls (Supabase Storage requires per-image signed URL generation).

**Configuration:**

| Setting | Value |
|---------|-------|
| Bucket name | `cinerads` |
| Public URL | `https://pub-a23119cd4be046a2863fe579fc997112.r2.dev` |
| Object key format | `slideshow-images/{userId}/{collectionId}/{filename}` |
| CORS origins | `cinerads.com`, `localhost:3000` |
| CSP headers | `*.r2.dev` in `connect-src` and `media-src` |

**R2 env vars (set as Supabase secrets):**
- `R2_ENDPOINT`
- `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_PUBLIC_URL`

---

### Pinterest Scraper Pipeline

**Location:** `/scripts/pinterest-scraper/`

**Pipeline order:** `scrape` -> `filter` -> `upload-to-r2`

#### Scripts

1. **`scrape.ts`** -- Core Playwright scraper
   - Intercepts Pinterest's `BaseSearchResource` API
   - Falls back to DOM scraping
   - Min dimensions: 600x600
   - Computes SHA-256 content hash
   - Saves `_metadata.json` per image

2. **`bulk-scrape.ts`** -- 13 niches x 5 queries each = 65 queries
   - UGC-style search terms with "iphone", "pov", "faceless", "that girl", "candid"
   - Categories: education, tech, fitness_women, fitness_gym, skincare, luxury, business, coaching, ecommerce, lifestyle, food, travel, finance

3. **`filter-images.ts`** -- AI vision filter via OpenRouter (healer-alpha, free model)
   - Classifies KEEP/REJECT with 1-sentence description
   - Saves `verdict` + `description_ai` + `filtered_at` to `_metadata.json`
   - Moves rejected images to `_rejected/` folder

4. **`upload-to-r2.ts`** -- Uploads to Cloudflare R2 via `@aws-sdk/client-s3`
   - Reads `_metadata.json` for width/height
   - SHA-256 dedup
   - Collection reuse (checks existing name)
   - File-exists guard for concurrent filter

5. **`migrate-to-r2.ts`** -- One-time migration from Supabase Storage to R2
   - Paginated DB fetch (batches of 1000)
   - Searches all category dirs for each filename

---

### Export Pipeline (Client-Side)

The export system renders slides as high-resolution PNGs and packages them in a ZIP:

1. For each slide, `ExportButton.tsx` creates an offscreen DOM container
2. Renders `SlidePreview` at `scale=4` (producing 1080x1920 output) using React's `createRoot`
3. `waitForImages()` polls `img.complete` to ensure all background images are loaded
4. `html-to-image` `toPng` captures the DOM node as a data URL
5. Data URL converted to blob via `atob()` (not `fetch()` -- bypasses CSP `connect-src` restrictions)
6. All blobs packaged into a ZIP via JSZip
7. `try/finally` cleanup on every iteration prevents DOM leaks
8. ZIP auto-downloads to user's device

**Why not MP4:**
- Client-side FFmpeg.wasm rendering is fragile (Safari issues, large WASM binary)
- Users add trending audio natively in TikTok/Instagram anyway
- PNGs give users more flexibility (can use in native TikTok carousel feature)
- Zero server cost

---

## Key Architectural Decisions & Rationale

| # | Decision | Why |
|---|----------|-----|
| 1 | R2 over Supabase Storage | Supabase free tier 1GB, we had 2.6GB. R2 gives 10GB free with zero egress. Public URLs eliminate N+1 signed URL calls. |
| 2 | Combined product+collection useEffect | Two separate effects caused a race condition where collection was picked before product loaded. Single effect with early return + re-fire pattern. |
| 3 | No auto-generate on hook select | Originally auto-generated copy when a hook was clicked. Removed because it silently overwrote manual edits and didn't let users choose short/long first. |
| 4 | Pill as div not inline span | `box-decoration-break: clone` doubled vertical padding on wrapped lines. Switched to a `<div>` wrapper with single background. |
| 5 | Export via createRoot + toPng | Each slide rendered at scale=4 (1080px) in an offscreen container. Uses `atob()` instead of `fetch()` for data URL to blob (CSP bypass). try/finally prevents DOM leaks. |
| 6 | Hook text at 28% from top | Avoids TikTok's status bar, notch, and clock overlay which occupies the top ~20% of the screen. |
| 7 | Fisher-Yates shuffle for image assignment | `Math.random()-0.5` sort is biased. Proper Fisher-Yates ensures uniform distribution. |
| 8 | selectedCollectionId not persisted | Forces re-matching on every load. Prevents stale collection from previous session overriding fresh product-collection matching. |
| 9 | ZIP of PNGs instead of MP4 | Simpler, zero server cost, no FFmpeg.wasm Safari issues, users add audio natively in TikTok/IG. |
| 10 | Pinterest scraping + AI filter | Automated bulk sourcing of UGC-style images. AI vision model (free healer-alpha) filters for quality/relevance. |

---

## Frontend Routes (Actual)

| Route | Purpose | Status |
|-------|---------|--------|
| `/slideshows` | Slideshow list page with card grid | ✅ Implemented |
| `/slideshows/new` | Create + redirect to editor | ✅ Implemented |
| `/slideshows/[id]` | Full-page editor + gallery | ✅ Implemented |
| `/collections` | Standalone collection manager | Not implemented (collections managed in editor) |
| `/collections/[id]` | Standalone collection detail | Not implemented (images shown in editor filmstrip) |

---

## Edge Functions (Actual -- 15 Total for Slideshow)

```
supabase/functions/
├── _shared/r2.ts                   # R2 client, upload, delete, public URL helpers
├── create-slideshow/               # POST: create with default 5 slides
├── get-slideshow/                  # GET: slideshow + R2 public URLs
├── update-slideshow/               # POST: name, settings, slides, hook_text, exported_at
├── delete-slideshow/               # POST: delete + R2 cleanup
├── list-slideshows/                # GET: paginated list + R2 thumbnails
├── generate-slideshow-hooks/       # POST: 10 hooks via OpenRouter (gpt-4o)
├── list-slideshow-hooks/           # GET: hooks filtered by product
├── delete-slideshow-hook/          # POST: delete hook
├── list-hook-library/              # GET: pre-seeded hook library
├── generate-slide-copy/            # POST: body copy, 5 styles, short/long
├── create-image-collection/        # POST: create collection
├── list-image-collections/         # GET: collections + R2 preview URLs
├── list-collection-images/         # GET: paginated images, R2 public URLs
├── upload-collection-image/        # POST (multipart): upload to R2
├── delete-collection-image/        # POST: delete from R2 + DB
└── delete-image-collection/        # POST: batch delete from R2
```

---

## Key Frontend Files

```
frontend/src/
├── app/(dashboard)/slideshows/
│   ├── page.tsx                         # /slideshows list page
│   ├── new/page.tsx                     # /slideshows/new (create + redirect)
│   └── [id]/page.tsx                    # /slideshows/[id] editor
├── components/slideshows/
│   ├── SlideshowEditorLayout.tsx        # Full-page editor layout (top bar + left + right panels)
│   ├── EditorControlPanel.tsx           # Left panel: all controls + auto-populate logic
│   ├── PreviewCanvas.tsx                # Right panel: all slides in horizontal row
│   ├── SlidePreview.tsx                 # Single slide render (image + overlay + text)
│   ├── HookSelector.tsx                 # Hook carousel + generate + all hooks dialog
│   ├── GenerateButton.tsx               # Short/long copy generation trigger
│   ├── ExportButton.tsx                 # ZIP export (html-to-image + JSZip)
│   ├── SlideFilmstrip.tsx               # Collection image strip + upload
│   ├── SlideshowGallery.tsx             # Below-editor gallery of all slideshows
│   └── ExportedSlideshowCard.tsx        # 9:16 card in gallery
├── stores/
│   └── slideshow-editor.ts              # Zustand + immer + persist
├── hooks/
│   ├── use-slideshows.ts                # Slideshow CRUD + list
│   ├── use-collections.ts               # Collection CRUD + images
│   ├── use-slide-copy.ts                # Body copy generation mutation
│   └── use-slideshow-hooks.ts           # Hook list + generation
└── types/
    └── slideshow.ts                     # Slideshow, Slide, SlideType, etc.
```

---

## Stories (Updated with Implementation Status)

---

### Story 14.1: Image Collections -- Database & Edge Functions

**Status:** ✅ Done

Database tables created: `image_collections`, `collection_images`. Edge functions deployed: `create-image-collection`, `list-image-collections`, `delete-image-collection`. Storage moved to Cloudflare R2 (not Supabase Storage bucket). `image_count` maintained via DB trigger on `collection_images` INSERT/DELETE. `content_hash` (SHA-256) added for dedup.

**Deviation from plan:** Uses `owner_id` (Clerk auth) not `user_id` (Supabase Auth). Storage on R2 not Supabase Storage. No per-plan collection limits implemented yet.

---

### Story 14.2: Image Upload & Management

**Status:** ✅ Done

`upload-collection-image` (multipart, uploads to R2 via aws4fetch), `list-collection-images` (paginated, limit up to 500, R2 public URLs), `delete-collection-image` (deletes from R2 + DB, owner_id enforced). SHA-256 content hash stored for dedup.

**Deviation from plan:** No bulk upload (single image per request). No min-dimension validation (Pinterest scraper handles quality). No image metadata extraction server-side.

---

### Story 14.3: Image Collections UI

**Status:** ✅ Done (integrated into editor, not standalone routes)

Collections are managed through the slideshow editor's `EditorControlPanel` and `SlideFilmstrip` components. No standalone `/collections` or `/collections/[id]` routes. Collection selector dropdown in editor left panel. Filmstrip shows collection images in scrollable strip. Upload button in filmstrip for custom images.

**Deviation from plan:** No standalone collection pages. No masonry/grid layout. No drag-and-drop upload zone. No multi-select bulk delete. Collections are a supporting feature of the editor, not a standalone feature.

---

### Story 14.4: AI Hook Generation Engine

**Status:** ✅ Done

`generate-slideshow-hooks` edge function: generates 10 hooks via OpenRouter (gpt-4o). System prompt enforces first-person "I" voice, lowercase, relatable tone, numbered-list format. If `product_id` provided, fetches product context. Generated hooks saved to `slideshow_hooks` table. No credit charge.

`list-slideshow-hooks` returns hooks filtered by product. `delete-slideshow-hook` for cleanup. `list-hook-library` returns pre-seeded hook templates.

**Deviation from plan:** No `format_instruction_id` parameter (format instructions not integrated into hook generation). No configurable count (always 10). No rate limiting on generation requests.

---

### Story 14.5: AI Body Copy Generation Engine

**Status:** ✅ Done

`generate-slide-copy` edge function: accepts `hook_text`, `product_id`, `copy_length` (short/long), `carousel_style`. Returns array of slide text objects. No credit charge.

Implementation features beyond plan:
- 5 narrative styles (tips_list, story_arc, myth_busting, before_after, open_loop)
- Number extraction from hook text via regex
- Product name cleaning (strips taglines, HTML entities, pipe separators)
- Two-thirds rule: product mention at ~67% slide position
- Post-generation fallback: injects product name if LLM missed it
- Specificity rules: concrete objects, odd numbers, identity markers

---

### Story 14.6: Format Instructions Manager

**Status:** ✅ Done (DB + table only, no CRUD UI)

`format_instructions` table created. No dedicated CRUD edge functions or frontend UI for managing format instructions. Format instructions are used internally by copy generation.

**Deviation from plan:** No frontend modal/editor. No "Set as default" toggle. No format instruction selector in editor. This was descoped in favor of the 5 built-in narrative styles in `generate-slide-copy`.

---

### Story 14.7: Slideshow Data Model & CRUD

**Status:** ✅ Done

All 5 CRUD edge functions deployed: `create-slideshow`, `get-slideshow`, `update-slideshow`, `list-slideshows`, `delete-slideshow`. Slideshow settings and slides stored as JSONB. Auto-save with isDirty tracking and manual Save button (not pure auto-save).

**Deviation from plan:** POST method for update/delete (not PUT/DELETE). `hook_text` and `exported_at` added to schema. No `video_duration_seconds` (no video). No per-plan slideshow limits. Manual Save button instead of pure debounced auto-save.

---

### Story 14.8: Slideshow Editor -- Slide Panel & Image Assignment

**Status:** ✅ Done

Full-page editor at `/slideshows/[id]`. Two-panel layout (left controls + right preview), not three-panel. Add slide inserts before last CTA slide. Image assignment via filmstrip click (not collection browser modal). Auto-populate assigns random images from matched collection using Fisher-Yates shuffle.

**Deviation from plan:** Two-panel layout (not three with separate filmstrip). No drag-to-reorder. No "Randomize Images" quick action button (auto-populate handles this). Slide filmstrip is in the left panel, not a separate vertical strip. Collection browser is inline dropdown, not modal.

---

### Story 14.9: Slideshow Editor -- Text Overlay System

**Status:** ✅ Done

Live text preview on slides with real-time rendering. Three caption styles (TikTok Sans, DM Sans, Inter). Text positioning at 28% from top for hooks (TikTok safe zone). Dark overlay on images. Pill/badge styling for body titles. Text shadow for readability.

**Deviation from plan:** Fewer font options (3 vs 4 planned). No per-slide text overrides UI. No font size slider. No text color picker. No overlay opacity slider. No "Apply to all slides" button. No character counter. Styling is consistent across slides via caption style selector.

---

### Story 14.10: Slideshow Editor -- Live Preview & AI Integration

**Status:** ✅ Done (partial)

AI integration fully working: HookSelector with generate + browse + apply. GenerateButton with short/long toggle. Body copy auto-populates slides. Hook bank persists via `slideshow_hooks` table.

**Not implemented from plan:** Live animated preview player (play/pause, auto-advance, progress bar). "Auto-Generate All" quick action. "Reset Text" quick action.

---

### Story 14.11: Slideshow Rendering & Export

**Status:** ✅ Done (ZIP of PNGs, not MP4)

Client-side export using html-to-image + JSZip. Each slide rendered at scale=4 (1080x1920) via createRoot in offscreen container. ZIP auto-downloads. No server-side rendering. No credits charged.

**Major deviation from plan:** ZIP of PNGs instead of MP4 video. No FFmpeg.wasm usage. No server-side rendering. No credit deduction. No rendering progress bar (export is fast). No video upload to storage.

---

### Story 14.12: Slideshow Library Page

**Status:** ✅ Done

`/slideshows` route with card grid. `SlideshowGallery` below editor shows all user's slideshows. `ExportedSlideshowCard` shows 9:16 thumbnail with hook text, exported date badge, Quick Publish button (disabled). Pagination support. "My Slideshows (N)" counter.

**Deviation from plan:** Gallery is also shown below the editor (not just on `/slideshows`). Quick Publish button exists but is disabled. No filter/sort controls. No duplicate action. No inline name editing on cards.

---

## Phase 2 Stories (Not Yet Implemented)

---

### Story 14.13: Stock Photo / Image Sourcing Integration

**Status:** 🔲 Planned (Phase 2)
**Original plan:** Unsplash/Pexels API integration
**Current reality:** Pinterest scraper pipeline handles image sourcing. May still want Unsplash/Pexels for legal compliance (Pinterest scraping is TOS-gray).

---

### Story 14.14: Slideshow Template Library

**Status:** 🔲 Planned (Phase 2)
Pre-made templates by niche. `hook_library` table exists and is seeded but not fully integrated into a template gallery UI.

---

### Story 14.15: Slideshow Automation Engine

**Status:** 🔲 Planned (Phase 2)
Scheduled auto-generation. Depends on TikTok API integration for auto-posting.

---

## Known Issues & Future Work

| Issue | Severity | Notes |
|-------|----------|-------|
| Quick Publish button disabled | Feature gap | Needs TikTok API integration |
| No video rendering | Intentional | PNGs exported, not MP4 |
| No undo/redo in editor | UX gap | Zustand middleware could add this |
| Auto-save fires after manual save | Minor bug | isDirty not always cleared properly |
| No slide drag-and-drop reorder | UX gap | Would need @dnd-kit |
| Collection image filmstrip capped at 200 | Pagination gap | No "load more" in filmstrip |
| No per-plan limits | Business logic gap | Free users not restricted |
| Pinterest scraping is TOS-gray | Legal risk | Consider Unsplash/Pexels migration |

---

## Credit Model Impact (Actual)

| Action | Credit Cost | Notes |
|--------|-------------|-------|
| Hook generation | 0 | Free (OpenRouter call, negligible cost) |
| Body copy generation | 0 | Free (OpenRouter call) |
| Image upload | 0 | Free (R2 storage) |
| Slideshow editing | 0 | Free |
| ZIP export (PNGs) | 0 | Free (client-side rendering, no server compute) |
| MP4 render (future) | TBD | Not implemented |
| Automated slideshow (Phase 2) | TBD | Not implemented |

**Change from plan:** Original plan charged 1 credit per MP4 render. Since export is now client-side ZIP of PNGs, there is zero cost and zero credit charge.

---

## Summary

**Epic 14 Phase 1** is fully implemented as a TikTok/Instagram carousel creator. The implementation diverged from the original plan in several key ways (R2 storage, ZIP export instead of MP4, Pinterest scraper pipeline, integrated collection UI), but delivers the core value proposition: AI-generated hooks + body copy on UGC-style background images, exported as ready-to-post carousel slides.

**New infrastructure added:** 6 database tables, 15 edge functions, 3 routes, ~10 components, 4 hooks, 1 Zustand store, 5 scraper scripts, 1 shared R2 helper module.

**Phase 2** remains planned: stock photo API integration, template library, and automation engine.
