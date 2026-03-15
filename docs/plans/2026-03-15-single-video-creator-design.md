# Single Video Creator — Design Doc

**Date:** 2026-03-15
**Status:** Approved

## Overview

A new standalone dashboard section (`/dashboard/video-creator`) that generates a single continuous video (16s or 20s) using the Sora 2 API. Unlike the existing multi-segment pipeline (hook/body/CTA → separate clips → FFmpeg stitch), this produces one video in one API call.

## Key Decisions

- **Separate section** in dashboard, not part of existing wizard
- **New Edge Functions** (`generate-single-video`, `single-video-status`, `upload-reference-image`) — clean separation from existing pipeline
- **Reuses `generations` table** with `type` discriminator column
- **Persona and product are optional**
- **SaaS toggle** — when enabled, no product images in composite
- **Two script formats:** structured (hook/body/CTA) or freeform prompt
- **Four reference image sources:** composite, persona only, custom upload, none
- **Credits:** 5 (standard/sora-2), 10 (pro/sora-2-pro)
- **Duration:** user picks 16s or 20s

## Data Model

Add columns to `generations` table:

| Column | Type | Description |
|---|---|---|
| `type` | TEXT DEFAULT 'multi-segment' | `multi-segment` (existing) or `single-video` (new) |
| `sora_model` | TEXT | `sora-2` or `sora-2-pro` |
| `duration` | INT | 16 or 20 |
| `reference_type` | TEXT | `composite`, `persona`, `custom`, `none` |
| `reference_image_path` | TEXT | Storage path for custom uploads |
| `is_saas` | BOOLEAN DEFAULT false | Skip product image in composite |
| `freeform_prompt` | TEXT | Used when not using structured script |

Existing nullable columns (`product_id`, `persona_id`, `script`, `videos`, `external_job_ids`) already support the optional nature.

## Backend — Edge Functions

### `generate-single-video/index.ts`

**Phase "script"** (optional — skipped if freeform):
- Input: `product_id?`, `persona_id?`, `is_saas`, `language`, `script_format`
- If structured: OpenRouter generates a continuous script stored as `{ full_text, hook, body, cta }`
- If freeform: user's prompt stored in `freeform_prompt`
- Creates `generations` record with `type: "single-video"`, `status: "awaiting_approval"`

**Phase "full"** (approval + submit):
- Input: `generation_id`, `sora_model`, `duration`, `reference_type`, `reference_image_path?`
- Credit check + debit (5 or 10)
- Resolves reference image by type → signed URL or blob
- Builds Sora prompt (concatenated structured script or freeform)
- Calls updated `submitSoraJob()` with `seconds`, `size`, optional `input_reference`
- Saves `external_job_ids: { video: "video_xxx" }`, sets `status: "generating_segments"`

### `single-video-status/index.ts`
- Polls `checkSoraJob()` for the single job
- On completion: downloads MP4 via `downloadSoraVideo()`, uploads to storage
- On failure: full refund

### `upload-reference-image/index.ts`
- Multipart image upload (jpeg/png/webp)
- Validates format and dimensions
- Uploads to `reference-images/{userId}/{uuid}.jpg`

### Shared module updates: `_shared/sora.ts`

Update to match Sora 2 API:
- `submitSoraJob()`: `POST /v1/videos` (JSON or multipart with `input_reference`)
- `checkSoraJob()`: `GET /v1/videos/{video_id}` (returns `progress` 0-100)
- New `downloadSoraVideo()`: `GET /v1/videos/{video_id}/content` → binary MP4

Size mapping (9:16 vertical):
- Standard (`sora-2`): `720x1280`
- Pro (`sora-2-pro`): `1080x1920`

## Frontend

### Route: `/dashboard/video-creator`

Sidebar: "Video Creator" with video icon.

### State: `video-creator-store.ts` (Zustand, persisted)

```typescript
interface VideoCreatorState {
  scriptFormat: "structured" | "freeform"
  freeformPrompt: string
  structuredScript: { hook: string; body: string; cta: string } | null
  productId: string | null
  personaId: string | null
  isSaas: boolean
  soraModel: "sora-2" | "sora-2-pro"
  duration: 16 | 20
  referenceType: "composite" | "persona" | "custom" | "none"
  customReferenceImagePath: string | null
  language: string
  generationId: string | null
}
```

### Layout

**Left panel — Configuration:**
1. Script section: toggle structured/freeform. Structured = hook/body/CTA textareas + "Auto-generate" button. Freeform = single textarea.
2. Reference image: radio selector (composite/persona/custom/none). Shows relevant picker. SaaS toggle when product selected.
3. Settings: model (standard/pro), duration (16s/20s), language

**Right panel — Preview & Output:**
- Before: reference image preview or placeholder
- During: progress bar (Sora returns 0-100 progress)
- After: video player + download

### Hooks: `use-single-video.ts`
- `useGenerateSingleVideoScript()` — script phase
- `useSubmitSingleVideo()` — approval phase
- `useSingleVideoStatus(generationId)` — polls every 5s

### Result: `/dashboard/video-creator/[id]`
- Video player, download, metadata, "Create another" button

## Credits & Permissions

- Standard (`sora-2`): 5 credits
- Pro (`sora-2-pro`): 10 credits
- No segment regeneration — full new generation required
- Free tier: standard only
- Paid tiers: standard + pro
- Reuses existing `credit_ledger` for tracking
