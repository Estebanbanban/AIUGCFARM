# Single Video Creator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a standalone "Video Creator" dashboard section that generates a single continuous 16-20s video via the Sora 2 API, with optional persona/product, flexible script formats, and multiple reference image sources.

**Architecture:** New Edge Functions (`generate-single-video`, `single-video-status`, `upload-reference-image`) + new frontend page (`/video-creator`) with dedicated Zustand store. Reuses existing shared modules (`sora.ts`, `credits.ts`, `auth.ts`, `openrouter.ts`). Extends `generations` table with a `type` discriminator column.

**Tech Stack:** Next.js 14 (App Router), Supabase Edge Functions (Deno), Zustand, TanStack Query, shadcn/UI, Tailwind, OpenAI Sora 2 API

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260315120000_single_video_type.sql`

**Step 1: Write migration SQL**

```sql
-- Add single-video support columns to generations table
ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'multi-segment',
  ADD COLUMN IF NOT EXISTS sora_model TEXT,
  ADD COLUMN IF NOT EXISTS duration INTEGER,
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_image_path TEXT,
  ADD COLUMN IF NOT EXISTS is_saas BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS freeform_prompt TEXT;

-- Make product_id and persona_id nullable (they're required for multi-segment but optional for single-video)
ALTER TABLE generations ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE generations ALTER COLUMN persona_id DROP NOT NULL;

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_generations_type ON generations(type);

-- Add check constraint for valid types
ALTER TABLE generations ADD CONSTRAINT chk_generation_type CHECK (type IN ('multi-segment', 'single-video'));

-- Add check for sora_model values
ALTER TABLE generations ADD CONSTRAINT chk_sora_model CHECK (sora_model IS NULL OR sora_model IN ('sora-2', 'sora-2-pro'));

-- Add check for reference_type values
ALTER TABLE generations ADD CONSTRAINT chk_reference_type CHECK (reference_type IS NULL OR reference_type IN ('composite', 'persona', 'custom', 'none'));

-- Add check for duration values
ALTER TABLE generations ADD CONSTRAINT chk_duration CHECK (duration IS NULL OR duration IN (16, 20));
```

**Step 2: Apply migration**

Run: `cd /Users/estebanronsin/Sites/AIUGC && npx supabase migration up` (or push to remote)

**Step 3: Commit**

```bash
git add supabase/migrations/20260315120000_single_video_type.sql
git commit -m "feat: add single-video columns to generations table"
```

---

## Task 2: Update `_shared/sora.ts` to Sora 2 API

**Files:**
- Modify: `supabase/functions/_shared/sora.ts`

**Step 1: Rewrite sora.ts for new API**

Replace the entire file with Sora 2 API support:

```typescript
const SORA_BASE = "https://api.openai.com/v1/videos";

export type SoraModel = "sora-2" | "sora-2-pro";

export interface SoraSubmitResult {
  job_id: string;
  status: string;
  model_name: SoraModel;
}

export interface SoraJobStatus {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  video_url?: string;
  error_message?: string;
}

function getOpenAIKey(): string {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY must be set");
  return key;
}

/**
 * Submit a video generation job to Sora 2 (text-to-video or image-to-video).
 * Uses the new POST /v1/videos endpoint.
 */
export async function submitSoraJob(params: {
  prompt: string;
  model?: SoraModel;
  seconds?: 16 | 20;
  size?: string;
  input_reference_blob?: Blob;
}): Promise<SoraSubmitResult> {
  const apiKey = getOpenAIKey();
  const model = params.model ?? "sora-2";
  const seconds = params.seconds ?? 20;
  // Default: 9:16 vertical for UGC
  const size = params.size ?? (model === "sora-2-pro" ? "1080x1920" : "720x1280");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    if (params.input_reference_blob) {
      // Multipart: includes input_reference image
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", params.prompt);
      form.append("seconds", String(seconds));
      form.append("size", size);
      form.append("input_reference", params.input_reference_blob, "reference.jpg");

      res = await fetch(SORA_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } else {
      // JSON: text-to-video only
      res = await fetch(SORA_BASE, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, prompt, seconds: String(seconds), size }),
        signal: controller.signal,
      });
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Sora API submission timed out after 30s.");
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    let errBody: string;
    try { errBody = await res.text(); } catch { errBody = `HTTP ${res.status}`; }
    throw new Error(`Sora submit error ${res.status}: ${errBody}`);
  }

  const body = await res.json();
  const jobId = body.id;
  if (!jobId || typeof jobId !== "string") {
    throw new Error(`Sora submit: no job id in response: ${JSON.stringify(body)}`);
  }

  return { job_id: jobId, status: body.status ?? "queued", model_name: model };
}

/**
 * Check the status of a Sora 2 video generation job.
 * GET /v1/videos/{video_id}
 */
export async function checkSoraJob(jobId: string): Promise<SoraJobStatus> {
  const apiKey = getOpenAIKey();
  const res = await fetch(`${SORA_BASE}/${jobId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    let errBody: string;
    try { errBody = await res.text(); } catch { errBody = `HTTP ${res.status}`; }
    throw new Error(`Sora status error ${res.status}: ${errBody}`);
  }

  const body = await res.json();
  const rawStatus = (body.status ?? "queued") as string;

  let status: SoraJobStatus["status"];
  switch (rawStatus) {
    case "completed": status = "completed"; break;
    case "failed": status = "failed"; break;
    case "in_progress": status = "processing"; break;
    default: status = "pending";
  }

  let errorMessage: string | undefined;
  if (status === "failed") {
    const err = body.error as Record<string, unknown> | undefined;
    errorMessage = (err?.message ?? body.error_message) as string | undefined;
  }

  return {
    job_id: jobId,
    status,
    progress: body.progress ?? 0,
    error_message: errorMessage,
  };
}

/**
 * Download a completed Sora 2 video as a Blob.
 * GET /v1/videos/{video_id}/content
 */
export async function downloadSoraVideo(jobId: string): Promise<Blob> {
  const apiKey = getOpenAIKey();
  const res = await fetch(`${SORA_BASE}/${jobId}/content`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`Sora download error ${res.status}`);
  }

  return await res.blob();
}
```

**Step 2: Commit**

```bash
git add supabase/functions/_shared/sora.ts
git commit -m "feat: update sora.ts to Sora 2 API with text-to-video and download support"
```

---

## Task 3: Edge Function — `generate-single-video`

**Files:**
- Create: `supabase/functions/generate-single-video/index.ts`

This function handles two phases:
- **Phase "script"**: Generate a structured script via OpenRouter (optional — skipped for freeform)
- **Phase "full"**: Debit credits, resolve reference image, submit Sora job

Key patterns to follow from existing `generate-video/index.ts`:
- Use `requireUserId(req)` from `_shared/auth.ts`
- Use `getAdminClient()` from `_shared/supabase.ts`
- Use `checkCredits()` / `debitCredits()` from `_shared/credits.ts`
- Use `submitSoraJob()` from `_shared/sora.ts`
- CORS headers on all responses
- Atomic status locking for approval phase

**Step 1: Create the Edge Function**

See design doc for full spec. The function should:
- Parse JSON body for `phase`, `script_format`, `product_id?`, `persona_id?`, `is_saas`, `language`, `sora_model`, `duration`, `reference_type`, `reference_image_path?`, `freeform_prompt?`, `structured_script?`
- Script phase: call OpenRouter to generate script OR accept freeform prompt, create generations record with `type: "single-video"`, return `generation_id`
- Full phase: lock generation, check/debit credits (5 for sora-2, 10 for sora-2-pro), resolve reference image blob, build prompt, submit Sora job, save `external_job_ids`

**Step 2: Commit**

```bash
git add supabase/functions/generate-single-video/index.ts
git commit -m "feat: add generate-single-video edge function"
```

---

## Task 4: Edge Function — `single-video-status`

**Files:**
- Create: `supabase/functions/single-video-status/index.ts`

Polls a single Sora job. Simpler than `video-status` since there's only one job to track.

**Step 1: Create the Edge Function**

- Accept `generation_id` query param
- Verify user owns the generation
- Call `checkSoraJob()` with the stored job ID
- If completed: call `downloadSoraVideo()`, upload to `generated-videos/{userId}/{genId}/video.mp4`, update status to "completed", send email
- If failed: refund credits, update status to "failed"
- Return current status + progress percentage

**Step 2: Commit**

```bash
git add supabase/functions/single-video-status/index.ts
git commit -m "feat: add single-video-status polling edge function"
```

---

## Task 5: Edge Function — `upload-reference-image`

**Files:**
- Create: `supabase/functions/upload-reference-image/index.ts`

Handles custom image uploads for the "custom" reference type.

**Step 1: Create the Edge Function**

- Accept multipart form data with an `image` field
- Validate format (jpeg/png/webp) and size (max 10MB)
- Upload to `reference-images/{userId}/{uuid}.{ext}` in Supabase Storage
- Return `{ path: "reference-images/..." }`

**Step 2: Commit**

```bash
git add supabase/functions/upload-reference-image/index.ts
git commit -m "feat: add upload-reference-image edge function"
```

---

## Task 6: Frontend Types

**Files:**
- Modify: `frontend/src/types/database.ts`
- Modify: `frontend/src/types/api.ts`

**Step 1: Extend Generation type in database.ts**

Add new fields to the `Generation` interface:
```typescript
type?: "multi-segment" | "single-video";
sora_model?: "sora-2" | "sora-2-pro" | null;
duration?: 16 | 20 | null;
reference_type?: "composite" | "persona" | "custom" | "none" | null;
reference_image_path?: string | null;
is_saas?: boolean;
freeform_prompt?: string | null;
```

**Step 2: Add API response types in api.ts**

```typescript
export interface SingleVideoScriptResponse {
  data: {
    generation_id: string;
    status: "awaiting_approval";
    script?: { hook: string; body: string; cta: string; full_text: string };
    credits_to_charge: number;
  };
}

export interface SingleVideoSubmitResponse {
  data: {
    generation_id: string;
    status: "generating_segments";
    credits_charged: number;
  };
}

export interface SingleVideoStatusResponse {
  data: {
    status: GenerationStatus;
    progress: number;
    video_url?: string;
    error_message?: string;
  };
}

export interface UploadReferenceImageResponse {
  data: { path: string };
}
```

**Step 3: Commit**

```bash
git add frontend/src/types/database.ts frontend/src/types/api.ts
git commit -m "feat: add single-video types to database and API types"
```

---

## Task 7: Zustand Store — `video-creator-store.ts`

**Files:**
- Create: `frontend/src/stores/video-creator-store.ts`

**Step 1: Create the store**

Flat state, persisted to localStorage:
```typescript
interface VideoCreatorState {
  scriptFormat: "structured" | "freeform";
  freeformPrompt: string;
  structuredScript: { hook: string; body: string; cta: string } | null;
  productId: string | null;
  personaId: string | null;
  isSaas: boolean;
  soraModel: "sora-2" | "sora-2-pro";
  duration: 16 | 20;
  referenceType: "composite" | "persona" | "custom" | "none";
  customReferenceImagePath: string | null;
  language: string;
  generationId: string | null;
  creditsToCharge: number | null;
  // Actions
  set*(...)
  reset()
}
```

Follow patterns from `generation-wizard.ts`: Zustand + immer + persist.

**Step 2: Commit**

```bash
git add frontend/src/stores/video-creator-store.ts
git commit -m "feat: add video-creator Zustand store"
```

---

## Task 8: React Query Hooks — `use-single-video.ts`

**Files:**
- Create: `frontend/src/hooks/use-single-video.ts`

**Step 1: Create the hooks file**

Three hooks following patterns from `use-generations.ts`:
- `useGenerateSingleVideoScript()` — mutation calling `generate-single-video` with phase "script"
- `useSubmitSingleVideo()` — mutation calling `generate-single-video` with phase "full", invalidates credits/generations on success
- `useSingleVideoStatus(generationId)` — query polling `single-video-status` every 5s, stops on completed/failed
- `useUploadReferenceImage()` — mutation using `callEdgeMultipart` to upload custom image

**Step 2: Commit**

```bash
git add frontend/src/hooks/use-single-video.ts
git commit -m "feat: add React Query hooks for single video generation"
```

---

## Task 9: Video Creator Page — Main UI

**Files:**
- Create: `frontend/src/app/(dashboard)/video-creator/page.tsx`

**Step 1: Create the page component**

Single-page layout with two panels:

**Left panel (configuration):**
1. **Script Section** — Toggle between structured/freeform
   - Structured: 3 textareas (hook/body/CTA) + "Auto-generate" button (requires persona or product for context)
   - Freeform: single large textarea
2. **Reference Image Section** — Radio group: composite / persona / custom upload / none
   - Composite: shows persona picker + product picker + SaaS toggle
   - Persona: shows persona picker only
   - Custom: file upload dropzone
   - None: no additional UI
3. **Settings Row** — Model selector (Standard/Pro), Duration (16s/20s), Language dropdown

**Right panel (preview + output):**
- Before generation: selected reference image preview (or gradient placeholder)
- During: progress bar with percentage (from Sora API)
- After: video player with download button

**Bottom: Generate button** with credit cost display

Use shadcn components: Card, Tabs, RadioGroup, Select, Button, Textarea, Progress, Badge

**Step 2: Commit**

```bash
git add frontend/src/app/\(dashboard\)/video-creator/page.tsx
git commit -m "feat: add Video Creator page UI"
```

---

## Task 10: Video Creator Result Page

**Files:**
- Create: `frontend/src/app/(dashboard)/video-creator/[id]/page.tsx`

**Step 1: Create result page**

- Fetch generation by ID
- Show video player when completed
- Download button
- Generation metadata (model, duration, reference type, prompt used)
- "Create Another" button → resets store and navigates to `/video-creator`
- Error state with retry option

**Step 2: Commit**

```bash
git add frontend/src/app/\(dashboard\)/video-creator/\[id\]/page.tsx
git commit -m "feat: add Video Creator result page"
```

---

## Task 11: Add Sidebar Navigation Entry

**Files:**
- Modify: `frontend/src/components/layout/DashboardShell.tsx`

**Step 1: Add nav item**

Add to `navItems` array after "Generate":
```typescript
{ label: "Video Creator", href: "/video-creator", icon: Video },
```

Import `Video` from `lucide-react`.

**Step 2: Commit**

```bash
git add frontend/src/components/layout/DashboardShell.tsx
git commit -m "feat: add Video Creator to sidebar navigation"
```

---

## Task 12: Integration Testing & Polish

**Step 1:** Verify the full flow end-to-end:
1. Navigate to Video Creator
2. Enter a freeform prompt
3. Select "None" reference → generate with standard model
4. Verify polling works and video appears on completion

**Step 2:** Test structured script flow:
1. Select a persona + product
2. Click "Auto-generate" for structured script
3. Edit hook/body/CTA
4. Generate with Pro model, 20s duration

**Step 3:** Test reference image flows:
1. Custom upload → verify image preview
2. Persona only → verify persona image shows
3. Composite → verify persona+product picker appears, SaaS toggle works

**Step 4:** Verify credit debit/refund works correctly

**Step 5: Final commit**

```bash
git commit -m "feat: single video creator - integration polish"
```
