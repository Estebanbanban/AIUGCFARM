---
epic: 5
title: 'AI Script & POV Image Generation'
status: 'planned'
frs_covered: ['FR18', 'FR19', 'FR20']
nfrs_addressed: ['NFR7']
depends_on: ['Epic 1 (products)', 'Epic 2 (auth)', 'Epic 3 (persona)']
architecture_stack: 'Supabase Edge Functions (Deno), Supabase Auth, Supabase Storage, OpenAI GPT-4o, NanoBanana API'
---

# Epic 5 — AI Script & POV Image Generation: User Stories

## Epic Overview

Users select a product and persona, and the system generates:
1. **AI-written script variants** — 3 hooks, 3 bodies, 3 CTAs (9 total) via OpenAI GPT-4o
2. **POV composite image** — persona holding/using the selected product via NanoBanana API

This is the content preparation stage before video generation (Epic 6). It is independently testable — script quality and POV image compositing can be validated without the video pipeline.

### Architecture Context (Supabase-centric)

- **Auth:** Supabase Auth (JWT verified in Edge Functions via `requireUserId()`)
- **Backend:** Supabase Edge Functions (Deno runtime, ~60s timeout)
- **Database:** Supabase PostgreSQL with RLS
- **Storage:** Supabase Storage (private buckets, signed URLs)
- **AI Script:** OpenAI API (GPT-4o) — structured JSON output
- **AI Image:** NanoBanana API — persona + product composite
- **Credit Model:** 1 credit = 1 segment. A full batch = 9 segments = 9 credits.

---

## Story 5.1: Generation Wizard — Product & Persona Selection UI

**As a** signed-in user with confirmed products and a selected persona,
**I want to** select a product and persona from my library and initiate Easy Mode generation,
**So that** I can start generating video ad content for a specific product with my chosen AI spokesperson.

### Functional Requirements

- FR18: Users can select a product from their library and initiate one-click video generation (Easy Mode)

### Acceptance Criteria

1. **Product selector**: Generation wizard page (`app/(app)/generate/page.tsx`) displays a grid of the user's confirmed products (name, primary image, price). Only `confirmed = true` products shown.
2. **Persona selector**: After product selection, user picks from their active personas (thumbnail, name). Only personas with `selected_image_url != null` are selectable.
3. **Credit check (frontend)**: Before allowing generation, fetch credit balance via `credit-balance/` Edge Function. Display remaining credits. If `remaining < 9`, show insufficient credits message with upgrade CTA.
4. **Generation confirmation**: Confirm modal shows: selected product name, selected persona thumbnail, cost (9 segment credits), remaining balance after generation.
5. **Generate button**: On confirm, calls `generate-batch/` Edge Function with `{ product_id, persona_id, mode: 'easy' }`. Redirects to generation status page (`app/(app)/generate/[id]/page.tsx`).
6. **Empty states**: If no confirmed products → "Import a product first" CTA linking to products page. If no personas → "Create a persona first" CTA linking to persona creator.
7. **Loading states**: Skeleton loading for product/persona grids while fetching.
8. **Error handling**: Toast on API errors. Disabled generate button while request in-flight.

### Technical Tasks

| # | Task | Details |
|---|------|---------|
| 1 | Create `app/(app)/generate/page.tsx` | Generation wizard page with step-by-step flow |
| 2 | Build `ProductSelector` component | Grid of confirmed products. Fetch via Supabase client with RLS. Click to select. |
| 3 | Build `PersonaSelector` component | Grid of active personas with selected images. Click to select. |
| 4 | Build `GenerationConfirmModal` component | Confirm dialog showing product, persona, credit cost (9), balance after. |
| 5 | Add `useCredits` hook | Fetch credit balance from `credit-balance/` Edge Function. Cache with SWR/React Query. |
| 6 | Add `useProducts` hook | Fetch confirmed products for current user via Supabase client. |
| 7 | Add `usePersonas` hook | Fetch active personas for current user via Supabase client. |
| 8 | Wire up generate action | POST to `generate-batch/` Edge Function. Handle response (generation_id). Redirect to status page. |
| 9 | Unit tests | Test component rendering, selection state, credit check logic, empty states |

### Dependencies

- Epic 1 (products table populated with confirmed products)
- Epic 2 (Supabase Auth — user must be signed in)
- Epic 3 (personas table populated with selected persona images)
- Epic 4 (credit_balances table — credit check)

### Dev Notes

- Products and personas can be fetched directly from Supabase client (RLS handles access control), no need for dedicated Edge Functions for reads.
- Credit balance requires Edge Function since it may need to aggregate across ledger entries.
- The generate wizard is at `app/(app)/generate/page.tsx`, the result view at `app/(app)/generate/[id]/page.tsx`.

---

## Story 5.2: AI Script Generation Edge Function

**As a** system processing an Easy Mode generation request,
**I want to** call OpenAI GPT-4o to generate 9 script variants (3 hooks, 3 bodies, 3 CTAs) for the selected product,
**So that** each segment type has multiple creative options tuned to the product's brand tone and selling points.

### Functional Requirements

- FR19: System generates multiple AI-written script variants per segment type: 3 Hook variants (3–5s each), 3 Body variants (5–10s each), and 3 CTA variants (3–5s each), tuned to the product's scraped description and brand tone

### Acceptance Criteria

1. **Structured output**: OpenAI call uses `response_format: { type: "json_object" }` and returns exactly:
   ```json
   {
     "hooks": [
       { "text": "...", "duration_seconds": 5, "variant_label": "curiosity" },
       { "text": "...", "duration_seconds": 4, "variant_label": "pain-point" },
       { "text": "...", "duration_seconds": 5, "variant_label": "social-proof" }
     ],
     "bodies": [
       { "text": "...", "duration_seconds": 8, "variant_label": "benefits" },
       { "text": "...", "duration_seconds": 10, "variant_label": "demo" },
       { "text": "...", "duration_seconds": 7, "variant_label": "testimonial" }
     ],
     "ctas": [
       { "text": "...", "duration_seconds": 4, "variant_label": "urgency" },
       { "text": "...", "duration_seconds": 3, "variant_label": "fomo" },
       { "text": "...", "duration_seconds": 5, "variant_label": "offer" }
     ]
   }
   ```
2. **Duration constraints**: Hooks 3–5s, Bodies 5–10s, CTAs 3–5s. Validate in Edge Function. If any segment exceeds limits, clamp to max.
3. **Prompt diversity**: Each variant within a type uses a different persuasion angle (specified via `variant_label`). The system prompt instructs GPT-4o to vary the creative approach.
4. **Product context**: Prompt includes: product name, description, price, brand_summary (tone, demographic, selling_points).
5. **Script saved to DB**: Script JSON stored in `generations.script` column as JSONB.
6. **Status update**: Generation status updated to `'scripting'` before the call, `'script_ready'` after successful completion.
7. **Error handling**: On OpenAI API failure, retry up to 3 times with exponential backoff (1s, 2s, 4s). On final failure, set generation status to `'failed'` with error message.
8. **Response validation**: Validate the JSON structure returned by OpenAI. If malformed, retry once with a stricter prompt.

### Technical Tasks

| # | Task | Details |
|---|------|---------|
| 1 | Create `generate-script/` Edge Function | Standalone function for script generation. Called by orchestrator or directly. |
| 2 | Build system prompt | UGC ad scriptwriter prompt. Includes segment structure, duration constraints, persuasion angle diversity, brand tone instructions. |
| 3 | Build user prompt template | Template that inserts product name, description, price, brand_summary fields. |
| 4 | OpenAI API integration | `fetch()` call to `https://api.openai.com/v1/chat/completions` with model `gpt-4o`, structured JSON output. |
| 5 | Response validation | Validate returned JSON matches expected schema (3 hooks, 3 bodies, 3 CTAs, each with text + duration_seconds). |
| 6 | Duration clamping | Post-process: clamp hook durations to [3,5], body to [5,10], CTA to [3,5]. |
| 7 | Retry logic | 3 attempts with exponential backoff. Shared retry utility in `_shared/retry.ts`. |
| 8 | DB updates | Update `generations` table: set script JSONB, update status. Use `service_role` client. |
| 9 | Unit tests | Test prompt building, response validation, duration clamping, retry logic. Mock OpenAI API. |

### System Prompt (Draft)

```
You are an expert UGC (User-Generated Content) ad scriptwriter for e-commerce brands.

Generate video ad scripts in a first-person, casual, authentic tone — as if a real person is speaking directly to camera about a product they genuinely love.

For each script, write SPOKEN DIALOGUE ONLY. No stage directions, no camera notes, no scene descriptions. Just the words the person says.

Structure:
- 3 HOOK variants (3-5 seconds each): Opening lines that stop the scroll. Each uses a DIFFERENT persuasion angle.
- 3 BODY variants (5-10 seconds each): Product benefits and proof. Each uses a DIFFERENT angle.
- 3 CTA variants (3-5 seconds each): Urgency-driven close. Each uses a DIFFERENT angle.

Persuasion angles to vary across variants:
- Hooks: curiosity, pain-point, social-proof, controversy, storytelling
- Bodies: benefits-focused, demo-style, testimonial, before-after, problem-solution
- CTAs: urgency, FOMO, special-offer, guarantee, social-proof

Duration guideline: ~2.5 words per second of speech.

Return valid JSON only.
```

### Dependencies

- OpenAI API key configured as Supabase Edge Function secret (`OPENAI_API_KEY`)
- `generations` table exists with `script` JSONB column and `status` field
- Product record with `brand_summary` JSONB populated (from Epic 1 scraping)

### Dev Notes

- Edge Function timeout is ~60s. OpenAI GPT-4o typically responds in 5-15s for structured output. Well within limits.
- The `variant_label` field is metadata for the frontend — helps users understand the creative angle of each variant.
- Consider caching the system prompt as a constant, not rebuilding each time.
- The script generation can be called independently from the image generation — they have no dependency on each other.

---

## Story 5.3: POV Composite Image Generation

**As a** system processing an Easy Mode generation request,
**I want to** call NanoBanana API to generate a composite POV-style image of the persona holding/using the selected product,
**So that** each video segment has a consistent starting frame showing the AI persona with the product.

### Functional Requirements

- FR20: System generates a composite POV-style image of the persona holding/using the selected product

### Acceptance Criteria

1. **Composite prompt**: Build a prompt that combines the persona's visual attributes with the product context. Example: "UGC-style POV photo, [persona description from attributes], holding [product name], [product context], natural lighting, vertical 9:16 format, looking at camera"
2. **NanoBanana API call**: POST to NanoBanana with prompt, `num_images: 1`, `style: "photorealistic"`, `aspect_ratio: "9:16"`.
3. **Image constraints**: Output image must be usable as Kling image-to-video start frame: min 300px on each side, max 10MB, aspect ratio between 1:2.5 and 2.5:1 (9:16 = 0.5625, within range).
4. **Upload to Storage**: Download the generated image from NanoBanana URL and upload to Supabase Storage `composite-images` bucket under path `{user_id}/{generation_id}/composite.png`.
5. **Signed URL**: Generate a signed URL (1h expiry) for the uploaded image. Store URL in `generations.composite_image_url`.
6. **Status update**: Generation status updated to `'generating_image'` before the call, `'image_ready'` after successful upload.
7. **Error handling**: On NanoBanana API failure, retry up to 3 times with exponential backoff. On final failure, set generation status to `'failed'`.
8. **Persona reference**: Use the persona's `selected_image_url` as a reference input if NanoBanana supports image-to-image (to maintain persona consistency). Otherwise, use the persona's `attributes` JSONB to reconstruct the visual prompt.

### Technical Tasks

| # | Task | Details |
|---|------|---------|
| 1 | Create `generate-composite/` Edge Function | Standalone function for composite image generation. |
| 2 | Build composite prompt builder | Function that takes persona attributes + product data → NanoBanana prompt string. |
| 3 | NanoBanana API integration | `fetch()` call to NanoBanana API. Handle response (image URL). |
| 4 | Image download + Supabase Storage upload | Download from NanoBanana URL, upload to `composite-images/{user_id}/{generation_id}/composite.png`. |
| 5 | Signed URL generation | Generate signed URL with 1h expiry via Supabase Storage API. |
| 6 | DB updates | Update `generations` table: set `composite_image_url`, update status. |
| 7 | Retry logic | Reuse `_shared/retry.ts` from Story 5.2. |
| 8 | Unit tests | Test prompt building, API call mocking, storage upload, error handling. |

### Composite Prompt Template (Draft)

```
UGC-style POV photo taken on iPhone.
Subject: {persona_description} — {gender}, {age_range} years old, {skin_tone} skin,
{hair_color} {hair_style} hair, {eye_color} eyes, {body_type} build,
wearing {clothing_style}, {accessories}.
Action: Holding/using {product_name} — {product_description_short}.
Setting: Casual home/lifestyle environment.
Style: Natural lighting, slightly warm tones, authentic feel.
Format: Vertical 9:16, close-up to mid-shot, subject looking at camera.
```

### Dependencies

- NanoBanana API key configured as Supabase Edge Function secret (`NANOBANANA_API_KEY`)
- Supabase Storage bucket `composite-images` created (private)
- `generations` table with `composite_image_url` column
- Persona record with `selected_image_url` and `attributes` populated (Epic 3)
- Product record with `name`, `description`, `images` populated (Epic 1)

### Dev Notes

- NanoBanana API response time is typically 10-25s — within Edge Function timeout.
- The composite image is the starting frame for ALL video segments in this generation. It is generated once and reused across all 9 segments.
- Store the permanent composite image URL (Supabase Storage path), not the signed URL. Signed URLs are regenerated on access.
- If NanoBanana supports an image reference input (pass persona's selected image), use it for better persona consistency. If not, the text prompt must be detailed enough.

---

## Story 5.4: Generation Batch Orchestration Edge Function

**As a** system,
**I want to** orchestrate the full Easy Mode generation pipeline (credit check → debit → script generation → composite image → hand off to video pipeline),
**So that** the user's generation request is processed end-to-end with proper status tracking, credit management, and error recovery.

### Functional Requirements

- FR18: Users can select a product from their library and initiate one-click video generation (Easy Mode)
- FR19: Script generation (orchestrated)
- FR20: POV image generation (orchestrated)
- NFR7: Retry on AI provider failure

### Acceptance Criteria

1. **Credit validation**: Before starting, verify `credit_balances.remaining >= 9` (cost of 1 full batch). If insufficient, return 402 with `{ detail: "Insufficient credits. Need 9, have {remaining}." }`.
2. **Credit debit**: Reserve 9 credits immediately via `credit_ledger` entry (`amount: -9, reason: 'generation'`). Decrement `credit_balances.remaining` by 9.
3. **Generation record**: Create new row in `generations` table with status `'pending'`, product_id, persona_id, mode `'easy'`.
4. **Parallel execution**: Script generation and composite image generation run in parallel (both are independent). Use `Promise.all()` or `Promise.allSettled()`.
5. **Status progression**: `pending` → `scripting` (script + image in parallel) → `content_ready` (both done) → hand off to Epic 6.
6. **Fast return**: Return `{ generation_id, status: 'scripting' }` to the frontend within 2-3 seconds. Script and image generation continue in the same Edge Function invocation (within timeout).
7. **Error recovery**: If either script or image fails after retries:
   - Set generation status to `'failed'` with error message
   - Refund 9 credits via `credit_ledger` entry (`amount: +9, reason: 'refund'`)
   - Increment `credit_balances.remaining` by 9
8. **Idempotency**: Include `external_task_id` check — if same product_id + persona_id generation is already in progress, return existing generation_id.
9. **Auth**: Require authenticated user via `requireUserId()`. Verify user owns the product and persona via RLS queries.
10. **Audit log**: Log generation event in `audit_logs` table.

### Technical Tasks

| # | Task | Details |
|---|------|---------|
| 1 | Create `generate-batch/` Edge Function | Main orchestrator. Handles the full flow from credit check to content_ready. |
| 2 | Implement credit check + debit | Use `_shared/credits.ts`: `checkCredits(userId, 9)` and `debitCredits(userId, 9, generationId)`. |
| 3 | Create generation record | Insert into `generations` table with initial status. Return generation_id immediately. |
| 4 | Parallel script + image calls | Call `generate-script/` and `generate-composite/` logic in parallel (either as function calls or inline). |
| 5 | Status state machine | Helper function for valid status transitions. Prevent invalid transitions. |
| 6 | Credit refund on failure | If generation fails, issue refund via credit_ledger + update credit_balances. |
| 7 | Audit logging | Log to `audit_logs` table with action `'generation'`, metadata includes product_id, persona_id, credits_used. |
| 8 | Integration tests | Test full flow: credit check → debit → script + image → status updates. Test failure + refund flow. |

### Edge Function Flow

```
POST /functions/v1/generate-batch
Authorization: Bearer {jwt}
Body: { product_id: string, persona_id: string, mode: "easy" }

1. requireUserId(req) → userId
2. Verify ownership: product.owner_id = userId, persona.owner_id = userId
3. checkCredits(userId, 9) → if < 9, return 402
4. debitCredits(userId, 9, 'generation')
5. INSERT INTO generations → generation_id
6. UPDATE generations SET status = 'scripting'
7. Promise.all([
     generateScript(generation_id, product, brandSummary),
     generateComposite(generation_id, persona, product)
   ])
8. On success: UPDATE generations SET status = 'content_ready'
9. On failure: UPDATE generations SET status = 'failed', refund credits
10. Return { data: { generation_id, status } }
```

### Status State Machine

```
pending → scripting → content_ready → generating_video (Epic 6)
                    → failed (with credit refund)
```

### Dependencies

- `_shared/credits.ts` helpers (Epic 4 or built here)
- `_shared/auth.ts` for `requireUserId()`
- Stories 5.2 and 5.3 (script + composite logic, can be inline or separate functions)
- `generations` table with updated status enum

### Dev Notes

- The Edge Function timeout is ~60s. OpenAI (5-15s) + NanoBanana (10-25s) in parallel = ~25s max. Well within limits.
- The "fast return" in AC #6 is aspirational — since Edge Functions are request/response, the full pipeline runs before returning. If we need true async behavior, the frontend polls `video-status/` (Epic 6). For Epic 5, the response returns when scripts + composite are ready.
- Credit debit is optimistic (debit first, refund on failure). This prevents race conditions where two concurrent requests overdraw the balance.
- The `status` column in `generations` needs to be updated to include `'scripting'`, `'content_ready'` states. Update the CHECK constraint:
  ```sql
  CHECK (status IN ('pending', 'scripting', 'content_ready', 'generating_video', 'stitching', 'completed', 'failed'))
  ```

---

## Story 5.5: Generation Progress & Script Preview UI

**As a** user who initiated an Easy Mode generation,
**I want to** see real-time progress of my generation and preview the AI-written scripts organized by segment type,
**So that** I can track the pipeline status and review the creative content before video segments are generated.

### Functional Requirements

- FR19 (review aspect): Preview generated scripts
- FR18 (progress tracking): Track generation status

### Acceptance Criteria

1. **Progress page**: `app/(app)/generate/[id]/page.tsx` shows generation status with visual progress indicator.
2. **Status polling**: Frontend polls `video-status/` Edge Function every 5 seconds. Displays current step: "Writing scripts...", "Generating POV image...", "Content ready — generating videos..." (Epic 6).
3. **Script preview**: Once status reaches `'content_ready'`, display scripts organized by type:
   - **Hooks tab**: 3 hook variants with text, duration badge, variant label
   - **Bodies tab**: 3 body variants
   - **CTAs tab**: 3 CTA variants
4. **Composite image preview**: Display the POV composite image alongside scripts.
5. **Duration visualization**: Each script variant shows estimated duration as a badge (e.g., "5s").
6. **Progress steps**: Visual step indicator: Script Generation → Image Generation → Video Generation (grayed until Epic 6). Steps show checkmark when complete, spinner when in-progress.
7. **Error state**: If generation fails, show error message with "Retry" button (creates new generation, re-debits credits — or uses refunded credits).
8. **Auto-advance**: When video generation completes (Epic 6), page auto-updates to show video results.

### Technical Tasks

| # | Task | Details |
|---|------|---------|
| 1 | Create `app/(app)/generate/[id]/page.tsx` | Generation detail/progress page. |
| 2 | Build `GenerationProgress` component | Step indicator (Script → Image → Video). Shows current step with spinner. |
| 3 | Build `ScriptPreview` component | Tabbed view (Hooks / Bodies / CTAs). Displays text + duration + variant label per variant. |
| 4 | Build `CompositeImagePreview` component | Displays POV composite image with loading skeleton. |
| 5 | Add `useGenerationStatus` hook | Polls `video-status/` every 5s. Returns status, script, composite_image_url, progress. |
| 6 | Error + retry handling | Show error message. Retry button triggers new generation. |
| 7 | Unit tests | Test component rendering per status, script display, polling behavior. |

### Dependencies

- Story 5.4 (generation orchestration — provides the data to display)
- `video-status/` Edge Function must return script + composite image data when status >= `content_ready`

### Dev Notes

- The polling hook should stop polling when status is `'completed'` or `'failed'`.
- Script preview is read-only in MVP (Expert Mode editing is Phase 2, FR27-FR28).
- The page serves dual purpose: first for Epic 5 content (scripts + image) progress, then for Epic 6 (video generation progress + results). Design the component to handle the full lifecycle.
- Use Supabase's `supabase.from('generations').select('*').eq('id', id).single()` with RLS for direct reads instead of a custom Edge Function — more efficient for status checks that don't need external API polling.

---

## Story Dependencies & Execution Order

```
Story 5.2 (Script Generation)  ──┐
                                  ├──→ Story 5.4 (Orchestration) ──→ Story 5.5 (UI Progress)
Story 5.3 (Composite Image)    ──┘
                                  ↑
Story 5.1 (Wizard UI) ───────────┘
```

**Recommended execution order:**
1. **Story 5.1** (Wizard UI) — can start immediately, frontend only
2. **Story 5.2** (Script Generation) — can start in parallel with 5.1
3. **Story 5.3** (Composite Image) — can start in parallel with 5.1 and 5.2
4. **Story 5.4** (Orchestration) — depends on 5.2 + 5.3 logic being available
5. **Story 5.5** (Progress + Preview UI) — depends on 5.4 for data

**Parallelization:** Stories 5.1, 5.2, and 5.3 can all be developed in parallel by different developers (or sequentially by one developer — UI first, then backend).

---

## Database Schema Updates for Epic 5

### Update `generations` table status enum

```sql
-- Update the CHECK constraint to include new statuses
ALTER TABLE generations
  DROP CONSTRAINT IF EXISTS generations_status_check;

ALTER TABLE generations
  ADD CONSTRAINT generations_status_check
  CHECK (status IN ('pending', 'scripting', 'content_ready', 'generating_video', 'stitching', 'completed', 'failed'));
```

### Update `generations.script` JSONB structure

The `script` column stores the full script output:

```json
{
  "hooks": [
    { "text": "...", "duration_seconds": 5, "variant_label": "curiosity", "variant_index": 0 },
    { "text": "...", "duration_seconds": 4, "variant_label": "pain-point", "variant_index": 1 },
    { "text": "...", "duration_seconds": 5, "variant_label": "social-proof", "variant_index": 2 }
  ],
  "bodies": [
    { "text": "...", "duration_seconds": 8, "variant_label": "benefits", "variant_index": 0 },
    { "text": "...", "duration_seconds": 10, "variant_label": "demo", "variant_index": 1 },
    { "text": "...", "duration_seconds": 7, "variant_label": "testimonial", "variant_index": 2 }
  ],
  "ctas": [
    { "text": "...", "duration_seconds": 4, "variant_label": "urgency", "variant_index": 0 },
    { "text": "...", "duration_seconds": 3, "variant_label": "fomo", "variant_index": 1 },
    { "text": "...", "duration_seconds": 5, "variant_label": "offer", "variant_index": 2 }
  ]
}
```

### Credit ledger reasons update

```sql
-- Add 'generation' as valid reason if not already present
-- The existing CHECK allows: 'subscription_renewal', 'generation', 'refund', 'bonus', 'free_trial'
-- This already covers our needs (generation for debit, refund for failure recovery)
```

---

## Testing Strategy

### Unit Tests (per story)

- **5.1**: Component rendering, selection state, credit check display, empty states
- **5.2**: Prompt building, OpenAI response parsing, duration clamping, retry logic
- **5.3**: Composite prompt building, NanoBanana response handling, Storage upload mocking
- **5.4**: Credit flow (check → debit → refund), status transitions, parallel execution, error handling
- **5.5**: Polling behavior, script display formatting, progress step rendering

### Integration Tests

- Full wizard flow: select product → persona → confirm → generate → see progress → see scripts
- Credit debit + refund on failure
- Concurrent generation requests (credit race condition)
- OpenAI timeout → retry → success
- NanoBanana failure → refund credits → error state shown

### Manual QA Checklist

- [ ] Can select product from library
- [ ] Can select persona from library
- [ ] Credit check prevents generation when balance < 9
- [ ] Generation creates 9 script variants (3H + 3B + 3C)
- [ ] Each script variant has different creative angle
- [ ] Script durations are within specified ranges
- [ ] Composite image shows persona with product
- [ ] Composite image is 9:16 vertical format
- [ ] Progress indicator updates in real-time
- [ ] Script preview shows all 9 variants organized by type
- [ ] Failed generation refunds credits
- [ ] Error messages are user-friendly

---

## Estimated Scope

- **Stories:** 5
- **Technical Tasks:** ~40
- **Edge Functions:** 3 new (`generate-batch/`, `generate-script/`, `generate-composite/`)
- **Frontend Pages:** 2 (`generate/page.tsx`, `generate/[id]/page.tsx`)
- **Components:** ~10 new
- **Hooks:** ~4 new
