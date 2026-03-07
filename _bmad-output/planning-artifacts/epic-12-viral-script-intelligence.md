# Epic 12: Viral-Framework Script Generation & Brand Intelligence

**Status:** Proposed — Awaiting approval
**Owner:** engineering
**Created:** 2026-03-07
**Priority:** P0 — Core product quality

---

## Context & Motivation

The current script generation system produces generic UGC copy. The brand context it receives is thin (3 fields: `tone`, `demographic`, `selling_points`), and the hook/body/CTA frameworks in the system prompt are not informed by real viral UGC performance data.

Two root causes:

1. **Thin brand intelligence at import** — `scrape-product` generates a minimal brand summary. It has no concept of the brand's unique value prop, customer pain points, price positioning relative to category, social proof signals, or product category normalization. Scripts built on this context are generic by design.

2. **System prompts disconnected from viral mechanics** — The hook angles exist but aren't mapped to product categories or the frameworks that drive real TikTok/Reels virality. The body prompt doesn't enforce continuation from hook. The CTA prompt still sounds like marketing copy rather than authentic peer recommendation.

This epic fixes both layers. It introduces a richer **Brand Profile** extracted at import (user-validated before generation), and rewrites the system prompts using the SGE viral playbook frameworks — hook category mapping, specificity enforcement, invisible CTA philosophy.

**No DB schema migration needed** — `brand_summary` is already stored as JSONB. We expand the JSON payload.

---

## Files Affected

| File | Role |
|------|------|
| `supabase/functions/scrape-product/index.ts` | Expand `generateBrandSummary()` prompt + `BrandSummary` interface |
| `supabase/functions/generate-video/index.ts` | Rewrite `buildSystemPrompt()` and `buildUserPrompt()` |
| `supabase/functions/generate-segment-script/index.ts` | Prompt parity — same improvements to `SEGMENT_SYSTEM_PROMPTS` and `buildUserPrompt()` |
| `frontend/src/types/database.ts` | Expand `BrandSummary` interface |
| `frontend/src/components/products/ScrapeResults.tsx` | Add Brand Profile editable card |
| `frontend/src/app/(dashboard)/products/[id]/page.tsx` | Render new brand_summary fields, enable edit/save |
| `frontend/src/app/(dashboard)/products/page.tsx` | Display new fields in product card if shown |

---

## Known Risks & De-risks (from codebase audit)

| Risk | Severity | Decision |
|------|----------|----------|
| `social_proof` and `competitor_positioning` — parsing arbitrary page schemas is fragile, will fail silently for most non-standard stores | Medium | **De-risked:** Both fields stay in the LLM inference prompt (LLM infers from product descriptions). No scraper-specific HTTP calls or schema parsing. Gracefully null when LLM can't infer. |
| Coherence review in `generate-video` = 2× LLM calls (up to 60s total) | Medium | **Out of scope for this epic.** Flagged as a follow-up latency optimization. Do not touch coherence review logic. |
| Competitor positioning and social proof inference accuracy | Low | LLM inference is best-effort. Users can correct via the Brand Profile Card (12.2). |

---

## Story Breakdown

### Story 12.0 — Bug Fixes: Brand Summary Coverage (MUST SHIP FIRST)

**Who:** Agent A (prepend to Story 12.1 work, same PR)
**Depends on:** Nothing
**Files:** `supabase/functions/scrape-product/index.ts`, `supabase/functions/upload-product/index.ts`

Two correctness bugs that corrupt brand summary data before it ever reaches scripts. Must be fixed before expanding the schema.

#### Bug 1 — brand_summary null for non-first scraped products (scrape-product/index.ts ~line 494)

**Root cause:**
```ts
// Current — WRONG
brand_summary: i === 0 ? brandSummary : null,
```
The API response sends `brand_summary: null` for every product except `products[0]`, even though all DB rows are saved with the correct `brand_summary`. The UI (`ScrapeResults.tsx`) reads from the API response, not the DB — so it only shows brand summary context for the first product.

**Fix:**
```ts
// Corrected
brand_summary: brandSummary,
```
All products in the response get the brand summary. It's brand-level data, not product-level, so broadcasting it to all products in the response is correct.

#### Bug 2 — Manual upload products get zero brand summary (upload-product/index.ts)

**Root cause:** `upload-product` saves the product directly without calling `generateBrandSummary()`. Manual upload users get `brand_summary: null`, which means their scripts get no brand context — the LLM falls back to `"conversational, authentic"` tone and `"general adults"` demographic.

**Fix:** After saving the product, call `generateBrandSummary()` with the uploaded product data. Use the same graceful degradation pattern as `scrape-product` (null on failure, not an error).

```ts
// After product insert in upload-product/index.ts
const brandSummary = await generateBrandSummary([uploadedProduct]);
if (brandSummary) {
  await sb.from("products").update({ brand_summary: brandSummary }).eq("id", insertedId);
}
```

**Note:** `generateBrandSummary()` must be extracted into `supabase/functions/_shared/brand-summary.ts` and imported by both `scrape-product` and `upload-product`. Do not duplicate the function.

#### Acceptance Criteria

- [ ] `scrape-product` API response sends `brand_summary` for ALL products, not just `products[0]`
- [ ] `upload-product` calls `generateBrandSummary()` after insert and saves result
- [ ] `generateBrandSummary()` extracted to `_shared/brand-summary.ts`
- [ ] Both functions import from shared file (no duplication)
- [ ] TypeScript compiles with 0 errors across both functions

---

### Story 12.1 — Expand Brand Profile Schema & Scraping LLM

**Who:** Backend Agent
**Depends on:** Nothing (independent)
**Files:** `supabase/functions/scrape-product/index.ts`, `frontend/src/types/database.ts`

#### What to build

Expand `generateBrandSummary()` in `scrape-product/index.ts` to produce a richer brand profile JSON. Update the TypeScript interface in `frontend/src/types/database.ts` to match.

#### Current state

```ts
// scrape-product/index.ts — current LLM prompt
'Return a JSON object with exactly these keys: "tone" (1-2 words), "demographic" (1 sentence), "selling_points" (array of 3-5 strings)'

// database.ts — current interface
export interface BrandSummary {
  tone: string;
  demographic: string;
  selling_points: string[];
}
```

#### New state

New LLM system prompt for `generateBrandSummary()`:

```
You are a brand strategist and UGC copywriter. Given product data from an e-commerce brand,
return a JSON object with EXACTLY these keys:

"tone"                  — Brand voice in 1-2 words (e.g. "playful", "premium", "clinical")
"demographic"           — Primary target customer in 1 sentence
"selling_points"        — Array of 3-5 specific, concrete selling points (NOT generic phrases)
"tagline"               — Brand's actual slogan/tagline if detectable, else null
"unique_value_prop"     — What makes this brand different from competitors in 1 sentence. Be specific.
"customer_pain_points"  — Array of 2-4 specific problems the target customer experiences that this product solves. Written as first-person frustrations ("I can't find...", "I hate that...").
"social_proof"          — Any trust signals visible in the data: review count, star rating, press mentions, certifications. String or null.
"price_positioning"     — One of: "budget" | "mid" | "premium" — based on price relative to this product category.
"product_category"      — One of: "beauty" | "food" | "fitness" | "supplements" | "fashion" | "home" | "tech" | "pet" | "baby" | "outdoor" | "other"
"competitor_positioning"— If the product descriptions mention alternatives or competitors being replaced, name them. String or null.

Return ONLY valid JSON. No markdown. No explanations.

⚠️ DE-RISK NOTE: "social_proof" and "competitor_positioning" are best-effort inference
from product description text only. Do NOT add any additional HTTP calls or DOM scraping
logic to extract these. The LLM infers from what's already in the product data. If it
can't infer them, return null. Both fields are optional and the user can fill them in
manually via the Brand Profile Card (Story 12.2).
```

New `BrandSummary` interface in `frontend/src/types/database.ts`:

```ts
export interface BrandSummary {
  // Existing (keep backwards-compatible)
  tone: string;
  demographic: string;
  selling_points: string[];
  // New fields (all optional for backward compat with old records)
  tagline?: string | null;
  unique_value_prop?: string | null;
  customer_pain_points?: string[];
  social_proof?: string | null;
  price_positioning?: "budget" | "mid" | "premium" | null;
  product_category?: string | null;
  competitor_positioning?: string | null;
}
```

#### Acceptance Criteria

- [ ] `generateBrandSummary()` LLM prompt updated with all 10 fields
- [ ] Validation in `generateBrandSummary()` checks for required keys (`tone`, `demographic`, `selling_points`) — new fields degrade gracefully if null
- [ ] `BrandSummary` interface updated in `database.ts` — all new fields optional
- [ ] Old brand_summary records (missing new fields) don't break any consuming code
- [ ] TypeScript compiles with 0 errors after interface change

---

### Story 12.2 — Brand Profile Editable Card in Product UI ⭐ Highest ROI

**Who:** Frontend Agent
**Depends on:** Story 12.1 (needs new BrandSummary fields)
**Files:** `frontend/src/components/products/ScrapeResults.tsx`, `frontend/src/app/(dashboard)/products/[id]/page.tsx`

#### What to build

Add a **Brand Profile card** to the product import confirmation screen (`ScrapeResults.tsx`) and the product detail page (`products/[id]/page.tsx`). Users can review and edit the AI-extracted brand context before generating ads.

This is the critical "validate brand context" UX moment that currently doesn't exist — users only validate product details, not the brand intelligence that drives script quality.

#### Current state

`ScrapeResults.tsx` shows a small `brandSummary` badge (tone + demographic + 3 selling points, read-only). `products/[id]/page.tsx` shows `brand_summary` as read-only chips.

#### New state

**New `BrandProfileCard` component** (create `frontend/src/components/products/BrandProfileCard.tsx`):

```
┌─────────────────────────────────────────────────────────┐
│ 🎯 Brand Profile  [Edit]                                │
│ ─────────────────────────────────────────────────────── │
│ Category:        [beauty ▾]                             │
│ Tone:            [playful]                              │
│ Price position:  [Budget] [Mid] [Premium]  ← toggle    │
│                                                         │
│ Value proposition:                                      │
│ [The only skincare brand that...           ] ← editable│
│                                                         │
│ Customer pain points:                                   │
│ [I can't find moisturizer that... ×]  [+ Add]          │
│ [Drugstore brands break me out ×]                       │
│                                                         │
│ Social proof:                                           │
│ [4.8★ from 2,400 reviews               ] ← editable   │
│                                                         │
│ Tagline (optional):                                     │
│ [Skin you'll love, naturally.]                         │
└─────────────────────────────────────────────────────────┘
```

**Edit flow:**
- Card renders in read mode by default
- "Edit" button → fields become editable inputs
- "Save" → PATCH `confirm-products` or directly update product record via Supabase client
- Validation: `unique_value_prop` max 120 chars, `customer_pain_points` max 4 items

**Integration points:**
- `ScrapeResults.tsx`: Render `BrandProfileCard` below the product list, before the "Confirm & Continue" button
- `products/[id]/page.tsx`: Render `BrandProfileCard` in the product detail sidebar (line ~610 where brand_summary currently shows)

#### Acceptance Criteria

- [ ] `BrandProfileCard` component created with all 7 editable fields
- [ ] Category shown as dropdown (10 options from the schema)
- [ ] Price positioning shown as 3-way toggle (budget/mid/premium)
- [ ] Pain points shown as chips with × remove and + add
- [ ] Edit/Save/Cancel flow works without page reload
- [ ] Save updates `brand_summary` in the product record
- [ ] Card renders gracefully when new fields are null (shows "Not detected — add manually")
- [ ] Card renders gracefully for old products missing new fields (same null handling)
- [ ] No layout regression on `ScrapeResults.tsx` or `products/[id]/page.tsx`

---

### Story 12.3 — Category-Aware Hook Framework in System Prompt

**Who:** Prompt Engineer Agent
**Depends on:** Nothing (pure prompt change in `generate-video/index.ts`)
**Files:** `supabase/functions/generate-video/index.ts` — `buildSystemPrompt()` function

#### What to build

Rewrite the HOOK section of `buildSystemPrompt()` with:
1. 4 new viral hook angles from SGE playbook
2. Category-aware angle shortlisting
3. Specificity forcing rule
4. Emotional verb bank per category

#### Current state (hook section)

```
HOOK — N variants | 2-4 seconds each | 5-10 words max
Available hook angles: pain_point, skeptic_convert, specific_result, pattern_interrupt,
direct_address, before_after, social_proof, gatekeeping
```

#### New state (hook section)

New `buildSystemPrompt()` signature takes a third `brandContext` parameter:

```ts
function buildSystemPrompt(
  count: number,
  language: string,
  brandContext?: {
    product_category?: string | null;
    price_positioning?: string | null;
    customer_pain_points?: string[];
  }
): string
```

**New hook angles to add:**

| Angle | Description | Best for |
|-------|-------------|---------|
| `late_discovery` | "how did I not know this existed??" — viewer feels behind, must watch | food, beauty, kitchen, home |
| `price_shock` | Opens with the price gap vs expensive alternative ("$24 vs $80 for the same result") | budget-positioned products |
| `specificity_lead` | Opens with a hard number ("Lost 8 lbs. Used this one thing.") | fitness, supplements, productivity |
| `everyone_knows_but_you` | "I've seen this everywhere so I finally caved and..." — social proof of social proof | trending, viral products |

**Category-aware shortlist injection:**

```ts
const CATEGORY_HOOK_SHORTLIST: Record<string, string[]> = {
  beauty:      ["late_discovery", "gatekeeping", "before_after", "skeptic_convert"],
  food:        ["late_discovery", "specific_result", "pain_point", "social_proof"],
  fitness:     ["specificity_lead", "before_after", "skeptic_convert", "specific_result"],
  supplements: ["specificity_lead", "skeptic_convert", "pain_point", "specific_result"],
  fashion:     ["before_after", "gatekeeping", "everyone_knows_but_you", "pattern_interrupt"],
  home:        ["late_discovery", "pain_point", "specific_result", "social_proof"],
  tech:        ["skeptic_convert", "specificity_lead", "late_discovery", "pattern_interrupt"],
  pet:         ["pain_point", "before_after", "late_discovery", "specific_result"],
  default:     ["pain_point", "skeptic_convert", "specific_result", "gatekeeping"],
};
```

Inject into system prompt:
```
For THIS product category (${category}), prioritize these angles in this order:
${shortlist.join(", ")}
Use an angle outside this list only if it clearly fits better.
```

**Specificity forcing rule** (new hard constraint):
```
SPECIFICITY RULE — NON-NEGOTIABLE:
Every hook MUST contain at least one of:
- A specific number or measurement ("8 lbs", "30 seconds", "$24")
- A time frame ("in 2 weeks", "after 3 uses", "since January")
- A named problem ("dry patches", "postpartum hair loss", "3pm crash")
- A first-person micro-story opener ("I've been [doing X] for [Y] years")
A hook that contains none of these is REJECTED. Rewrite until it has one.
```

**Emotional verb bank per category** (inject after specificity rule):
```
Calibrate emotional language to category:
- beauty/fashion: obsessed, embarrassed, shocked, can't stop, crying
- food/kitchen: addicted, can't stop making, obsessed, genuinely love
- fitness/supplements: couldn't believe, genuinely shocked, didn't expect
- tech/home: frustrated then relieved, annoyed that I didn't know, finally
- general: honestly, actually, I swear, lowkey, genuinely
```

#### Acceptance Criteria

- [ ] `buildSystemPrompt()` accepts optional `brandContext` parameter
- [ ] 4 new hook angles documented in the prompt
- [ ] Category shortlist injected when `product_category` is provided
- [ ] Specificity rule added as hard constraint
- [ ] Emotional verb bank injected per category
- [ ] Language block still appears FIRST (not displaced by new sections)
- [ ] TypeScript compiles with 0 errors

---

### Story 12.4 — Body Continuation Rules + CTA SGE Overhaul

**Who:** Prompt Engineer Agent (same agent as 12.3, sequential)
**Depends on:** 12.3 (same function, same PR)
**Files:** `supabase/functions/generate-video/index.ts` — `buildSystemPrompt()` function

#### What to build

Rewrite BODY and CTA sections of `buildSystemPrompt()`.

#### Body section changes

**Add explicit bad/good examples** to the "CRITICAL BODY RULES" block:

```
BAD (restatement): Hook = "I used to hate cooking" → Body = "Cooking was such a struggle for me..."
GOOD (continuation): Hook = "I used to hate cooking" → Body = "This app gave me 30 recipes in my budget in 10 seconds."

BAD (restatement): Hook = "I couldn't sleep for months" → Body = "Sleep was a real problem until I tried..."
GOOD (continuation): Hook = "I couldn't sleep for months" → Body = "Two capsules. I was out in 20 minutes. First full night in 4 months."
```

**Add `price_anchor` body structure:**

```
- price_anchor: (use when price_positioning is "budget") "[Expensive alternative] goes for $X-Y.
  This does the same thing for $Z. [Specific result or feature that matches]."
```

This structure is injected conditionally — only when `brandContext.price_positioning === "budget"` and a competitor is mentioned.

#### CTA section changes

**Replace current CTA philosophy header:**

```
OLD:
"One clear action. Low friction. Natural, not pushy. Never just 'buy now.'"

NEW:
"The CTA must NEVER feel like an ad. It must feel like a friend finishing a thought.
The product NAME should NOT appear in the CTA text. The viewer must feel they are
acting on their own curiosity, not responding to a sales pitch.
An invisible CTA outperforms a clear pitch 3x on TikTok/Reels.
The goal: the viewer opens the comments or bio looking for the link themselves."
```

**Add 3 new CTA patterns** (from SGE playbook):

| Pattern | Description | Example |
|---------|-------------|---------|
| `comment_bait` | Ask viewer to comment a word, highest engagement + algorithm signal | "Comment 'glow' and I'll send you the link — I promise" |
| `caption_tease` | Point to bio/caption casually, discovery feel | "I linked the exact one I use in the caption" |
| `friend_rec` | Peer pressure without hype | "If you're dealing with [pain], just try it. I promise." |

**Remove** the implied "link's in bio" generic pattern and replace with these three more authentic-sounding variants.

#### Acceptance Criteria

- [ ] Bad/good continuation examples added to body section
- [ ] `price_anchor` body structure added with conditional injection note
- [ ] CTA philosophy header rewritten to "invisible CTA" framing
- [ ] 3 new CTA patterns added (`comment_bait`, `caption_tease`, `friend_rec`)
- [ ] Old `link_drop` pattern updated to `caption_tease` (renamed + description clarified)
- [ ] TypeScript compiles with 0 errors

---

### Story 12.5 — buildUserPrompt() Enrichment

**Who:** Prompt Engineer Agent (same agent as 12.3+12.4, sequential)
**Depends on:** 12.3 + 12.4 (same function)
**Files:** `supabase/functions/generate-video/index.ts` — `buildUserPrompt()` function

#### What to build

Update `buildUserPrompt()` to pass all new `brand_summary` fields into the LLM context. Currently only passes `tone`, `demographic`, `selling_points`.

#### Current state

```ts
function buildUserPrompt(product, language): string {
  const brandSummary = (product.brand_summary ?? {}) as Record<string, unknown>;
  const base = `Product: ${product.name}
Description: ${product.description}
Price: ${product.price ?? "N/A"}
Brand tone: ${brandSummary.tone ?? "conversational, authentic"}
Target demographic: ${brandSummary.demographic ?? "general adults"}
Key selling points: ${brandSummary.selling_points ?? "N/A"}`;
```

#### New state

```ts
function buildUserPrompt(product, language, brandContext?): string {
  const bs = (product.brand_summary ?? {}) as BrandSummary;

  // Core (existing)
  let base = `Product: ${product.name}
Price: ${product.price ?? "N/A"} ${product.currency ?? ""}
Description: ${product.description}
Brand tone: ${bs.tone ?? "conversational, authentic"}
Target demographic: ${bs.demographic ?? "general adults"}
Key selling points: ${(bs.selling_points ?? []).join("; ")}`;

  // New fields — only inject if present
  if (bs.unique_value_prop) {
    base += `\nUnique value proposition: ${bs.unique_value_prop}`;
  }
  if (bs.customer_pain_points?.length) {
    base += `\nCustomer pain points (first-person voice of the buyer):\n${bs.customer_pain_points.map(p => `  - ${p}`).join("\n")}`;
  }
  if (bs.social_proof) {
    base += `\nSocial proof: ${bs.social_proof}`;
  }
  if (bs.price_positioning) {
    base += `\nPrice positioning: ${bs.price_positioning} (relative to this product category)`;
  }
  if (bs.competitor_positioning) {
    base += `\nCompetitor context: ${bs.competitor_positioning}`;
  }
  if (bs.tagline) {
    base += `\nBrand tagline: "${bs.tagline}"`;
  }

  // Calibration block
  base += `\n\nCALIBRATION:
- Use the customer pain points above as raw material for hook angles.
- Mirror the customer's exact language from pain points (don't paraphrase).
- If price_positioning is "budget" and a competitor is mentioned, anchor against it in the body.
- Match brand tone throughout: ${bs.tone ?? "conversational"}.`;
```

Also: pass `brandContext` to `buildSystemPrompt()` call so the category shortlist is injected:

```ts
const systemPrompt = buildSystemPrompt(variantCount, language, {
  product_category: bs.product_category,
  price_positioning: bs.price_positioning,
  customer_pain_points: bs.customer_pain_points,
});
```

#### Acceptance Criteria

- [ ] All 7 new brand_summary fields conditionally injected (no crashes when null)
- [ ] `customer_pain_points` formatted as bullet list
- [ ] `buildSystemPrompt()` receives `brandContext` with category + price_positioning
- [ ] Calibration block added at end of user prompt
- [ ] Old products without new fields degrade gracefully (all `??` guarded)
- [ ] TypeScript compiles with 0 errors

---

### Story 12.6 — Prompt Parity in generate-segment-script

**Who:** Parity Agent
**Depends on:** Stories 12.3 + 12.4 + 12.5 (must match same prompt improvements)
**Files:** `supabase/functions/generate-segment-script/index.ts`

#### What to build

`generate-segment-script` handles Advanced Mode per-segment regeneration. It has its own `SEGMENT_SYSTEM_PROMPTS` (one per segment type: hook/body/cta) and its own `buildUserPrompt()`. These are currently at a lower quality than the main `generate-video` prompts.

Port all improvements from Stories 12.3–12.5 into this function.

#### Current state

```ts
const SEGMENT_SYSTEM_PROMPTS: Record<SegmentType, string> = {
  hook: "...(older, shorter hook prompt)...",
  body: "...(older body prompt)...",
  cta:  "...(older cta prompt)...",
};

function buildUserPrompt(product, segmentType, variantIndex, ctaStyle, ctaCommentKeyword, language): string {
  // Only passes: name, description, price, tone, demographic, selling_points, variant_index
}
```

#### Changes required

1. **`SEGMENT_SYSTEM_PROMPTS.hook`** — add all new hook angles, specificity rule, emotional verb bank, category shortlist support
2. **`SEGMENT_SYSTEM_PROMPTS.body`** — add bad/good continuation examples, `price_anchor` structure
3. **`SEGMENT_SYSTEM_PROMPTS.cta`** — rewrite with invisible CTA philosophy, add `comment_bait`, `caption_tease`, `friend_rec`
4. **`buildUserPrompt()`** — add all 7 new brand_summary fields (identical to 12.5)
5. The function already receives `product_id` and fetches the full product from DB — so `brand_summary` is already available. No input change needed.

#### Acceptance Criteria

- [ ] All three `SEGMENT_SYSTEM_PROMPTS` updated to match 12.3+12.4 quality
- [ ] `buildUserPrompt()` passes all new brand_summary fields
- [ ] Category shortlist injected when product_category is set
- [ ] Invisible CTA philosophy applied to CTA prompt
- [ ] TypeScript compiles with 0 errors

---

### Story 12.7 — QA Validation: Script Quality & Regression

**Who:** QA Agent
**Depends on:** All stories (12.1–12.6 complete)
**Files:** Read-only audit — no code changes unless critical bugs found

#### What to validate

Run a structured quality audit across 5 product categories to verify improvements vs baseline.

**Test matrix (5 product types × old vs new):**

| Category | Test product | What to verify |
|----------|-------------|----------------|
| Beauty | Moisturizer, ~$30, "budget" positioning | `late_discovery` or `gatekeeping` hook used; pain points from brand profile appear; CTA doesn't name product |
| Supplements | Protein powder, ~$45, "mid" positioning | `specificity_lead` hook with a number; body continues from hook (no restatement); body doesn't reopen pain |
| Food/Kitchen | Meal planning app or cooking tool | `late_discovery` hook; emotional verb "addicted" or "obsessed"; CTA feels peer-to-peer |
| Home | Storage/organization product, "budget" | `price_anchor` body structure when competitor_positioning present; `pain_point` hook |
| Fashion | Clothing item, "mid-premium" | `before_after` or `everyone_knows_but_you` hook; brand tone mirrors in word choice |

**Checklist per generated script:**

```
Hook:
  ✓ Contains at least one: number / time frame / named pain / micro-story opener
  ✓ Angle matches category shortlist
  ✓ ≤12 words (or longer only if ultra-specific personal hook)

Body:
  ✓ Does NOT restate or echo the hook's opening problem
  ✓ Continues logically from hook (delivers proof/result/detail)
  ✓ price_anchor present when price_positioning=budget AND competitor present

CTA:
  ✓ Product name NOT in CTA text
  ✓ Uses one of: comment_bait / caption_tease / friend_rec / risk_reversal
  ✓ Feels like peer recommendation, not pitch

Overall:
  ✓ No blacklisted words: "game-changer", "amazing", "incredible", "life-changing", "must-have"
  ✓ duration_seconds calibrated to word count (2.5 words/sec)
  ✓ TypeScript: 0 errors
  ✓ No runtime errors in edge function logs
```

**Regression check:**
- Verify ScrapeResults.tsx still renders for products with OLD brand_summary (missing new fields) — no crash
- Verify generate-video still works without brand_summary at all (null case)

#### Acceptance Criteria

- [ ] All 5 product types pass the hook/body/CTA checklist
- [ ] No blacklisted words found in any generated script
- [ ] Old product records (null new fields) don't crash any function
- [ ] TypeScript 0 errors across all 3 edge functions and frontend
- [ ] QA report written to `.qa/epic-12-qa-report.md`

---

## Agent Execution Plan

### Team Composition

| Agent | Role | Stories |
|-------|------|---------|
| **Orchestrator** | Sequences agents, monitors completion, triggers next phase | All (coordinator) |
| **Agent A — Backend/Schema** | Expands brand summary LLM prompt + TypeScript interface | 12.1 |
| **Agent B — Frontend/UI** | Brand Profile editable card | 12.2 |
| **Agent C — Prompt Engineer** | Full system prompt rewrite (hooks + body + CTA + user prompt) | 12.3 + 12.4 + 12.5 |
| **Agent D — Parity** | Port prompt improvements to generate-segment-script | 12.6 |
| **Agent E — QA** | Script quality validation + regression | 12.7 |

### Execution Phases

```
Phase 1 — PARALLEL (no dependencies):
  ├─ Agent A: Story 12.1 (brand summary schema + scraping prompt)
  └─ Agent C: Stories 12.3 + 12.4 + 12.5 (full prompt rewrite)

Phase 2 — PARALLEL (after Phase 1):
  ├─ Agent B: Story 12.2 (UI card — needs new BrandSummary type from 12.1)
  └─ Agent D: Story 12.6 (parity — needs prompt decisions from 12.3+12.4+12.5)

Phase 3 — SEQUENTIAL (after Phase 2):
  └─ Agent E: Story 12.7 (QA — needs everything complete)
```

### Orchestrator Instructions

```
1. Spawn Agent A and Agent C simultaneously (Phase 1)
2. Wait for BOTH Phase 1 agents to report completion
3. Spawn Agent B and Agent D simultaneously (Phase 2)
4. Wait for BOTH Phase 2 agents to report completion
5. Spawn Agent E (Phase 3)
6. Wait for Agent E QA report
7. If QA passes → commit all, push to main
8. If QA finds critical issues → surface to user before pushing
```

### YOLO Mode Rules

- Agents work autonomously within their story scope
- No pausing between tasks within a story
- HALT conditions: TypeScript errors that can't be resolved after 2 attempts, missing context that requires reading files outside the story scope
- Each agent commits their own changes with story reference in commit message
- QA Agent is read-only (no code changes unless a critical null crash is found)

---

## GitHub Issues Plan

The following issues will be created on approval. Each maps 1:1 to a story.

### Issue 0: [Epic 12 / Story 12.0] Fix brand_summary coverage bugs — shared util + manual upload

**Labels:** `epic-12`, `backend`, `bug`
**Body:**
```
## Context
Two correctness bugs prevent brand summary from reaching scripts correctly.
Must ship before schema expansion (12.1) or UI (12.2).

## Bug 1 — brand_summary null for non-first products in scrape-product response
File: `supabase/functions/scrape-product/index.ts` (~line 494)

Current code:
  brand_summary: i === 0 ? brandSummary : null,

Fix:
  brand_summary: brandSummary,

Brand summary is brand-level data, not product-level. All products in the response
should receive it. The DB already saves it correctly — this only affects the API
response payload read by ScrapeResults.tsx.

## Bug 2 — Manual upload products get zero brand summary
File: `supabase/functions/upload-product/index.ts`

Current: No call to any brand summary function. Product is inserted with brand_summary: null.
Fix: After product insert, call generateBrandSummary() with the uploaded product data.
Update the product record with the result (graceful degradation — null on failure is OK).

## Shared utility extraction (required for both fixes)
File: `supabase/functions/_shared/brand-summary.ts` (CREATE NEW)

Extract generateBrandSummary() from scrape-product/index.ts into this shared file.
Both scrape-product and upload-product import it from _shared/brand-summary.ts.
Do not duplicate the function.

## Acceptance Criteria
- [ ] scrape-product API response: brand_summary present for ALL products, not just products[0]
- [ ] upload-product: calls generateBrandSummary(), updates product record with result
- [ ] generateBrandSummary() extracted to _shared/brand-summary.ts
- [ ] Both functions import from shared file
- [ ] tsc --noEmit 0 errors
- [ ] Graceful degradation: if generateBrandSummary() fails in upload-product, product still saves
```

---

### Issue 1: [Epic 12 / Story 12.1] Expand BrandSummary schema + scraping LLM prompt

**Labels:** `epic-12`, `backend`, `prompt-engineering`
**Body:**
```
## Context
The `generateBrandSummary()` function in `supabase/functions/scrape-product/index.ts`
currently produces only 3 fields: tone, demographic, selling_points. Scripts built on
this context are generic because the LLM has no knowledge of UVP, pain points, price
positioning, or product category.

## What to do

### 1. Update LLM prompt in `generateBrandSummary()` (scrape-product/index.ts)
Replace the system prompt with the expanded version requesting 10 fields:
tone, demographic, selling_points, tagline, unique_value_prop,
customer_pain_points (array), social_proof, price_positioning (budget|mid|premium),
product_category (beauty|food|fitness|supplements|fashion|home|tech|pet|baby|outdoor|other),
competitor_positioning.

### 2. Update validation in `generateBrandSummary()`
Current validation checks for tone/demographic/selling_points. Keep those as required.
All new fields are optional — log a warning if missing but don't return null.

### 3. Update BrandSummary interface (frontend/src/types/database.ts)
Add 7 optional new fields to the existing interface. All new fields use `?` to maintain
backward compat with existing DB records.

## Acceptance Criteria
- [ ] LLM prompt returns all 10 fields
- [ ] Validation only enforces original 3 required fields
- [ ] BrandSummary TS interface updated with optional new fields
- [ ] tsc --noEmit passes with 0 errors
- [ ] Old records with null new fields don't break consuming code
```

---

### Issue 2: [Epic 12 / Story 12.2] Brand Profile editable card in product import + detail UI

**Labels:** `epic-12`, `frontend`, `ux`
**Body:**
```
## Context
Users currently validate products but NOT the AI-extracted brand context that drives
script quality. After scraping, they see the raw brand_summary as read-only chips.
If the AI extracted the wrong tone or missed a key pain point, scripts will be poor.

## What to do

### 1. Create BrandProfileCard component
File: `frontend/src/components/products/BrandProfileCard.tsx`

Editable fields:
- product_category: dropdown (10 options)
- tone: text input
- price_positioning: 3-way toggle (budget/mid/premium)
- unique_value_prop: textarea (max 120 chars)
- customer_pain_points: chip list with add/remove
- social_proof: text input
- tagline: text input (optional)

Render modes: read (default) → edit (on Edit click) → saving (on Save click)
Cancel restores previous values.

### 2. Integrate into ScrapeResults.tsx
Add `<BrandProfileCard brandSummary={brandSummary} onSave={handleBrandSave} />`
below the product list, before the "Confirm & Continue" button.

### 3. Integrate into products/[id]/page.tsx
Replace the existing read-only brand_summary display (around line 610) with
`<BrandProfileCard>` that saves via Supabase client update on the product record.

### 4. Save mechanism
On Save: PATCH product.brand_summary via Supabase client `.update({ brand_summary: newValue })`
Show toast on success/error.

## Acceptance Criteria
- [ ] BrandProfileCard renders all 7 fields in read mode
- [ ] Edit/Save/Cancel flow works without page reload
- [ ] Pain points shown as removable chips with add button
- [ ] Price positioning shown as 3-button toggle
- [ ] Null/missing new fields show "Not detected — add manually"
- [ ] Save updates product record, shows success toast
- [ ] No layout regression in ScrapeResults or product detail page
```

---

### Issue 3: [Epic 12 / Story 12.3] Category-aware hook framework in buildSystemPrompt

**Labels:** `epic-12`, `backend`, `prompt-engineering`
**Body:**
```
## Context
The current hook prompt lists 8 generic angles with no guidance on which to use
for which product category. The result is arbitrary angle selection. Based on SGE
viral playbook analysis, specific angles dramatically outperform others by category.

## What to do
File: `supabase/functions/generate-video/index.ts` — `buildSystemPrompt()` function

### 1. Add optional brandContext parameter
```ts
function buildSystemPrompt(
  count: number,
  language: string,
  brandContext?: {
    product_category?: string | null;
    price_positioning?: string | null;
    customer_pain_points?: string[];
  }
): string
```

### 2. Add 4 new hook angles
- late_discovery: "how did I not know this existed??" — best for food/beauty/home/kitchen
- price_shock: Opens with price comparison vs expensive alternative — best for budget products
- specificity_lead: Opens with a hard number ("Lost 8 lbs.") — best for fitness/supplements
- everyone_knows_but_you: Social proof of social proof — best for trending products

### 3. Inject category shortlist
Define CATEGORY_HOOK_SHORTLIST map. When product_category is provided, inject:
"For THIS product category (X), prioritize these angles: [shortlist]"

### 4. Add specificity forcing rule
Hard constraint: every hook must contain at least one of:
- A specific number or measurement
- A time frame
- A named problem
- A first-person micro-story opener with duration ("I've been X for Y years")

### 5. Add emotional verb bank per category
beauty/fashion → obsessed, embarrassed, shocked, can't stop, crying
food/kitchen → addicted, can't stop making, obsessed
fitness/supplements → couldn't believe, genuinely shocked
tech/home → frustrated then relieved, annoyed I didn't know, finally

## Acceptance Criteria
- [ ] buildSystemPrompt() accepts brandContext parameter
- [ ] 4 new angles documented in prompt
- [ ] Category shortlist injected when category provided
- [ ] Specificity rule present as hard constraint
- [ ] Emotional verb bank present and category-mapped
- [ ] Language block still appears first (not displaced)
- [ ] tsc --noEmit 0 errors
```

---

### Issue 4: [Epic 12 / Story 12.4] Body continuation + CTA invisible philosophy overhaul

**Labels:** `epic-12`, `backend`, `prompt-engineering`
**Body:**
```
## Context
Two issues with current body/CTA prompts:
1. Body "CRITICAL RULES" say not to restate the hook but provide no examples, so
   LLMs frequently violate it.
2. CTA prompts produce marketing-sounding copy instead of invisible peer CTAs.

## What to do
File: `supabase/functions/generate-video/index.ts` — `buildSystemPrompt()` function

### 1. Add bad/good examples to body section
Add concrete anti-examples:
BAD: Hook="I used to hate cooking" → Body="Cooking was such a struggle for me..."
GOOD: Hook="I used to hate cooking" → Body="This app gave me 30 recipes in my budget in 10 seconds."

### 2. Add price_anchor body structure
"price_anchor: (use when price_positioning is budget) '[Expensive alt] goes for $X-Y. This does the same for $Z. [Matching result or feature].'"

### 3. Rewrite CTA philosophy header
Replace "One clear action. Low friction. Natural, not pushy." with:
"The CTA must NEVER feel like an ad. It must feel like a friend finishing a thought.
The product NAME should NOT appear in the CTA text. The viewer must feel they are
acting on their own curiosity, not responding to a sales pitch."

### 4. Add 3 new CTA patterns
- comment_bait: "Comment [word] and I'll send you the link — I promise"
- caption_tease: "I linked the exact one I use in the caption"
- friend_rec: "If you're dealing with [pain], just try it. I promise."

### 5. Rename link_drop → caption_tease and update description

## Acceptance Criteria
- [ ] Bad/good continuation examples added
- [ ] price_anchor structure documented
- [ ] CTA philosophy header uses "invisible CTA" framing
- [ ] Product name rule explicit in CTA section
- [ ] 3 new CTA patterns added
- [ ] tsc --noEmit 0 errors
```

---

### Issue 5: [Epic 12 / Story 12.5] buildUserPrompt() enrichment with brand intelligence

**Labels:** `epic-12`, `backend`, `prompt-engineering`
**Body:**
```
## Context
buildUserPrompt() in generate-video/index.ts currently passes 5 fields to the LLM:
name, description, price, tone, demographic, selling_points. After Story 12.1, the
brand_summary contains 7 additional fields — none of which are passed to the script
generator. This wastes the enriched brand context.

## What to do
File: `supabase/functions/generate-video/index.ts` — `buildUserPrompt()` function

### 1. Add all new brand_summary fields to user prompt
- unique_value_prop → "Unique value proposition: ..."
- customer_pain_points → formatted as bullet list "Customer pain points:\n  - ...\n  - ..."
- social_proof → "Social proof: ..."
- price_positioning → "Price positioning: budget/mid/premium (relative to category)"
- competitor_positioning → "Competitor context: ..."
- tagline → "Brand tagline: '...'"
All fields conditional — only injected if non-null.

### 2. Add calibration block
At end of user prompt, inject:
"CALIBRATION:
- Use the customer pain points above as raw material for hook angles.
- Mirror the customer's exact language from pain points (don't paraphrase).
- If price_positioning is budget and competitor mentioned, anchor against it in body.
- Match brand tone throughout: [tone]."

### 3. Wire brandContext to buildSystemPrompt
Pass brand_summary.product_category, price_positioning, customer_pain_points to
buildSystemPrompt() so category shortlist activates.

## Acceptance Criteria
- [ ] All 7 new fields conditionally injected
- [ ] customer_pain_points formatted as bullet list
- [ ] Calibration block at end of prompt
- [ ] buildSystemPrompt() receives brandContext
- [ ] Null/undefined fields degrade gracefully (no crashes)
- [ ] tsc --noEmit 0 errors
```

---

### Issue 6: [Epic 12 / Story 12.6] Prompt parity in generate-segment-script

**Labels:** `epic-12`, `backend`, `prompt-engineering`
**Body:**
```
## Context
generate-segment-script/index.ts handles Advanced Mode per-segment regeneration.
It has its own SEGMENT_SYSTEM_PROMPTS and buildUserPrompt() that are NOT getting
the improvements from Stories 12.3-12.5. If we don't port them, regenerated
segments will produce lower-quality copy than the initial generation — confusing UX.

## What to do
File: `supabase/functions/generate-segment-script/index.ts`

### 1. Update SEGMENT_SYSTEM_PROMPTS.hook
Port all improvements from 12.3: 4 new angles, specificity rule, emotional verb bank,
category shortlist support. The hook prompt here is shorter — make it match the quality
of buildSystemPrompt()'s hook section.

### 2. Update SEGMENT_SYSTEM_PROMPTS.body
Port bad/good continuation examples and price_anchor structure from 12.4.

### 3. Update SEGMENT_SYSTEM_PROMPTS.cta
Port invisible CTA philosophy and 3 new patterns from 12.4.

### 4. Update buildUserPrompt()
This function already fetches the full product from DB (has access to brand_summary).
Add all 7 new fields using the same conditional injection pattern as 12.5.
Add calibration block.

### 5. Wire category to system prompt
The segment prompts are static strings. If category is available, append category
shortlist to SEGMENT_SYSTEM_PROMPTS.hook at runtime (same pattern as 12.3).

## Acceptance Criteria
- [ ] SEGMENT_SYSTEM_PROMPTS.hook matches quality of 12.3
- [ ] SEGMENT_SYSTEM_PROMPTS.body has continuation examples + price_anchor
- [ ] SEGMENT_SYSTEM_PROMPTS.cta has invisible CTA philosophy
- [ ] buildUserPrompt() passes all new brand_summary fields
- [ ] tsc --noEmit 0 errors
```

---

### Issue 7: [Epic 12 / Story 12.7] QA validation — script quality + regression

**Labels:** `epic-12`, `qa`, `testing`
**Body:**
```
## Context
After all prompt and schema changes are deployed, a structured quality audit is
needed to verify improvement vs the previous baseline and catch any regressions.

## What to do
This is a read-only audit. No code changes unless a critical null crash is found.

### Test matrix
Run generate-video for 5 product types (can use existing test products or create
mock product objects):

1. Beauty — moisturizer, ~$30, budget positioning
2. Supplements — protein powder, ~$45, mid positioning
3. Food/Kitchen — recipe app or kitchen gadget
4. Home — organization product, budget positioning with competitor context
5. Fashion — mid-premium clothing item

For each, generate a Triple script (3 variants) and validate all 9 hooks, 9 bodies,
9 CTAs against the checklist.

### Hook checklist (per hook)
- [ ] Contains at least one specificity element (number/timeframe/named pain/micro-story)
- [ ] Angle matches category shortlist for the product_category
- [ ] No blacklisted words: "game-changer", "amazing", "incredible", "life-changing", "must-have"

### Body checklist (per body)
- [ ] Does NOT restate or echo hook's opening problem
- [ ] Continues logically: delivers proof, result, or sensory detail
- [ ] price_anchor present when product is budget + competitor provided

### CTA checklist (per CTA)
- [ ] Product name NOT present in CTA text
- [ ] Pattern is one of: comment_bait, caption_tease, friend_rec, risk_reversal, urgency_soft
- [ ] Reads as peer recommendation, not pitch

### Regression checks
- [ ] Old product record (brand_summary = {tone, demographic, selling_points} only) — generate-video still works
- [ ] Product with brand_summary = null — generate-video still works
- [ ] ScrapeResults.tsx renders for old brand_summary (no crash on missing new fields)
- [ ] tsc --noEmit 0 errors across all files

### Output
Write QA report to `.qa/epic-12-qa-report.md` with:
- Pass/fail per checklist item
- Quotes from generated scripts that pass/fail
- Any critical bugs found
```

---

## Summary

| Story | Owner | Phase | Files | Scope |
|-------|-------|-------|-------|-------|
| 12.0 | Agent A | 0 (first) | scrape-product/index.ts, upload-product/index.ts, _shared/brand-summary.ts | Bug fixes — brand summary coverage |
| 12.1 | Agent A | 1 | scrape-product/index.ts, database.ts | LLM prompt + TS interface |
| 12.2 | Agent B | 2 ⭐ | ScrapeResults.tsx, products/[id]/page.tsx | New editable UI card — highest ROI |
| 12.3 | Agent C | 1 | generate-video/index.ts | Hook framework rewrite |
| 12.4 | Agent C | 1 | generate-video/index.ts | Body + CTA rewrite |
| 12.5 | Agent C | 1 | generate-video/index.ts | User prompt enrichment |
| 12.6 | Agent D | 2 | generate-segment-script/index.ts | Parity port |
| 12.7 | Agent E | 3 | Read-only | QA validation |

**8 GitHub issues. 4 execution phases. 5 agents + orchestrator.**

### Updated Execution Phases

```
Phase 0 — SEQUENTIAL (must complete first, correctness blocker):
  └─ Agent A: Story 12.0 (brand summary bugs — shared util extract)

Phase 1 — PARALLEL (after Phase 0):
  ├─ Agent A: Story 12.1 (schema expansion — continues in same function)
  └─ Agent C: Stories 12.3 + 12.4 + 12.5 (full prompt rewrite)

Phase 2 — PARALLEL (after Phase 1):
  ├─ Agent B: Story 12.2 (UI card — needs new BrandSummary type from 12.1)
  └─ Agent D: Story 12.6 (parity — needs prompt decisions from 12.3+12.4+12.5)

Phase 3 — SEQUENTIAL (after Phase 2):
  └─ Agent E: Story 12.7 (QA — needs everything complete)
```
