# QA Report: Script Review Before Video Generation

**Date:** 2026-02-27
**Auditor:** QA Agent
**Scope:** Script review feature (phase "script" / "full" flow)

---

## 1. Auth Ownership -- Can user A approve user B's generation?

**PASS** (after fix)

The `phase:"full"` block (line 331) looks up the generation by `id`, then checks `gen.owner_id !== userId` on line 344, returning 403 on mismatch. This is correct.

However, the **atomic locking update** (line 351) originally did NOT include `.eq("owner_id", userId)`. While the auth check above would normally catch this, it left a TOCTOU (time-of-check-to-time-of-use) gap: a crafted concurrent request could theoretically slip past.

**Fix applied:** Added `.eq("owner_id", userId)` to the locking UPDATE query in `supabase/functions/generate-video/index.ts` line 355. The locking query now reads:

```ts
.update({ status: "locking" })
.eq("id", generation_id)
.eq("owner_id", userId)
.eq("status", "awaiting_approval")
```

---

## 2. Double-Charge Protection

**PASS**

The atomic lock pattern is sound: the UPDATE with `.eq("status", "awaiting_approval")` acts as an optimistic lock. If two concurrent requests hit this, only one will match (PostgreSQL row-level locking ensures the UPDATE is atomic). The loser gets `lockRows.length === 0` and receives a 409 response.

Credit debit only happens AFTER the lock succeeds (line 421). There are no other code paths that debit for an `awaiting_approval` generation. The legacy flow (line 666+) creates a separate record in `scripting` status and never touches `awaiting_approval` records.

---

## 3. Locking Status Stuck

**PASS** (with caveat)

If the server crashes after setting status to `locking` but before `submitting_jobs`, the generation would be stuck in `locking` state. However, the code handles the failure case:

- Lines 482-505: The entire post-debit pipeline is wrapped in a try/catch.
- On failure, credits are refunded (line 488) and status is set to `failed` (line 501).
- If the crash happens between the `locking` update and entering the try block (lines 430-431), there is a narrow window where `locking` could persist.

This window is very small (single sequential statement) and acceptable for an MVP. A production hardening step would be a cron job that resets any generation stuck in `locking` for more than 5 minutes back to `awaiting_approval`.

---

## 4. Per-Section Regenerate Creates Orphan Records

**NOTE** (known issue, not blocking)

Each per-section regenerate button (line 1434 in `generate/page.tsx`) calls `generateScript.mutate` with `phase: "script"`, which creates a **new generation record** in `awaiting_approval` status. The `onSuccess` handler (line 1455) updates `pendingGenerationId` to the new one, but the **old generation record** stays in `awaiting_approval` forever.

Over time this will accumulate orphan records. Recommended cleanup:
- Add a scheduled job to delete `awaiting_approval` generations older than 24 hours.
- Alternatively, have the per-section regenerate call a dedicated endpoint that reuses the existing generation record.

---

## 5. TypeScript Exhaustiveness

**PASS**

Running `bun run tsc --noEmit` from `frontend/` produces zero errors.

---

## 6. useGenerationStatus Polling for `locking`

**PASS** (acceptable)

The `refetchInterval` in `useGenerationStatus` (line 191 of `use-generations.ts`) stops polling for `completed`, `failed`, and `awaiting_approval`. It does NOT stop for `locking`.

However, `locking` is an extremely transient state (typically < 1 second). The 5-second poll interval means at most 1-2 unnecessary requests before the status transitions to `submitting_jobs` or `failed`. This is acceptable and does not cause user-visible issues.

---

## 7. CTA Style Selector

**NOTE** (not wired to backend)

The frontend properly sends `cta_style` in the request body:
- `handleGenerateScript()` (line 451): `cta_style: store.ctaStyle`
- Per-section regenerate (line 1441): `cta_style: store.ctaStyle`
- Legacy flow (line 523): `cta_style: store.ctaStyle`

However, the **edge function never reads `cta_style`**. The destructured body on line 326 only extracts `{ phase, generation_id, override_script }`, and line 512 extracts `{ product_id, persona_id, mode, quality, composite_image_path }`. `cta_style` is silently ignored.

This is a pre-existing gap (not introduced by the script review feature) -- the CTA style field exists in the frontend UI but has never been consumed by the script generation prompt. The LLM picks CTA style automatically. This should be tracked as a backlog item to wire `cta_style` into the system prompt when the team wants to support user-directed CTA styles.

---

## 8. Script Edits on override_script

**PASS**

The flow is correctly wired end-to-end:

1. **Textarea edits** call `store.updateScriptSection(sectionType, idx, e.target.value)` (line 1423)
2. `updateScriptSection` in the store (line 109) uses Immer to mutate `pendingScript[type][index].text`
3. **Approve button** calls `handleApproveAndGenerate()` (line 1520), which passes `override_script: store.pendingScript` (line 487)
4. The hook `useApproveAndGenerate` sends `{ generation_id, override_script, phase: "full" }` to the edge function (line 120)
5. The edge function validates and saves the override script (lines 373-378)

User edits are correctly preserved and sent on approval.

---

## 9. Credits Shown Correctly

**PASS**

Step 5 displays the credit cost using `store.creditsToCharge ?? effectiveCost` (line 1489). The `store.creditsToCharge` is set from the `credits_to_charge` field returned by the `phase:"script"` response (line 461 via `setPendingScript`). The edge function returns `credits_to_charge: effectiveCost` on line 628, which accounts for first-video discount. This is correct.

---

## 10. Back Button from Step 5

**NOTE** (known issue, not blocking)

When the user clicks Back from Step 5 (line 1511-1514), `clearPendingScript()` is called, which resets `pendingGenerationId`, `pendingScript`, and `creditsToCharge` in the store. The user returns to Step 4.

The `awaiting_approval` generation record created by the initial `phase:"script"` call stays in the database. No credits were charged, so there is no financial impact. This is the same orphan issue as item 4 and should be addressed with the same cleanup mechanism.

---

## Summary

| # | Check | Result |
|---|-------|--------|
| 1 | Auth ownership on locking | **PASS** (fixed: added `owner_id` to lock query) |
| 2 | Double-charge protection | **PASS** |
| 3 | Locking status stuck | **PASS** (narrow crash window acceptable for MVP) |
| 4 | Orphan `awaiting_approval` records from regenerate | **NOTE** (tech debt) |
| 5 | TypeScript exhaustiveness | **PASS** (0 errors) |
| 6 | Polling for `locking` status | **PASS** (transient state, acceptable) |
| 7 | CTA style not consumed by backend | **NOTE** (pre-existing gap, not regression) |
| 8 | Script edits sent as override_script | **PASS** |
| 9 | Credits shown correctly | **PASS** |
| 10 | Back button orphan record | **NOTE** (same as #4, no financial impact) |

**Fixes applied:** 1 code change in `supabase/functions/generate-video/index.ts` (added `owner_id` guard on locking update).
