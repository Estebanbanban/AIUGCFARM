---
epic: 13
story: 13.1
title: 'Custom Segment Counts — Variable Generation Matrix'
status: 'implemented'
frs_covered: []
nfrs_addressed: ['NFR4', 'NFR5']
depends_on: ['Epic 5 (script)', 'Epic 6 (video)', 'Epic 10 (variation UI)']
architecture_stack: 'Next.js + React + Tailwind + shadcn/ui | Supabase Edge Functions (Deno) | Kling v3 | FFmpeg.wasm'
auditDate: '2026-03-07'
---

# Story 13.1: Custom Segment Counts — Variable Generation Matrix

## Context & Motivation

Triple mode today is fixed at **3 hooks × 3 bodies × 3 CTAs = 9 segments → 27 possible combinations**.

This is an arbitrary default. Some users want fewer (2×2×2 = 8 combos, faster/cheaper) and power users want more (5×5×5 = 25 segments → 125 combos). The fixed 3×3×3 leaves value on the table: agencies running 5 brands want a full variation library from a single generation, not 27 clips.

This story makes the counts **independently configurable per slot** (hooks, bodies, CTAs each 1–5), with the combination count displayed live in the wizard so users understand the output before committing credits.

The existing "triple mode" default (3/3/3) is preserved as the starting point. "Single mode" remains 1/1/1 and is unaffected.

---

## User Story

**As a** power user or agency running multiple ad variants,
**I want to** choose how many hooks, bodies, and CTAs are generated (1–5 each),
**So that** I can get a larger variation library from a single generation, or a smaller cheaper run when I only need a few options.

---

## Acceptance Criteria

### Wizard UI — Segment Count Selectors

1. **Entry point:** The segment count selectors are only visible when the user selects "Full Campaign" (currently called "triple mode") in the Mode selector. Single mode remains 1/1/1 and shows no selectors.

2. **Three independent steppers:** Below the Mode selector, three inline steppers appear — one each for Hooks, Bodies, and CTAs. Each stepper has a `−` and `+` button with the current count displayed between them. Range: **1–5**. Default: **3, 3, 3**.

3. **Live combination counter:** Adjacent to the steppers (or below them), a prominent label reads:
   > "Generates **N × M × P = X** possible combinations"
   where N/M/P are the current hook/body/cta counts and X = N×M×P. This updates instantly as the user adjusts values.

4. **Credit cost update:** The credit cost shown in the Mode selector card updates to reflect the actual number of video jobs to be generated. Pricing formula: `total_jobs = N × M × P`. Cost scales linearly from the per-segment rate:
   - Standard: `ceil(total_jobs × base_cost_per_job)` where `base_cost_per_job = 15 / 9` ≈ 1.67 credits
   - HD: `ceil(total_jobs × base_hd_cost_per_job)` where `base_hd_cost_per_job = 30 / 9` ≈ 3.33 credits
   - Example: 5×5×5 = 25 jobs → Standard ≈ 42 credits, HD ≈ 84 credits
   - The credit display in the mode card should show the computed total (e.g., "~42 credits")

5. **Cap enforcement:** The `+` button disables at 5 for each slot. The `−` button disables at 1. Values cannot be set outside 1–5.

6. **Preset compatibility:** When loading a saved preset, if the preset has `hooks_count`/`bodies_count`/`ctas_count` fields, they are restored to the steppers. Older presets without these fields default to 3/3/3.

7. **State persistence:** The three count values are stored in the Zustand generation wizard store (`hooksCount`, `bodiesCount`, `ctasCount`) alongside existing fields, persisted to localStorage with the same partialize logic.

---

### Script Generation — Backend

8. **API contract:** The `generate-video` edge function (phase: "script") accepts three new optional integer fields:
   ```json
   {
     "hooks_count": 1–5,   // default: 3 (if mode is "triple")
     "bodies_count": 1–5,  // default: 3
     "ctas_count": 1–5     // default: 3
   }
   ```
   For `mode: "single"`, all three default to 1 regardless of what is passed. Validation: values outside 1–5 return 400.

9. **Script generation:** `buildSystemPrompt(count, language)` is already parameterized by count. The function is called three times (hooks, bodies, CTAs) with the respective counts. Each count passes through correctly — no hardcoding of `3`.

10. **`generations` table:** Three new integer columns are added:
    - `hooks_count INT NOT NULL DEFAULT 3`
    - `bodies_count INT NOT NULL DEFAULT 3`
    - `ctas_count INT NOT NULL DEFAULT 3`
    The constraint: each column in range 1–5 (`CHECK (hooks_count BETWEEN 1 AND 5)`). Existing rows default to 3/3/3 via the column default.

11. **Credit calculation:** Credit cost is computed as `ceil(hooks_count × bodies_count × ctas_count × per_segment_cost)` using the existing per-provider, per-quality rate. The `credits_to_charge` returned in the script phase response reflects the actual job count.

---

### Video Generation — Backend

12. **Job submission:** In the approval phase, the edge function submits `hooks_count × bodies_count × ctas_count` video jobs (one per segment: each hook, each body, each CTA is one job). For a 4×3×2 generation, that's 9 jobs for hooks (4) + bodies (3) + CTAs (2) = 9 separate segment videos.

    > Note: video jobs are per **segment** (not per combination). A 5×5×5 generation produces 15 segment videos (5+5+5). Combinations are assembled client-side by the variation UI (as in Epic 10). Do NOT submit 125 jobs.

13. **Segment storage:** The `generations.videos` JSONB array stores each segment. The existing field structure is preserved — the array length grows from the fixed 9 to `N+M+P` segments. Hook segments are indexed 0 to `hooks_count-1`, body segments `hooks_count` to `hooks_count+bodies_count-1`, CTA segments after that.

---

### Combination UI — Frontend

14. **Column cards:** The three segment columns in `/generate/[id]` render `hooks_count`, `bodies_count`, and `ctas_count` cards respectively — not hardcoded 3. These counts are read from the `generation` record (the new DB columns).

15. **Combination counter:** The `allCombos` useMemo uses the actual counts from the generation record instead of the hardcoded `3`:
    ```typescript
    for (let h = 0; h < gen.hooks_count; h++)
      for (let b = 0; b < gen.bodies_count; b++)
        for (let c = 0; c < gen.ctas_count; c++)
    ```
    Total combinations displayed: `gen.hooks_count × gen.bodies_count × gen.ctas_count`.

16. **Combination discovery banner:** The banner text updates from "You have 27 possible combinations" to "You have **X** possible combinations" using the live count.

17. **Prev/next navigation:** The navigator already uses `allCombos.length` (not hardcoded 27) — no change needed.

---

### Preset Updates

18. **Preset config schema:** `PresetConfig` gains three optional fields:
    ```typescript
    hooks_count?: number;  // 1–5, default 3
    bodies_count?: number; // 1–5, default 3
    ctas_count?: number;   // 1–5, default 3
    ```
    `create-preset` saves these fields if present. `loadPreset` restores them to `hooksCount`/`bodiesCount`/`ctasCount` in the store.

---

## Implementation Notes

### New DB Migration

```sql
ALTER TABLE generations
  ADD COLUMN hooks_count INT NOT NULL DEFAULT 3
    CHECK (hooks_count BETWEEN 1 AND 5),
  ADD COLUMN bodies_count INT NOT NULL DEFAULT 3
    CHECK (bodies_count BETWEEN 1 AND 5),
  ADD COLUMN ctas_count INT NOT NULL DEFAULT 3
    CHECK (ctas_count BETWEEN 1 AND 5);
```

### Zustand Store Changes (`frontend/src/stores/generation-wizard.ts`)

Add three fields to state:
```typescript
hooksCount: number;   // default 3
bodiesCount: number;  // default 3
ctasCount: number;    // default 3
```
Add three setters: `setHooksCount`, `setBodiesCount`, `setCtasCount`.
Update `loadPreset` to restore these fields.
Persist all three in the `partialize` function.

### Wizard UI Component (`frontend/src/app/(dashboard)/generate/page.tsx`)

Add stepper sub-component inline (no new file needed — ~30 lines):
```tsx
// Shown only when store.mode === "triple"
<div className="flex items-center gap-6">
  <SegmentStepper label="Hooks" value={store.hooksCount} onChange={store.setHooksCount} />
  <SegmentStepper label="Bodies" value={store.bodiesCount} onChange={store.setBodiesCount} />
  <SegmentStepper label="CTAs" value={store.ctasCount} onChange={store.setCtasCount} />
</div>
<p className="text-sm text-muted-foreground">
  Generates <strong>{store.hooksCount} × {store.bodiesCount} × {store.ctasCount} = {store.hooksCount * store.bodiesCount * store.ctasCount}</strong> possible combinations
</p>
```

`SegmentStepper` is a small inline component: label + `−` button + count display + `+` button.

### Credit Cost Display

The existing `computeCredits()` helper (or wherever credits are shown in the mode selector card) should be updated to calculate:
```typescript
const totalJobs = mode === "triple"
  ? hooksCount * bodiesCount * ctasCount
  : 1;
// Then use totalJobs * per_segment_rate instead of the fixed batch cost
```

Wait — the per-segment rate is `batch_cost / 9` for the 3×3×3 default. The "per segment" unit is `(hooks+bodies+ctas)` not `(hooks×bodies×ctas)`. Clarify:

- 3×3×3 generates **9 segment videos** (3 hooks + 3 bodies + 3 CTAs), costing 15 credits standard.
- 5×5×5 generates **15 segment videos** (5+5+5), costing `ceil(15 × 15/9)` = `ceil(25)` = 25 credits standard.
- **Cost = ceil((hooksCount + bodiesCount + ctasCount) / 9 × 15)** for standard Kling.
- Display this on the mode card, updating live.

### `generate-video` Edge Function Changes

In the script phase:
1. Parse `hooks_count`, `bodies_count`, `ctas_count` from request body (validate 1–5, default to mode-appropriate values)
2. Pass to `buildSystemPrompt` calls — already parameterized
3. Store counts on the `generations` row on insert
4. Return `credits_to_charge` based on total segment count

In the approval phase:
1. Read `hooks_count`, `bodies_count`, `ctas_count` from the `generations` row
2. Submit `(hooks_count + bodies_count + ctas_count)` Kling jobs
3. Charge `ceil((hooks + bodies + ctas) / 9 × batch_cost)` credits

### Files to Create/Modify

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_add_segment_counts.sql` | NEW — 3 columns on generations |
| `supabase/functions/generate-video/index.ts` | Parse + validate counts, pass to script gen + job submission, compute costs |
| `frontend/src/stores/generation-wizard.ts` | Add hooksCount/bodiesCount/ctasCount state + setters |
| `frontend/src/app/(dashboard)/generate/page.tsx` | Add stepper UI + live combo counter + updated credit display |
| `frontend/src/app/(dashboard)/generate/[id]/page.tsx` | Read counts from gen record; update allCombos, column renders, banner text |
| `frontend/src/types/generation.ts` (or wherever gen type is) | Add hooks_count/bodies_count/ctas_count fields |
| `frontend/src/stores/generation-wizard.ts` | Update loadPreset for optional count fields |

---

## Out of Scope

- Per-slot **different** segment count combinations in Advanced Mode (e.g., 5 hooks but 2 bodies) are in scope; enabling per-variant script customization for >3 variants in Advanced Mode is deferred.
- Charging for combination stitching (client-side FFmpeg remains free).
- A "max combinations" paywall gate (all plans get 1–5 per slot; tier gating is a future decision).
- UI to rename individual segments (H1, H2, etc. with custom labels) — future enhancement.

---

## Verification

1. Set mode to "Full Campaign" in wizard — confirm steppers appear for Hooks, Bodies, CTAs
2. Adjust counts — confirm combination counter updates live (e.g., 4×3×2 = 24)
3. Adjust counts — confirm credit cost updates live in the mode card
4. Submit a 2×2×2 generation — confirm 6 segment videos generated, 8 combinations in picker
5. Submit a 5×5×5 generation — confirm 15 segment videos, 125 combinations in picker
6. Confirm navigation shows "1 / 125" and prev/next cycles through all 125
7. Confirm discovery banner says "You have 125 possible combinations"
8. Load a preset without count fields — confirm defaults to 3/3/3
9. Save a 4×2×3 preset — reload page — confirm counts restore to 4/2/3
10. Confirm 3×3×3 (default) generation behaviour is unchanged
