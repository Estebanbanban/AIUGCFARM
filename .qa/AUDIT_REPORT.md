# CineRads AIUGC - Bug Audit Report

## BUG 1: Kling AI Logo in Loading Screens

### Files Affected

1. **File:** `/Users/estebanronsin/Sites/AIUGC/frontend/src/app/(dashboard)/generate/[id]/page.tsx:1398`
   ```typescript
   subtitle="Kling AI is rendering your video \u2014 usually 3\u20133 minutes"
   ```
   **Current code:** Text explicitly mentions "Kling AI" in the loading screen subtitle on the generation status page.
   **What needs to change:** Remove "Kling AI" branding from user-facing messages. This is third-party AI provider branding that shouldn't appear in the UI.

2. **File:** `/Users/estebanronsin/Sites/AIUGC/frontend/src/app/(dashboard)/generate/page.tsx:1452`
   ```typescript
   subtitle="This usually takes 1\u20133 minutes"
   ```
   **Current code:** This is the composite preview loading message — clean, but paired with enum `RENDER_STEPS` at line 968 which includes "Submitting to Kling AI".
   **Location of RENDER_STEPS:** `/Users/estebanronsin/Sites/AIUGC/frontend/src/app/(dashboard)/generate/[id]/page.tsx:973`
   ```typescript
   { label: "Submitting to Kling AI", icon: <Zap className="w-3 h-3" /> },
   ```
   **What needs to change:** Remove "Kling AI" from the RENDER_STEPS labels. Replace with generic language like "Submitting to video generation" or "Processing video".

---

## BUG 2: Preview Image "Edit" Button

### Current Implementation

**File:** `/Users/estebanronsin/Sites/AIUGC/frontend/src/app/(dashboard)/generate/page.tsx:1837-1884`

**Current code:**
```typescript
{selectedCompositeIdx !== null && compositeImages[selectedCompositeIdx] && (
  <div className="rounded-lg border border-border bg-muted/20 p-3">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">Quick edit</p>
        <p className="text-xs text-muted-foreground">Customize this preview</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowPreviewEditor(!showPreviewEditor)}
      >
        {showPreviewEditor ? "Close" : "Edit"}
      </Button>
    </div>
    {showPreviewEditor && (
      <div className="mt-3 flex flex-col gap-3">
        <Textarea
          value={previewEditPrompt}
          onChange={(e) => setPreviewEditPrompt(e.target.value)}
          placeholder="Example: Change the outfit to a black hoodie and make the background a cozy cafe."
          maxLength={500}
        />
        <Button
          type="button"
          size="sm"
          onClick={handleApplyPreviewEdit}
          disabled={editComposite.isPending || !store.compositeImagePath || previewEditPrompt.trim().length === 0}
        >
          {editComposite.isPending ? (
            <><Loader2 className="size-3.5 animate-spin" />Applying...</>
          ) : (
            <>Apply Edit</>
          )}
        </Button>
      </div>
    )}
  </div>
)}
```

**What needs to change:** The edit button currently shows "Edit" but there's no inline "regenerate" affordance. Composite images should have a clear way to regenerate them — currently the UI is titled "Quick edit" (implying modification via prompt) but it could be confusing that users can't click on the image itself to regenerate. Consider adding a regenerate button next to the "Edit" button or in the composite grid.

---

## BUG 3: Auto-Regenerate Scripts on Settings Change

### Current Implementation

**File:** `/Users/estebanronsin/Sites/AIUGC/frontend/src/app/(dashboard)/generate/page.tsx`

**Evidence of missing auto-regen:**
- Line 348: `const [scriptConfigChanged, setScriptConfigChanged] = useState(false);`
- Lines 1493, 1514, 1605, 1626, 1652, 1667, 1671, 1731, 1807: Mode/quality/language changes SET `setScriptConfigChanged(true)`
- Line 1928-1940: Button appears when `scriptConfigChanged && generateScript.isPending`
  ```typescript
  {scriptConfigChanged && (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-center gap-3">
      <AlertCircle className="size-4 text-amber-400" />
      <div className="flex-1">
        <p className="text-sm text-amber-400 font-medium">Script settings changed</p>
        <p className="text-xs text-amber-400/80">Update your script to match</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => { setScriptConfigChanged(false); handleGenerateScript(); }}
        disabled={requiresCommentKeyword && !commentKeyword}
        className="shrink-0 text-xs"
      >
        Regenerate
      </Button>
    </div>
  )}
  ```

**Current behavior:** When mode, quality, or language changes, the app sets `scriptConfigChanged = true` and shows a warning banner with a "Regenerate" button. User must click it manually.

**What needs to change:** No automatic re-generation on settings change. This is working as designed (user must acknowledge), but if auto-regen is required, add a `useEffect` that watches `store.mode`, `store.quality`, `store.language` and auto-fires `handleGenerateScript()` when they change.

---

## BUG 4: Unicode Escape Bug

### Files Affected

1. **File:** `/Users/estebanronsin/Sites/AIUGC/frontend/src/app/(dashboard)/generate/page.tsx:1452`
   ```typescript
   subtitle="This usually takes 1\u20133 minutes"
   ```
   **Issue:** `\u2013` is a Unicode en-dash (–) but it's escaped in a plain string, not a template literal. JavaScript interprets `\u2013` as the en-dash character, but the intent is unclear — the string should either use a literal en-dash or an explicit hyphen.
   **Current rendering:** "This usually takes 1–3 minutes" (with en-dash)
   **What needs to change:** Replace `\u20133` with actual character or plain hyphen. Change to `"This usually takes 1-3 minutes"` or `"This usually takes 1–3 minutes"` (with literal en-dash).

2. **File:** `/Users/estebanronsin/Sites/AIUGC/frontend/src/app/(dashboard)/generate/[id]/page.tsx:1398`
   ```typescript
   subtitle="Kling AI is rendering your video \u2014 usually 3\u20133 minutes"
   ```
   **Issue:** Same issue — `\u2014` (em-dash —) and `\u20133` (en-dash –) are escaped. The string should use literal characters or plain hyphens.
   **Current rendering:** "Kling AI is rendering your video — usually 3–10 minutes"
   **What needs to change:** Replace escaped Unicode with literal characters or ASCII equivalents.

---

## BUG 5: Stripe 50% Discount

### Files Affected

**File:** `/Users/estebanronsin/Sites/AIUGC/supabase/functions/stripe-checkout/index.ts`

**Current Implementation:**
- **Lines 110-141:** One-time credit pack checkout:
  ```typescript
  if (pack) {
    const priceId = PACK_PRICE_IDS[pack];
    if (!priceId) { ... }
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${FRONTEND_URL}/dashboard?checkout=success&pack=${pack}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/settings/billing?checkout=cancelled`,
      metadata: { supabase_user_id: userId, pack },
    };
    if (validatedCoupon) {
      sessionParams.discounts = [{ coupon: validatedCoupon }];
    } else {
      sessionParams.allow_promotion_codes = true;
    }
    const session = await stripe.checkout.sessions.create(sessionParams);
  }
  ```

**Issue:** No special 50% first-purchase discount logic. The code accepts generic coupons but doesn't apply a hardcoded first-purchase discount.

**What needs to change:**
1. Add logic to check if the user has made a previous purchase (query `subscriptions` or `credit_ledger` table)
2. If first purchase, apply a 50% discount either via:
   - A hardcoded coupon ID (create in Stripe dashboard, e.g., "FIRST50")
   - Or dynamically apply a 50% `discounts` entry

---

## BUG 6: Post-Purchase Email/Popup

### Files Affected

1. **File:** `/Users/estebanronsin/Sites/AIUGC/frontend/src/components/checkout/CheckoutSuccessHandler.tsx`
   **Current implementation (lines 100-123):**
   - Shows a success toast on `/generate` page
   - Shows a `PurchaseSuccessModal` on dashboard with confetti animation
   - Modal displays plan/pack perks

2. **File:** `/Users/estebanronsin/Sites/AIUGC/frontend/src/components/checkout/PurchaseSuccessModal.tsx`
   **Current implementation (lines 76-110):**
   ```typescript
   const PACK_PERKS: Record<CreditPackKey, { headline: string; sub: string; highlight: string; bullets: string[] }> = {
     pack_10: {
       headline: "Credits loaded. Let's make something. 🎬",
       sub: "Your 10 credits are ready to use right now. That's 2 complete video ads - go test your first hook.",
       highlight: "10 credits added to your account",
       bullets: [
         "2 standard videos (Hook → Body → CTA)",
         "Or 1 HD video for premium placements",
         "Full AI script generation included",
         "MP4 download, no watermarks",
       ],
     },
     // ... more packs
   };
   ```

3. **File:** `/Users/estebanronsin/Sites/AIUGC/supabase/functions/send-email/index.ts`
   **Current implementation:**
   - This is the Supabase Auth hook for sending verification/password reset emails
   - No custom post-purchase email template exists in this file
   - Webhooks are handled by `stripe-webhook` but no email is sent there

**Issue:** Post-purchase email template is missing. The webhook doesn't call `sendEmail()` after a pack purchase.

**What needs to change:**
1. In `/supabase/functions/stripe-webhook/index.ts` (lines 88-125 for pack purchases), add email sending:
   ```typescript
   // After successful pack credit upsert
   await sendEmail({
     to: userEmail,
     subject: "Your credits are ready!",
     html: `<html>...</html>` // Credit pack purchase email template
   });
   ```

---

## BUG 7: Post-Purchase Redirect

### Files Affected

**File:** `/Users/estebanronsin/Sites/AIUGC/supabase/functions/stripe-checkout/index.ts:126`

**Current implementation:**
```typescript
success_url: `${FRONTEND_URL}/dashboard?checkout=success&pack=${pack}&session_id={CHECKOUT_SESSION_ID}`,
```

**Issue:**
- For credit pack purchases, user is redirected to `/dashboard?checkout=success&pack=${pack}`
- There is **no `generation_id` parameter** passed
- On dashboard, the `CheckoutSuccessHandler` looks for `pack` param and shows modal
- User cannot auto-navigate back to `/generate` with a pre-selected generation

**Current behavior:** User lands on dashboard, sees modal, must click "Generate Your First Video" to return to `/generate`

**What needs to change:** If the purchase was made mid-generation (user hit paywall), pass the `generation_id` in success_url and let the handler redirect back to `/generate/[id]`.

---

## BUG 8: Stitching Edge Function (Video Concatenation)

### Files Affected

**Finding:** **No dedicated stitching/concatenation logic found.**

The codebase currently:
1. **Generates individual segment videos** via Kling/Sora (hooks, bodies, ctas)
2. **Stores them individually** in `generated-videos` bucket
3. **No stitching/ffmpeg** command is executed to concatenate them

**File:** `/Users/estebanronsin/Sites/AIUGC/supabase/functions/video-status/index.ts:345-361`
```typescript
let duration = 5;
let variantLabel = "";
if (script && script[segType]) {
  const segIndex = variation - 1;
  const segData = script[segType][segIndex];
  if (segData) {
    duration = (segData.duration_seconds as number) ?? 5;
    variantLabel = (segData.variant_label as string) ?? "";
  }
}
storedVideos[segType].push({
  storage_path: storagePath,
  duration,
  variation,
  variant_label: variantLabel,
});
```

**Evidence:**
- No `ffmpeg` package imported in any edge function
- No function named `stitch-video` or `concat-video`
- Segment videos are stored separately and never merged

**What needs to change:** Either:
1. **Create a new edge function** `/supabase/functions/stitch-video/` that uses ffmpeg to concatenate videos in order (hook_1 + body_1 + cta_1) with optional silence trimming
2. **Or** move stitching to client-side (download segments, concat via ffmpeg.wasm or similar)
3. **Or** clarify if stitching should happen during download (not in current code)

---

## BUG 9: Script Length / Kling Duration

### Files Affected

**File:** `/Users/estebanronsin/Sites/AIUGC/supabase/functions/generate-video/index.ts`

**Current Implementation:**
1. **Line 170:** Script generation prompt includes:
   ```
   Set duration_seconds based on actual word count.
   ```

2. **Lines 219-223:** Expected JSON format:
   ```typescript
   "hooks": [{ "text": "...", "duration_seconds": 3, "variant_label": "pain_point" }],
   "bodies": [{ "text": "...", "duration_seconds": 7, "variant_label": "problem_solution" }],
   "ctas": [{ "text": "...", "duration_seconds": 3, "variant_label": "link_drop" }]
   ```

3. **Line 422:** Kling duration clamping:
   ```typescript
   const duration = segment.duration_seconds <= 5 ? 5 : 10;
   ```

4. **Lines 438-441:** Kling job submission:
   ```typescript
   submitKlingJob({
     image_url: compositeSignedUrl,
     script: stripEmotionTags(segment.text),
     duration,  // ← Uses clamped duration (5 or 10 seconds)
     mode: "pro",
     sound: "on",
     model_name: klingModel,
   }),
   ```

**Current behavior:**
- OpenRouter generates script with estimated `duration_seconds` based on word count
- Video is submitted to Kling with that duration, but Kling clamps it to either 5 or 10 seconds
- **No validation** that script text fits within the allocated duration at 2.5 words/sec

**What needs to change:**
1. Add validation: if text is too long for the duration, either truncate or re-prompt
2. Or increase duration estimate to match actual word count more accurately
3. Consider hard limits (max 10 words for 3-sec hook, etc.)

---

## BUG 10: Per-Segment Regeneration Credit Cost

### Files Affected

**File:** `/Users/estebanronsin/Sites/AIUGC/supabase/functions/regenerate-segment/index.ts`

**Current Implementation:**
1. **Line 139-146:** Credit check:
   ```typescript
   const remaining = await checkCredits(userId);
   if (remaining < 1) {
     return json(
       { detail: "Insufficient credits. Regenerating a segment costs 1 credit." },
       cors,
       402,
     );
   }
   ```

2. **Line 148:** Debit exactly 1 credit:
   ```typescript
   await debitCredit(userId, generation.id);
   ```

3. **Lines 218-226:** Response confirms 1 credit charged:
   ```typescript
   return json(
     {
       data: {
         generation_id: generation.id,
         status: "generating_segments",
         job_key: segmentKey,
         credits_charged: 1,
       },
     },
     cors,
     200,
   );
   ```

**Current behavior:** Regenerating any segment (hook, body, or cta) costs exactly **1 credit**, regardless of quality (standard vs. HD).

**Issue:** Should the cost vary by quality? Currently:
- Single standard video generation = 5 credits
- Single HD video generation = 10 credits
- Segment regeneration = 1 credit (fixed)

**What needs to change:** Decide if segment regen should cost:
- 1 credit (current, flat)
- Dynamic (e.g., 0.5 credits for standard, 1 credit for HD)
- Proportional to original generation cost

---

## Summary Table

| Bug # | Issue | File | Line | Severity |
|-------|-------|------|------|----------|
| 1 | Kling AI logo in loading screens | generate/[id]/page.tsx | 973, 1398 | Medium |
| 2 | Preview image edit affordance unclear | generate/page.tsx | 1837-1884 | Low |
| 3 | No auto-regenerate on settings change | generate/page.tsx | 348, 1928 | Low |
| 4 | Unicode escape characters (en-dash/em-dash) | generate/page.tsx, [id]/page.tsx | 1452, 1398 | Low |
| 5 | No 50% first-purchase discount logic | stripe-checkout/index.ts | 110-141 | High |
| 6 | Missing post-purchase email template | stripe-webhook/index.ts | N/A | Medium |
| 7 | No generation_id in post-purchase redirect | stripe-checkout/index.ts | 126 | Medium |
| 8 | No video stitching/concatenation logic | All functions | N/A | High |
| 9 | Script duration not validated against word count | generate-video/index.ts | 170, 422 | Medium |
| 10 | Segment regen cost is flat (1 credit) | regenerate-segment/index.ts | 139-226 | Low |

