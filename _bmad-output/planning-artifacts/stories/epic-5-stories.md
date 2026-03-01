---
epic: 5
title: 'AI Script & POV Image Generation'
status: 'complete'
frs_covered: ['FR18', 'FR19', 'FR20']
nfrs_addressed: ['NFR7']
depends_on: ['Epic 1 (products)', 'Epic 2 (auth)', 'Epic 3 (persona)', 'Epic 4 (billing)']
architecture_stack: 'Supabase Edge Functions (Deno), Supabase Auth, Supabase Storage, OpenRouter, NanoBanana/Gemini API'
auditDate: '2026-02-28'
---

# Epic 5 - AI Script & POV Image Generation: User Stories [DONE]

## Epic Overview

Users select a product and persona, and the system generates:
1. **AI-written script variants** - 1 or 3 per segment type (hook/body/CTA) via OpenRouter with coherence review pass
2. **POV composite images** - persona holding/using the selected product via NanoBanana/Gemini API (4 options for user selection)

This is the content preparation stage before video generation (Epic 6). All generations follow a **two-phase flow**: script generation first (no credit charge), then user reviews/edits and approves (credits debited on approval).

### Architecture Context

- **Auth:** Supabase Auth (JWT verified in Edge Functions via `requireUserId()`)
- **Backend:** Supabase Edge Functions (Deno runtime)
- **Database:** Supabase PostgreSQL with RLS
- **Storage:** Supabase Storage (private buckets, signed URLs)
- **AI Script:** OpenRouter - two-pass (generation + coherence review)
- **AI Image:** NanoBanana/Gemini API - persona + product composite
- **Credit Model:** 1 credit = $1. Single: 5cr (std) / 10cr (HD). Triple: 15cr (std) / 30cr (HD). Credits charged on approval only.
- **State Management:** Zustand store (`generation-wizard.ts`) with localStorage persistence

---

## [DONE] Story 5.1: Generation Wizard - Product & Persona Selection UI

**As a** signed-in user with confirmed products and a selected persona,
**I want to** walk through a step-by-step wizard to configure my video generation,
**So that** I can select the right product, persona, composite image, and generation settings before generating scripts.

### Acceptance Criteria

1. **Step 1 - Product Selection**: Wizard at `/generate` displays confirmed products in a grid. Inline product import available (URL scrape or manual upload).
2. **Step 2 - Persona Selection**: User picks from active personas with selected images. Link to create new persona if none exist.
3. **Step 3 - Preview (Composite Image)**: Format selection (9:16 or 16:9). Auto-generates 4 composite images via `generate-composite-images/`. User selects preferred composite. Options to edit via natural language prompt or regenerate.
4. **Step 4 - Configure**: Mode (single/triple), quality (standard/HD), CTA style (8 options), Advanced Mode toggle. Shows credit cost summary. Paywall triggers if insufficient credits. "Generate Script" button fires `phase="script"` to `generate-video/`.
5. **Step 5 - Review Script**: Displays AI-generated script. Editable text fields. Variant labels shown. Credits to be charged displayed. "Approve & Generate" button.
6. **Zustand store**: State persisted to localStorage (except `advancedSegments`). `resumeFromGeneration` action hydrates wizard to step 5 from dashboard draft.
7. **Empty states**: CTAs for missing products or personas.
8. **Loading/error states**: Skeletons while fetching. Toast on API errors.

### Implementation Details

- Wizard page: `frontend/src/app/(dashboard)/generate/page.tsx`
- State store: `frontend/src/stores/generation-wizard.ts`
- Result view: `frontend/src/app/(dashboard)/generate/[id]/page.tsx`
- Products/personas fetched via Supabase client (RLS handles access control)
- Credit balance via `credit-balance/` Edge Function

---

## [DONE] Story 5.2: AI Script Generation Edge Function (with Coherence Review)

**As a** system processing a generation request (phase="script"),
**I want to** call OpenRouter to generate script variants with a coherence review pass,
**So that** scripts are high-quality, non-repetitive, and tonally consistent.

### Acceptance Criteria

1. **Two-pass generation**: First pass generates raw scripts via OpenRouter. Second pass (coherence review) scores scripts on non-repetition (0-25), flow (0-25), claim-realism (0-25), cta-fit (0-25). If score < 70, scripts are rewritten. Both passes stored: `script_raw` (pre-review) and `script` (final).
2. **Script structure**: JSON with `hooks[]`, `bodies[]`, `ctas[]`, each containing `{ text, duration_seconds, variant_label }`.
3. **Duration constraints**: Hooks 2-4s, Bodies 5-9s, CTAs 2-4s. Duration auto-calculated from word count at ~2.5 words/sec, then clamped.
4. **Variant count**: Single mode = 1 per type. Triple mode = 3 per type. System prompt adapts angle diversity instructions per count.
5. **Script quality rules**: Conversational first-person tone. Banned buzzwords. Bodies must NOT restate hook's problem. Specific numbers/results preferred.
6. **Product context**: Prompt includes product name, description, price, brand_summary (tone, demographic, selling_points). Price note prevents inappropriate "just $X" phrasing.
7. **Status**: Generation created with `awaiting_approval` status. No credits charged.
8. **Response**: Returns `{ generation_id, status, script, credits_to_charge }`.
9. **Error handling**: If coherence review fails, raw draft is used as final script (graceful degradation). On script generation failure, status set to `failed`.

### Implementation Details

- Edge Function: `supabase/functions/generate-video/index.ts` (phase="script" branch)
- System prompt builder: `buildSystemPrompt(count)` - adapts for single vs triple
- User prompt builder: `buildUserPrompt(product)` - includes calibration instructions
- Validation: `validateScript()` enforces structure + duration clamping
- Shared utilities: `_shared/openrouter.ts`, `_shared/retry.ts`

---

## [DONE] Story 5.3: POV Composite Image Generation (Separate Edge Functions)

**As a** user in wizard step 3,
**I want to** see composite preview images of my persona with my product and choose my preferred one,
**So that** the video segments use the best possible starting frame.

### Acceptance Criteria

1. **4 composite previews**: `generate-composite-images/` generates 4 options using Gemini via NanoBanana with staggered requests to avoid rate limits.
2. **User selection**: User selects preferred composite in wizard step 3. Path stored in `compositeImagePath` wizard state.
3. **Format support**: 9:16 (portrait) or 16:9 (landscape) passed to composite generation.
4. **Edit capability**: User can edit selected composite via natural language prompt using `edit-composite-image/`. Max 500 char prompt. Returns new image (non-destructive - original preserved).
5. **Per-segment composites (Advanced Mode)**: `generate-segment-composite/` generates 1 composite for per-segment customization. Supports `custom_scene_prompt`. Used when Advanced Mode is enabled.
6. **Storage**: All composites uploaded to `composite-images` Storage bucket under `{user_id}/` path. Signed URLs with appropriate expiry (2h for Advanced Mode session).
7. **Security**: User-owned path validation on all composite operations.

### Implementation Details

- Edge Functions: `generate-composite-images/`, `generate-segment-composite/`, `edit-composite-image/`
- NanoBanana utilities: `_shared/nanobanana.ts` (`generateCompositeFromImages`, `editCompositeFromReference`)
- Product images resolved from Storage or HTTP URLs
- Persona image signed from `persona-images` bucket

---

## [DONE] Story 5.4: Script Generation Retry & Error Recovery

**As the** system,
**I want to** retry AI API calls on failure and recover gracefully,
**So that** transient errors don't result in failed generations.

### Acceptance Criteria

1. **Retry logic**: `_shared/retry.ts` provides `withRetry()` with exponential backoff. Used for OpenRouter and NanoBanana calls.
2. **Graceful degradation**: If coherence review pass fails, raw script draft is used (not a hard failure).
3. **Status on failure**: If script generation fails after retries, generation status set to `failed` with error message.
4. **No credit loss**: Script generation phase charges 0 credits. No refund needed on failure.
5. **Error messages**: User-friendly error in response body. Detailed error logged server-side.

### Implementation Details

- Retry utility: `supabase/functions/_shared/retry.ts`
- Used by: `generate-video/`, `generate-composite-images/`, `generate-segment-composite/`, `edit-composite-image/`, `regenerate-segment/`

---

## [DONE] Story 5.5: Generation Status Tracking (+ Progress UI)

**As a** user who initiated a generation,
**I want to** see real-time progress of my generation and know when it's ready,
**So that** I can track the pipeline status.

### Acceptance Criteria

1. **Progress page**: `/generate/[id]` shows generation status with visual progress indicator.
2. **Status polling**: Frontend polls `video-status/` Edge Function. Returns status, progress count, segment data.
3. **Status transitions displayed**: `awaiting_approval` (script review) -> `locking` -> `submitting_jobs` -> `generating_segments` (with segment count progress) -> `completed`.
4. **Auto-advance**: Page updates when generation completes, showing video results.
5. **Error state**: Failed generation shows error message with retry option.
6. **Composite image preview**: POV composite image displayed alongside progress/results.
7. **Polling stops**: When status is `completed` or `failed`.

### Implementation Details

- Progress page: `frontend/src/app/(dashboard)/generate/[id]/page.tsx`
- Status endpoint: `supabase/functions/video-status/index.ts`

---

## [DONE] Story 5.6: Script Review & Approval Step

**As a** user,
**I want to** review and edit the AI-generated scripts before any credits are charged,
**So that** I have full control over the creative content and only pay when I'm satisfied.

### Acceptance Criteria

1. **Script display**: Wizard step 5 shows all generated scripts organized by type (hooks, bodies, CTAs). Variant labels (hook angle, body structure, CTA pattern) displayed for context.
2. **Inline editing**: Each segment text is editable via text fields. User can modify wording before approving.
3. **Cost display**: Credits to be charged shown prominently. First-video discount reflected if applicable.
4. **Approve action**: "Approve & Generate" button sends `generation_id` + optional `override_script` (if user edited any segments) to `generate-video/`.
5. **Atomic locking**: On approval, status transitions `awaiting_approval` -> `locking` via single UPDATE with WHERE clause (`eq("status", "awaiting_approval")`). This prevents concurrent double-approvals.
6. **Insufficient credits**: If user's balance dropped since script was generated, returns 402 with `first_video_discount` and `effective_cost` info. Status reverts to `awaiting_approval` so user can top up and retry.
7. **Credit debit**: Credits debited only after successful lock acquisition. First-video discount applied as `ceil(cost/2)`.
8. **First-video tracking**: `profiles.first_video_discount_used` set to `true` on successful debit. Reverted to `false` if pipeline fails.
9. **Draft resume**: `resumeFromGeneration` action in wizard store hydrates step 5 with existing generation data (id, script, creditsToCharge, productId, personaId, mode, quality). Dashboard links to awaiting_approval generations trigger this.
10. **Override script validation**: If user edited scripts, `override_script` is validated against expected variant count before saving.

### Status Flow

```
awaiting_approval  ->  locking  ->  submitting_jobs  ->  generating_segments
                                          |
                                          v
                                    Credits debited
                                    Kling jobs submitted
```

### Implementation Details

- Approval handler: `supabase/functions/generate-video/index.ts` (generation_id branch)
- Wizard state: `updateScriptSection()` for inline editing, `setPendingScript()` to set review data
- Store persistence: `pendingGenerationId`, `pendingScript`, `creditsToCharge` persisted to localStorage
- Credit operations: `_shared/credits.ts` (`checkCredits`, `debitCredits`, `refundCredits`)

---

## Story Dependencies & Execution Order

```
Story 5.2 (Script Gen)  ──────────┐
                                    ├──> Story 5.6 (Review & Approval)
Story 5.3 (Composite Images)  ────┘           |
                                              v
Story 5.1 (Wizard UI) ──────────────> Story 5.5 (Progress UI)
                                              ^
Story 5.4 (Retry Logic)  ────────────────────┘
```

**All stories complete as of 2026-02-28.**

---

## Database Schema (Epic 5 Relevant)

### `generations` table columns used

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Primary key |
| `owner_id` | UUID | FK to auth.users |
| `product_id` | UUID | FK to products |
| `persona_id` | UUID | FK to personas |
| `mode` | TEXT | `single` or `triple` |
| `video_quality` | TEXT | `standard` or `hd` |
| `status` | TEXT | CHECK constraint with 8 valid values |
| `composite_image_url` | TEXT | Storage path (not a URL despite column name) |
| `script` | JSONB | Final script (post-coherence-review) |
| `script_raw` | JSONB | Raw script (pre-coherence-review) |
| `external_job_ids` | JSONB | Kling job ID map |
| `kling_model` | TEXT | Actual Kling model used |
| `error_message` | TEXT | Error details on failure |
| `started_at` | TIMESTAMPTZ | Generation start time |
| `completed_at` | TIMESTAMPTZ | Generation completion time |
