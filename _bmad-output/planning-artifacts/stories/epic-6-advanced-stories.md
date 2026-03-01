---
epic: 6
title: 'Video Segment Generation & Delivery - Advanced Features'
status: 'complete'
frs_covered: ['FR21', 'FR22', 'FR24', 'FR25', 'FR26', 'FR27', 'FR28', 'FR29', 'FR30']
nfrs_addressed: ['NFR3', 'NFR4', 'NFR5', 'NFR7', 'NFR14', 'NFR15']
depends_on: ['Epic 5 (script & image generation)']
architecture_stack: 'Supabase Edge Functions (Deno), Kling v2.6/v3, Supabase Storage, NanoBanana/Gemini API, OpenRouter'
auditDate: '2026-02-28'
---

# Epic 6 - Video Segment Generation & Delivery: Advanced Stories [DONE]

## Overview

These stories cover the advanced video generation features that were added beyond the original MVP scope. They extend the base video pipeline (Stories 6.1-6.7 in `epics.md`) with per-segment creative control, iterative regeneration, and composite image editing.

All features in this file were **not in the original PRD** - they were built as extensions during implementation to give creators more control over their video ad output.

---

## [DONE] Story 6.8: Advanced Mode - Per-Segment Control

**As a** user who wants fine-grained creative control over my video segments,
**I want to** toggle Advanced Mode and configure each segment individually (emotion, action, custom composite),
**So that** I can tailor the look and feel of each hook, body, and CTA segment to my creative vision.

### Acceptance Criteria

1. **Toggle**: Advanced Mode toggle in wizard step 4 (Configure). Controlled by `advancedMode` boolean in Zustand store. Toggling off clears `advancedSegments` to null.
2. **Per-segment panels**: When Advanced Mode is on, each segment (hook/body/CTA variants) shows an expandable configuration panel (`AdvancedModePanel` component).
3. **Script text editing**: Each segment has an editable text field. Supports inline emotion tags with syntax `[e:emotion:intensity]` where emotion is one of (happy, excited, surprised, serious, neutral) and intensity is (low/1, medium/2, high/3).
4. **Global emotion selector**: Per-segment dropdown for overall emotional tone: happy, excited, surprised, serious, neutral. Maps to Kling prompt directives (e.g., "happy" -> "warm smile, relaxed energy, genuine happiness").
5. **Intensity control**: Per-segment 1-3 scale mapped to descriptors: 1=subtly, 2=noticeably, 3=intensely. Modifies Kling prompt intensity (e.g., "intensely enthusiastic, animated gestures").
6. **Action description**: Per-segment free-text field for action (e.g., "talking to camera", "walking", "demonstrating product", "reacting"). Appended to Kling prompt as `Action: {description}`.
7. **Custom composite image**: Per-segment option to generate a unique composite via `generate-segment-composite/`. Supports `custom_scene_prompt`. Per-segment `image_path` stored in advanced config. Security: validates path starts with `{userId}/`.
8. **Format selection**: 9:16 (portrait) or 16:9 (horizontal) selected in wizard step 3. Applies to all composite images.
9. **Quality tier**: Standard (kling-v2-6) or HD (kling-v3) selected in wizard step 4. Costs: Standard single=5cr, triple=15cr. HD single=10cr, triple=30cr.
10. **State management**: `advancedSegments: AdvancedSegmentsConfig | null` in wizard store. Intentionally excluded from localStorage persistence (complex, session-specific). Mode change (single<->triple) resets Advanced Mode.

### Technical Details

**Kling prompt construction** (from `generate-video/index.ts`):
```
Base: "A UGC creator speaking directly to camera, saying: '{cleanedText}' Natural, authentic talking-head style, casual handheld selfie aesthetic."
+ Global emotion: "Throughout the video: {intensityWord} {emotionDirective}."
+ Inline tags: "At moments of emphasis: {inlineDirectives}."
+ Action: "Action: {actionDescription}."
```

**Emotion directives map:**
| Emotion | Directive |
|---------|-----------|
| happy | warm smile, relaxed energy, genuine happiness |
| excited | enthusiastic, animated gestures, high energy, bright eyes |
| surprised | eyes wide, mouth slightly open, genuine shock and disbelief |
| serious | composed, direct eye contact, focused expression |
| neutral | (empty - no directive added) |

**Advanced segment input shape:**
```typescript
interface AdvancedSegmentInput {
  script_text: string;
  global_emotion: string;
  global_intensity: number;
  action_description?: string;
  image_path?: string;
}
```

### Dependencies

- Story 5.1 (wizard UI framework)
- Story 5.3 (`generate-segment-composite/` for per-segment images)
- Story 6.1 (Kling job submission that reads advanced config)
- `frontend/src/types/database.ts` - `AdvancedSegmentConfig`, `AdvancedSegmentsConfig` types

---

## [DONE] Story 6.9: Per-Segment Regeneration

**As a** user reviewing completed video segments,
**I want to** regenerate an individual segment that I'm not satisfied with,
**So that** I can improve specific parts of my video without regenerating everything.

### Acceptance Criteria

1. **Trigger**: Regeneration available on the generation result page (`/generate/[id]`) for completed generations only. Per-segment "Regenerate" button.
2. **Input**: Requires `generation_id`, `segment_type` (hook/body/cta), `variation` (1-based index, e.g., 1-3 for triple mode).
3. **Cost**: 1 credit per segment regeneration. Credit balance checked before submission.
4. **Credit flow**: Credit debited immediately. If Kling job submission fails, 1 credit refunded.
5. **Kling resubmission**: Resubmits to Kling using same composite image and same script text as the original segment. Uses the generation's `video_quality` to determine model (`kling-v2-6` or `kling-v3`). Falls back to `kling_model` stored on generation record.
6. **Job ID update**: New Kling job ID replaces the old one in `external_job_ids` JSONB map (key: `{type}_{variation}`).
7. **Video removal**: The target segment is removed from `videos` JSONB so `video-status/` repolls only that key. Other completed segments preserved.
8. **Status update**: Generation status set back to `generating_segments`. `error_message` and `completed_at` cleared.
9. **Signed URL handling**: If `composite_image_url` is a storage path (not HTTP), generates a fresh signed URL (2h expiry) for Kling.
10. **Validation**: Only `completed` status generations can be regenerated (409 otherwise). Segment must exist in script. Generation must have `external_job_ids`.

### Edge Function Details

- **Function**: `supabase/functions/regenerate-segment/index.ts`
- **Method**: POST
- **Auth**: Required (`requireUserId()`)
- **Request body**: `{ generation_id: string, segment_type: "hook" | "body" | "cta", variation: number }`
- **Response**: `{ data: { generation_id, status: "generating_segments", job_key, credits_charged: 1 } }`

### Error Handling

- 400: Invalid segment_type or variation
- 402: Insufficient credits (< 1)
- 404: Generation not found
- 409: Generation not in `completed` status, or missing job metadata

---

## [DONE] Story 6.10: Composite Image Editing

**As a** user who wants to tweak the POV composite image,
**I want to** describe changes in natural language and get an edited version,
**So that** I can refine the persona+product composite without starting from scratch.

### Acceptance Criteria

1. **Natural language editing**: User provides a text prompt describing desired changes (e.g., "make the lighting warmer", "change background to outdoor cafe", "make the person smile more").
2. **Prompt limit**: Maximum 500 characters for the edit prompt.
3. **Non-destructive**: Original composite preserved. Edited version saved as a new file. User can switch back to original.
4. **Format support**: Supports both 9:16 and 16:9 formats. Format passed to NanoBanana edit function.
5. **Security**: Only composites owned by the authenticated user can be edited (path must start with `{userId}/`).
6. **Storage**: Edited image uploaded to `composite-images/{userId}/preview/{uuid}.{ext}`. Returns both `path` and `signed_url`.
7. **Signed URL**: 1-hour expiry on returned signed URL.
8. **Retry**: Up to 4 retries with 1s base backoff on NanoBanana API failure.

### Edge Function Details

- **Function**: `supabase/functions/edit-composite-image/index.ts`
- **Method**: POST
- **Auth**: Required (`requireUserId()`)
- **Request body**: `{ composite_image_path: string, edit_prompt: string, format?: "9:16" | "16:9" }`
- **Response**: `{ data: { image: { path: string, signed_url: string } } }`
- **NanoBanana API**: Uses `editCompositeFromReference()` from `_shared/nanobanana.ts`

### Error Handling

- 400: Missing `composite_image_path` or `edit_prompt`, prompt exceeds 500 chars, invalid format
- 403: Composite path doesn't belong to authenticated user
- 500: NanoBanana API failure after retries, storage upload failure

---

## [DONE] Story 6.11: CTA Style Configuration

**As a** user configuring my video generation,
**I want to** choose a specific CTA style,
**So that** the generated CTA scripts match my marketing strategy (e.g., link in bio, comment keyword, discount code).

### Acceptance Criteria

1. **8 CTA style options** in wizard step 4:
   - `auto` - AI chooses the best fit
   - `product_name_drop` - Mentions product by name
   - `link_in_bio` - Directs to bio link
   - `link_in_comments` - Directs to comments
   - `comment_keyword` - "Comment [keyword] for link" (enables keyword text input)
   - `check_description` - Directs to post description
   - `direct_website` - Direct website mention
   - `discount_code` - Mentions a discount/promo code
2. **Keyword input**: When `comment_keyword` is selected, a text field appears for the keyword. Stored in `ctaCommentKeyword` wizard state.
3. **Script generation integration**: CTA style feeds into the script generation prompt. Non-`auto` styles constrain the CTA angle.
4. **Per-segment script regeneration**: `generate-segment-script/` also accepts `cta_style` and `cta_comment_keyword` parameters for CTA segments, maintaining consistency when individual scripts are regenerated.
5. **State persistence**: `ctaStyle` and `ctaCommentKeyword` persisted in localStorage via wizard store.

### Implementation Details

- Wizard store: `ctaStyle` and `ctaCommentKeyword` fields in `generation-wizard.ts`
- Script generation: CTA style constraint appended to user prompt in `generate-segment-script/index.ts`
- UI: CTA style selector component in wizard step 4

---

## [DONE] Story 6.12: Per-Segment Script Regeneration

**As a** user in Advanced Mode,
**I want to** regenerate individual segment scripts without re-running the full pipeline,
**So that** I can fine-tune specific hooks, bodies, or CTAs independently.

### Acceptance Criteria

1. **Standalone script generation**: `generate-segment-script/` generates a single segment script (hook, body, or CTA) using product context.
2. **Input**: Requires `product_id`, `persona_id`, `segment_type` (hook/body/cta). Optional: `variant_index` (default 0), `cta_style`, `cta_comment_keyword`.
3. **Ownership verification**: Both product and persona ownership validated against authenticated user. Product must be confirmed, persona must be active.
4. **Segment-specific prompts**: Each segment type has its own system prompt with appropriate duration bounds, word limits, and available angles/structures/patterns.
5. **Duration bounds**: Hook 2-4s, Body 5-9s, CTA 2-4s. Duration clamped after generation.
6. **Variant diversity**: `variant_index` parameter encourages the AI to pick different angles than the most obvious one.
7. **CTA style constraint**: If `cta_style` is non-`auto` for CTA segments, the constraint is added to the user prompt. `comment_keyword` flows through for the keyword style.
8. **No credit cost**: Script regeneration is free (no credit charge). Credits are only charged when the full video generation is approved.
9. **Response**: Returns `{ data: { text, duration_seconds, variant_label } }`.

### Edge Function Details

- **Function**: `supabase/functions/generate-segment-script/index.ts`
- **Method**: POST
- **Auth**: Required (`requireUserId()`)
- **Request body**: `{ product_id, persona_id, segment_type, variant_index?, cta_style?, cta_comment_keyword? }`
- **AI**: OpenRouter with segment-specific system prompts. JSON mode enabled. 20s timeout, 300 max tokens.
- **Retry**: Uses `withRetry()` for OpenRouter call.

### Error Handling

- 400: Missing required fields, invalid segment_type
- 404: Product not found/not confirmed, persona not found/inactive
- 500: OpenRouter failure after retries

---

## Story Dependencies

```
Story 6.8 (Advanced Mode)  ──> Story 6.12 (Segment Script Regen)
         |                            |
         └──> Story 6.11 (CTA Style) ┘
         |
         └──> Story 6.10 (Composite Editing)
         |
         └──> Story 6.9 (Segment Regeneration)
```

All stories are independently functional but share the Advanced Mode UI framework. Stories 6.9 and 6.10 work without Advanced Mode enabled (available on the generation result page for any completed generation).

---

## Edge Functions Summary

| Function | Story | Purpose | Cost |
|----------|-------|---------|------|
| `generate-video/` (advanced path) | 6.8 | Reads `advanced_segments` input, builds Kling prompts with emotion/action directives | Included in generation cost |
| `regenerate-segment/` | 6.9 | Regenerate single completed segment | 1 credit |
| `edit-composite-image/` | 6.10 | Edit composite via NL prompt | Free |
| `generate-segment-script/` | 6.12 | Generate individual segment script | Free |
| `generate-segment-composite/` | 6.8 | Generate per-segment composite image | Free |
