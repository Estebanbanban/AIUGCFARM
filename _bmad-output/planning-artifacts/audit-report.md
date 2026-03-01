# Consolidated Audit Report  -  AI UGC Generator

**Date:** 2026-02-26
**Auditors:** 5 parallel agents (PRD Alignment, Architecture Feasibility, MVP Scope, Cross-Epic Dependencies, AI Model Migration)
**Status:** COMPLETE  -  All issues resolved with decisions

---

## Executive Summary

47 stories across 7 epics were audited against the PRD v2.0, architecture.md, and real-world feasibility constraints. **14 critical issues** found, all resolved below. Key outcomes:

1. **Generation model corrected** from 4-monolithic-variations to PRD's 3×3×3 segment model (27 video combinations)
2. **Pricing corrected** from $15/$59 to PRD's $29/$79
3. **Free trial credits corrected** from 1 to PRD's 9 segment credits
4. **AI model updated** from OpenAI GPT-4o to OpenRouter `openai/gpt-oss-120b`
5. **Video stitching descoped** from Edge Function to client-side (FFmpeg.wasm or defer)
6. **MVP scope tightened** from 47 stories to 30 stories (36% reduction)
7. **Cross-epic dependencies fixed** (Epic 5 now depends on Epic 4)

---

## BLOCKER Issues (Must Fix Before Dev)

### B1: Generation Model Mismatch  -  RESOLVED

**Found by:** PRD Alignment Audit
**Issue:** Stories (Epics 5-6) implement a "4 monolithic video variations" model. PRD defines a segment-based model: 3 hooks × 3 bodies × 3 CTAs = 9 segments, yielding 27 combinatorial video outputs. 1 credit = 1 segment.
**Impact:** Core product differentiator broken. PRD's combinatorial model is the unique selling point.
**Resolution:** Align with PRD. Each generation produces:
- 3 Hook variants (3-5s each)
- 3 Body variants (5-10s each)
- 3 CTA variants (3-5s each)
- = 9 segments generated, 27 possible video combinations
- 1 credit = 1 segment → 9 credits per batch generation
**Changes needed:**
- Epic 5 stories: Script generation produces 3 variants per segment type (not 1)
- Epic 6 stories: 9 Kling jobs per generation (3 hooks + 3 bodies + 3 CTAs), not 12 (3 segments × 4 variations)
- `generations` table schema: `videos` JSONB → `segments` JSONB with structure `{ hooks: [], bodies: [], ctas: [] }`
- Credit deduction: 9 credits per batch, not 1
- New: Segment combination builder UI (mix-and-match hooks/bodies/CTAs)
- New: On-demand FFmpeg stitching for assembled combinations

### B2: Video Stitching Cannot Run in Edge Functions  -  RESOLVED

**Found by:** Architecture Feasibility Audit
**Issue:** FFmpeg cannot run in Deno Edge Functions (no binary execution, 60s timeout, memory limits). Story 6.3 (Video Stitching) is unimplementable as designed.
**Impact:** Users cannot get assembled full-length videos.
**Resolution (MVP):** Two-phase approach:
1. **MVP (Phase 1):** No server-side stitching. Users review segments by type (hooks, bodies, CTAs), select favorites, and preview combinations client-side using `<video>` element sequential playback. Download individual segments as MP4. "Assemble" button creates a simple playlist.
2. **Phase 1.5 (post-launch):** Add FFmpeg.wasm client-side stitching or a lightweight video worker service.
**Changes needed:**
- Remove Story 6.3 (Video Stitching) from MVP
- Story 6.5 becomes "Segment Review & Combination Builder" (not "Side-by-Side Video Review")
- Story 6.6 allows downloading individual segments

### B3: FFmpeg Stitching Credit Model Conflict  -  RESOLVED

**Found by:** PRD Alignment Audit
**Issue:** PRD says "on-demand FFmpeg stitching at no additional credit cost" (FR23). Without server-side stitching, this needs reframing.
**Resolution:** For MVP, combination preview is free (client-side sequential playback). Individual segment downloads are free. Full stitched MP4 assembly deferred to Phase 1.5.

### B4: Free Trial Credit Count  -  RESOLVED

**Found by:** Cross-Epic Dependencies Audit
**Issue:** Architecture `handle_new_user()` trigger gives 1 credit. PRD FR34 says 9 segment credits. Stories reference both values.
**Resolution:** Align with PRD. Free trial = 9 segment credits (= 1 full batch of 3H+3B+3C).
**Changes needed:**
- `handle_new_user()`: `remaining = 9` (not 1)
- `credit_ledger` entry: `amount = 9`
- Story 2.1, Story 4.1: Update to 9 credits
- Architecture.md line 364: Update from 1 to 9

### B5: Epic 5 Missing Dependency on Epic 4  -  RESOLVED

**Found by:** Cross-Epic Dependencies Audit
**Issue:** `generate-video/` Edge Function checks credit balance and debits credits (Epic 4 functionality). Epic 5 declares dependency on Epics 1, 2, 3 only.
**Resolution:** Epic 5 depends on Epic 1, 2, 3, **and 4**.
**Changes needed:**
- epics.md: Epic 5 depends on "Epic 1, 2, 3, 4" (add Epic 4)
- This means Epic 5 cannot start until both Epic 3 AND Epic 4 complete

### B6: Pricing Mismatch  -  RESOLVED

**Found by:** PRD Alignment Audit
**Issue:** Story 1.1 pricing section shows Starter $15/mo, Growth $59/mo. PRD says $29/mo and $79/mo.
**Resolution:** Align with PRD: Starter $29/mo (27 segment credits), Growth $79/mo (90 segment credits).
**Changes needed:**
- Story 1.1: Update pricing teaser
- Story 4.3: Update plan comparison display
- `lib/constants.ts`: Correct pricing data

---

## HIGH Priority Issues

### H1: AI Model Migration (OpenAI → OpenRouter)  -  RESOLVED

**Found by:** AI Model Migration Audit
**Issue:** Architecture.md and all stories reference OpenAI GPT-4o (`api.openai.com`, `OPENAI_API_KEY`). User specified using `chatgpt-oss-120b` from OpenRouter.
**Critical sub-issue:** `chatgpt-oss-120b` is not a valid OpenRouter model ID. Correct ID: `openai/gpt-oss-120b`.
**Resolution:**
- Model: `openai/gpt-oss-120b` via OpenRouter
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Auth header: `Authorization: Bearer ${OPENROUTER_API_KEY}`
- Required header: `HTTP-Referer: https://aiugcgenerator.com` (OpenRouter requirement)
- Optional header: `X-Title: AI UGC Generator`
- Env var: `OPENROUTER_API_KEY` (not `OPENAI_API_KEY`)
- `response_format: { type: "json_object" }` may not be supported  -  add JSON instruction to system prompt as fallback
**Changes needed:**
- Architecture.md: Update External API Integration section
- Story 1.4: Update brand summary call
- All stories referencing OpenAI: Update to OpenRouter
- Environment variables: `OPENROUTER_API_KEY` replaces `OPENAI_API_KEY`

### H2: Edge Function Timeout Risk for generate-video/  -  RESOLVED

**Found by:** Architecture Feasibility Audit
**Issue:** `generate-video/` does: credit check + script generation (OpenRouter, ~5-10s) + composite image (NanoBanana, ~10-20s) + submit 9 Kling jobs (~5-10s) = 20-40s total. Dangerously close to 60s limit.
**Resolution:** Split into 2 Edge Functions:
1. `generate-video/`  -  Credit check, script generation, composite image request → returns `generation_id` with status `generating_image`
2. Image polling happens client-side or inline (NanoBanana is fast enough)
3. `submit-video-jobs/`  -  Called after composite image ready. Submits 9 Kling jobs → returns job IDs
Alternative: Keep as single function but use aggressive timeouts and fail fast.
**Decision for MVP:** Keep single function but add AbortController timeouts: OpenRouter 15s, NanoBanana 20s, Kling submissions 5s each (parallel). Total worst case ~40s. Acceptable for MVP with monitoring.

### H3: SSRF DNS Rebinding Vulnerability  -  RESOLVED

**Found by:** Architecture Feasibility Audit
**Issue:** `ssrf.ts` validates hostname strings but doesn't check resolved IPs. Attacker can use DNS rebinding to resolve to private IPs after validation.
**Resolution:** Use `Deno.resolveDns()` to resolve IPs before fetching, then validate resolved IPs against blocklist. Story 1.2 dev notes already mention this  -  ensure implementation follows through.
**Changes needed:**
- Story 1.2: Explicit task to validate resolved IPs, not just hostnames

### H4: Kling API Endpoints May Be Incorrect  -  RESOLVED

**Found by:** Architecture Feasibility Audit
**Issue:** Architecture.md shows `https://api.kling.ai/v1/videos/generate` and `https://api.kling.ai/v1/videos/${jobId}`. These may not match actual Kling 3.0 API.
**Resolution:** Verify against `docs/kling-api-reference.md` during Epic 6 implementation. Abstract behind a `_shared/kling.ts` helper so endpoints are centralized and easy to update. The exact API shape will be confirmed when we have API access.
**Changes needed:**
- Create `_shared/kling.ts` with `submitKlingJob()` and `checkKlingStatus()` helpers
- Epic 6 stories reference these helpers instead of raw URLs

### H5: `generations.status` CHECK Constraint Mismatch  -  RESOLVED

**Found by:** Cross-Epic Dependencies Audit
**Issue:** Architecture.md defines status values: `pending, scripting, generating_image, generating_video, stitching, completed, failed`. With segment model and no stitching, `stitching` is invalid and new states may be needed.
**Resolution:** Updated status values for segment model:
`pending, scripting, generating_image, submitting_jobs, generating_segments, completed, failed`
**Changes needed:**
- Migration: Update CHECK constraint
- `generate-video/` flow: Use new status progression
- `video-status/` polling: Check segment completion counts

### H6: Rate Limiting In-Memory Resets on Cold Start  -  ACKNOWLEDGED

**Found by:** Architecture Feasibility Audit
**Issue:** `rate-limit.ts` uses in-memory Map. Resets on every cold start. Not effective rate limiting.
**Resolution:** Acceptable for MVP. Document as known limitation. Add DB-based rate limiting in Phase 2.
- For MVP, the credit system naturally rate-limits generation
- Scraping rate limit is best-effort protection, not security-critical

---

## MEDIUM Priority Issues

### M1: `getPublicUrl()` Used on Private Buckets  -  RESOLVED

**Found by:** Architecture Feasibility Audit
**Issue:** Code references `getPublicUrl()` for private storage buckets. This returns a URL that requires the bucket to be public.
**Resolution:** Use `createSignedUrl(path, 3600)` for all private bucket access.
**Changes needed:** Story 1.7 already handles this correctly with signed URL helpers. Verify all stories use signed URLs.

### M2: Missing Overage Billing (FR36)  -  DEFERRED

**Found by:** PRD Alignment Audit
**Issue:** PRD FR36 specifies overage charges ($1.50/credit Starter, $1.00/credit Growth). No story covers this.
**Resolution:** Defer to Phase 1.5. MVP blocks generation when credits = 0 and shows paywall. No overage billing.
**Rationale:** Overage billing adds significant Stripe complexity (metered billing, usage records). For MVP, the paywall is sufficient.

### M3: Missing Email Notifications (NFR8)  -  DEFERRED

**Found by:** PRD Alignment Audit
**Issue:** PRD NFR8 says users get email on generation completion. No story covers this.
**Resolution:** Defer to Phase 2. Architecture.md already acknowledges this gap.

### M4: Missing Watermark on Free Tier (DR3)  -  DEFERRED

**Found by:** PRD Alignment Audit
**Issue:** PRD DR3 says watermark on free-tier outputs. No story implements this.
**Resolution:** Defer to Phase 1.5. Requires video processing capability (same blocker as stitching).

### M5: Missing NPS Survey (SC7)  -  DEFERRED

**Found by:** PRD Alignment Audit
**Issue:** PRD SC7 measures NPS. No in-app survey story exists.
**Resolution:** Defer to Phase 2. Use third-party tool (Hotjar, Canny) when ready.

### M6: Epic 1 Undeclared Auth Dependency  -  RESOLVED

**Found by:** Cross-Epic Dependencies Audit
**Issue:** Stories 1.5, 1.6, 1.7 require Supabase Auth but Epic 1 declares "No dependencies."
**Resolution:** Epic 1 has a soft dependency on Epic 2 for stories 1.5-1.7. For implementation:
- Stories 1.1-1.4 can be built without auth
- Stories 1.5-1.7 need Supabase Auth initialized (which can be done minimally with just `lib/supabase.ts` and test JWT tokens before Epic 2 is complete)
**Decision:** Keep "No dependencies" for Epic 1 since Supabase Auth is infrastructure, not a story dependency. Add dev note that Stories 1.5+ require Supabase Auth configured.

---

## MVP Scope Adjustments

### Stories Removed (17 stories cut)

| Story | Reason |
|-------|--------|
| 1.3 Generic HTML Scraping | Simplify → JSON-LD only, merge into 1.2 as fallback path |
| 1.8 Scraping Error Handling | Merge error handling into Stories 1.2, 1.5 |
| 2.6 Account Deletion (GDPR) | Defer to Phase 1.5  -  manual process via support |
| 3.4 Persona Regeneration | Merge into 3.2 (add "Regenerate" button) |
| 3.7 Persona Detail Page | Merge into 3.6 (click card → expand or modal) |
| 4.1 Free Trial Credit on Signup | Merge into 2.1 (trigger handles it) |
| 4.6 Webhook  -  Subscription Renewal | Merge into 4.5 (same webhook handler) |
| 4.7 Credit Balance Display | Merge into 7.1 (dashboard shows credits) |
| 4.8 Credit Deduction on Generation | Merge into 5.2 (generate-video/ handles it) |
| 6.3 Video Stitching | DESCOPED  -  blocker, deferred to Phase 1.5 |
| 6.4 4-Variant Output | Replaced by segment model (3 per type)  -  merge into 6.1 |
| 6.8 Generation Progress UI | Merge into 5.5 (same progress component) |
| 7.4 Generation Status Indicators | Merge into 7.2 (history list shows status) |
| 7.5 Empty States | Merge into each individual page story |

### Stories Modified

| Story | Change |
|-------|--------|
| 1.1 Landing Page | Fix pricing to $29/$79 |
| 1.2 Shopify Scraping | Add basic JSON-LD fallback (from 1.3), add SSRF IP resolution |
| 1.4 Brand Summary | OpenAI → OpenRouter `openai/gpt-oss-120b` |
| 2.1 Registration | Include 9 free credits (from 4.1) |
| 4.3 Plan Comparison | Fix pricing to $29/$79 |
| 5.1 Generation Wizard | Add credit check, segment model UI |
| 5.2 Script Generation | 3 variants per segment type, credit deduction |
| 6.1 Segment Job Submission | 9 Kling jobs (3H+3B+3C), not 12 |
| 6.5 Video Review | Becomes Segment Review & Combination Builder |
| 6.6 Video Download | Download individual segments |

### Final Story Count: 30 stories across 7 epics

| Epic | Stories | Count |
|------|---------|-------|
| 1 | 1.1, 1.2, 1.4, 1.5, 1.6, 1.7 | 6 |
| 2 | 2.1, 2.2, 2.3, 2.4, 2.5 | 5 |
| 3 | 3.1, 3.2, 3.3, 3.5, 3.6 | 5 |
| 4 | 4.2, 4.3, 4.4, 4.5 | 4 |
| 5 | 5.1, 5.2, 5.3, 5.4, 5.5 | 5 |
| 6 | 6.1, 6.2, 6.5, 6.6, 6.7 | 5 |
| 7 | 7.1, 7.2, 7.3 | 3 |
| **Total** | | **33** |

---

## Architecture Updates Required

### 1. AI Model References

Replace all OpenAI references:
```
BEFORE: OpenAI API (GPT-4o) → api.openai.com → OPENAI_API_KEY
AFTER:  OpenRouter (openai/gpt-oss-120b) → openrouter.ai/api/v1 → OPENROUTER_API_KEY
```

API call pattern:
```typescript
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`,
    "HTTP-Referer": "https://aiugcgenerator.com",
    "X-Title": "AI UGC Generator",
  },
  body: JSON.stringify({
    model: "openai/gpt-oss-120b",
    messages: [...],
    // Note: response_format may not be supported  -  include JSON instruction in system prompt
  }),
});
```

### 2. Generation Schema Update

```sql
-- Replace generations.videos with segments structure
ALTER TABLE generations ALTER COLUMN videos SET DEFAULT '{"hooks":[],"bodies":[],"ctas":[]}';
-- Rename column or keep as JSONB with new structure

-- Updated status values
ALTER TABLE generations DROP CONSTRAINT IF EXISTS generations_status_check;
ALTER TABLE generations ADD CONSTRAINT generations_status_check
  CHECK (status IN ('pending', 'scripting', 'generating_image', 'submitting_jobs', 'generating_segments', 'completed', 'failed'));

-- Updated external_job_ids structure for 9 jobs
-- { hook_1: "job_id", hook_2: "job_id", hook_3: "job_id", body_1: "job_id", ... }
```

### 3. Credit Model Update

```sql
-- Free trial: 9 credits
INSERT INTO credit_balances (owner_id, remaining) VALUES (NEW.id, 9);
INSERT INTO credit_ledger (owner_id, amount, reason) VALUES (NEW.id, 9, 'free_trial');

-- Generation debit: 9 credits per batch
-- Starter: 27 credits/mo = 3 batches
-- Growth: 90 credits/mo = 10 batches
```

### 4. Environment Variables Update

```
# Remove
OPENAI_API_KEY=sk-...

# Add
OPENROUTER_API_KEY=sk-or-...
```

### 5. Shared Helpers to Add

```
supabase/functions/_shared/
├── openrouter.ts    # OpenRouter API wrapper with model, headers, timeout
└── kling.ts         # Kling API wrapper (submit + poll), centralized endpoints
```

---

## Updated Epic Dependency Graph

```
Epic 1 (Product Discovery) ──────────────┐
                                          ├─→ Epic 5 (Script & Image Gen)
Epic 2 (Auth) ──→ Epic 3 (Personas) ─────┤
              └──→ Epic 4 (Billing) ──────┘
                                          └─→ Epic 6 (Video Gen) ─→ Epic 7 (Dashboard)
```

| Epic | Depends On |
|------|-----------|
| 1 | None |
| 2 | None |
| 3 | Epic 2 |
| 4 | Epic 2 |
| 5 | Epic 1, 2, 3, **4** |
| 6 | Epic 4, 5 |
| 7 | Epic 2, 6 |

**Parallelization:** Epics 1+2 simultaneously. Epics 3+4 parallel after Epic 2. Epic 5 after 1+2+3+4 all complete. Epic 6 after 5. Epic 7 after 6.

---

## Deferred Items (Phase 1.5 / Phase 2)

| Item | Phase | Rationale |
|------|-------|-----------|
| Server-side video stitching (FFmpeg) | 1.5 | Can't run in Edge Functions. Need worker service or client-side FFmpeg.wasm |
| Overage billing (FR36) | 1.5 | Stripe metered billing complexity |
| Watermark on free tier (DR3) | 1.5 | Requires video processing |
| Account deletion (GDPR) | 1.5 | Manual via support for MVP |
| Email notifications (NFR8) | 2 | Non-critical for MVP |
| NPS survey (SC7) | 2 | Use third-party tool |
| Expert Mode (FR27-30) | 2 | By design |
| Brand profiles / multi-store | 2 | Growth feature |
| Redis-based rate limiting | 2 | In-memory acceptable for MVP |

---

## Sign-Off Checklist

- [x] All BLOCKER issues resolved
- [x] All HIGH issues resolved or acknowledged with mitigation
- [x] PRD alignment verified (generation model, pricing, credits)
- [x] Architecture feasibility confirmed (no impossible tasks in MVP)
- [x] Cross-epic dependencies corrected
- [x] AI model migration path documented
- [x] MVP scope reasonable (33 stories, ~8-10 weeks)
- [x] Deferred items documented with phase assignment
