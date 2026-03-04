---
epic: 4
title: 'Paywall & Subscription Billing - Extended Stories'
status: 'complete'
frs_covered: ['FR31', 'FR32', 'FR33', 'FR34', 'FR35']
nfrs_addressed: ['NFR13']
depends_on: ['Epic 2 (auth)']
architecture_stack: 'Supabase Edge Functions (Deno), Stripe, Resend, Supabase Auth'
auditDate: '2026-03-03'
---

# Epic 4 - Paywall & Subscription Billing: Extended Stories [DONE]

## Overview

These stories cover billing and monetization features added beyond the original MVP scope. They extend the base billing pipeline (Stories 4.2-4.8 in `epics.md`) with annual billing, single-video paywall purchases, first-video discount mechanics, urgency-driven conversion, and post-purchase transactional emails.

All features in this file were **not in the original PRD** - they were built as CRO optimizations and revenue model enhancements during implementation.

### Architecture Context

- **Auth:** Supabase Auth (JWT verified in Edge Functions via `requireUserId()`)
- **Backend:** Supabase Edge Functions (Deno runtime)
- **Database:** Supabase PostgreSQL with RLS (`profiles`, `subscriptions`, `credit_balances`, `credit_ledger`)
- **Payments:** Stripe (subscriptions, one-time packs, single-video purchases)
- **Email:** Resend API via `send-email/` Edge Function
- **Credit Model:** 1 credit = $1. Single: 5cr (std) / 10cr (HD). Triple: 15cr (std) / 30cr (HD). First video 50% off.

---

## [DONE] Story 4.9: Annual Billing Option

**As a** user selecting a subscription plan,
**I want to** choose between monthly and annual billing,
**So that** I can save money by committing to an annual plan.

### Acceptance Criteria

1. **Billing toggle**: Monthly/annual toggle displayed in subscription selection UI (paywall modal and pricing page).
2. **Annual pricing**: Annual price IDs configured in Stripe with discount vs monthly (15-20% savings communicated to user).
3. **Checkout integration**: `stripe-checkout/` accepts `billing` parameter (`monthly` | `annual`). Selects corresponding Stripe price ID.
4. **Fallback price IDs**: Annual price IDs have hardcoded fallback values in the checkout function for campaign stability.
5. **Renewal tracking**: Subscription renewal dates tracked correctly for annual cycles via Stripe webhook events.
6. **Plan display**: Current billing frequency shown in account settings and billing portal.

### Implementation Details

- Edge Function: `supabase/functions/stripe-checkout/index.ts` - `billing` parameter in checkout request
- Frontend: Billing frequency toggle in paywall modal and pricing page
- Stripe: Annual price IDs configured per plan tier (Starter, Growth, Scale)
- Webhook: `stripe-webhook/` handles annual subscription lifecycle events identically to monthly

### Error Handling

- If annual price ID is missing, falls back to hardcoded value
- Invalid `billing` parameter defaults to `monthly`

---

## [DONE] Story 4.10: Single-Video Paywall Purchase

**As a** user who runs out of credits mid-generation,
**I want to** purchase a single video (5cr standard / 10cr HD) directly from the paywall,
**So that** I can complete my generation without committing to a plan or credit pack.

### Acceptance Criteria

1. **Paywall option**: "Buy just one video" option shown in paywall modal when credits are insufficient for the current generation.
2. **Two tiers**: Standard video (5 credits, ~$5) and HD video (10 credits, ~$10) options presented based on selected quality.
3. **Stripe products**: Single-video products configured in Stripe with `single_standard` and `single_hd` identifiers.
4. **Checkout flow**: `stripe-checkout/` handles single-video payment mode. Creates one-time Stripe checkout session.
5. **Webhook processing**: `stripe-webhook/` processes single-video pack purchase events on `checkout.session.completed`. Credits added to balance.
6. **Post-purchase**: After successful purchase, user is redirected back to the generation wizard to continue.
7. **UI presentation**: Single-video option is secondary to subscriptions and packs (shown below or as "just need one video?" link).

### Implementation Details

- Edge Function: `supabase/functions/stripe-checkout/index.ts` - Single-video payment mode
- Edge Function: `supabase/functions/stripe-webhook/index.ts` - Handles `single_standard` and `single_hd` pack events
- Frontend: `frontend/src/lib/stripe.ts` - `SINGLE_VIDEO_PACKS` constant with price IDs
- Price IDs: `price_1T65y1DofGNcXNHKBXaliSF2` (standard), `price_1T65zBDofGNcXNHKMYvxgyuw` (HD)

### Error Handling

- 400: Invalid single-video type
- Standard Stripe checkout error handling applies

---

## [DONE] Story 4.11: First-Video 50% Discount

**As a** new user generating my first video,
**I want to** receive a 50% discount on my first generation,
**So that** I can try the platform at a reduced cost before committing.

### Acceptance Criteria

1. **Eligibility tracking**: `profiles.first_video_discount_used` BOOLEAN column (default `false`) tracks whether user has used their first-video discount.
2. **Cost calculation**: First generation cost = `ceil(normalCost / 2)`. Applied during approval phase credit debit.
3. **Atomic application**: Discount flag set to `true` before credit debit in the same transaction flow.
4. **Failure recovery**: If generation fails after credit debit, both credits are refunded AND `first_video_discount_used` is reset to `false`, restoring eligibility.
5. **UI communication**: Generation wizard step 4 (Configure) and step 5 (Review) show discounted price with "First video: 50% off!" badge.
6. **402 response**: If user has insufficient credits at approval, the 402 response includes `first_video_discount` flag and `effective_cost` so the paywall can show correct pricing.
7. **Replaces free trial**: This discount model replaces the original FR34 (9 free segment credits).

### Implementation Details

- Database: `profiles.first_video_discount_used` column
- Edge Function: `supabase/functions/generate-video/index.ts` - Discount applied during approval phase
- Credit operations: `_shared/credits.ts` - `debitCredits()` accepts discount flag
- Frontend: Wizard store tracks `firstVideoDiscount` state from credit-balance response

### Status Flow (Discount Context)

```
awaiting_approval → locking → submitting_jobs (credits debited at discounted rate)
                                    |
                                    ├──> generating_segments → completed (discount stays used)
                                    └──> failed (credits refunded + discount flag reset to false)
```

---

## [DONE] Story 4.12: 30-Minute Offer Banner

**As a** new user who has just signed up,
**I want to** see a time-limited promotional offer with a countdown,
**So that** I feel urgency to make my first purchase and take advantage of the deal.

### Acceptance Criteria

1. **Banner display**: Promotional banner shown to new users across dashboard pages after signup.
2. **Countdown timer**: 30-minute countdown timer displayed prominently. Visual urgency increases as time runs low.
3. **Promotional discount**: Special discount or offer applied at checkout when banner is still active.
4. **Dismissal rules**: Banner dismissed after timer expires OR after first purchase is completed.
5. **Persistence**: Timer state persisted across page navigations (localStorage or session storage). Refreshing the page does not reset the timer.
6. **Non-intrusive**: Banner does not block page content. Positioned as a top bar or floating element.

### Implementation Details

- Frontend: Banner component with countdown logic
- State: Timer start timestamp stored in localStorage on first render
- Checkout integration: Coupon or discount flag passed to `stripe-checkout/` when banner is active
- Dismissal: Banner removed from DOM after expiry or purchase detection

### Error Handling

- If localStorage is unavailable, banner still shows but timer may reset on refresh
- Expired timers never re-appear (tombstone key in localStorage)

---

## [DONE] Story 4.13: Post-Purchase Transactional Email

**As a** user who has just completed a purchase (subscription or credit pack),
**I want to** receive a confirmation email with my purchase details,
**So that** I have a record of my transaction and know my credits are available.

### Acceptance Criteria

1. **Trigger**: Email sent on successful `checkout.session.completed` webhook event for both subscriptions and one-time packs.
2. **Email content**: Includes plan/pack name, number of credits added, total cost, next billing date (subscriptions), and CTA to start generating.
3. **Template**: Branded HTML template consistent with existing transactional emails (signup, recovery). Uses CineRads branding.
4. **Delivery**: Sent via Resend API through `send-email/` Edge Function or direct Resend call from webhook handler.
5. **Idempotency**: Email not re-sent on duplicate webhook events (checked via `audit_logs` event ID dedup).
6. **Pack-specific**: Credit pack emails show pack name and credits added. Subscription emails show plan name, credits, and billing cycle.

### Implementation Details

- Edge Function: `supabase/functions/stripe-webhook/index.ts` - Triggers email on checkout completion
- Email delivery: `supabase/functions/send-email/index.ts` or direct Resend API call
- Template: HTML template with purchase details interpolated
- Dedup: `audit_logs.event_id` check prevents duplicate sends

### Error Handling

- Email delivery failure logged to Sentry but does not fail the webhook response (email is non-critical)
- Missing email address falls back to Stripe customer email

---

## Story Dependencies

```
Story 4.2 (Paywall Modal) ──> Story 4.10 (Single-Video Purchase)
                          └──> Story 4.9 (Annual Billing Toggle)
Story 4.4 (Stripe Checkout) ──> Story 4.9, 4.10, 4.12
Story 4.5 (Webhook) ──> Story 4.13 (Post-Purchase Email)
Story 4.7 (First-Video Discount) ──> Story 4.11 (Extended discount mechanics)
```

All stories are independently functional but share the Stripe checkout and webhook infrastructure.

---

## Edge Functions Summary

| Function | Story | Purpose | Revenue Impact |
|----------|-------|---------|----------------|
| `stripe-checkout/` | 4.9, 4.10 | Annual billing + single-video payment modes | Direct revenue |
| `stripe-webhook/` | 4.10, 4.13 | Single-video credit fulfillment + purchase email | Fulfillment |
| `send-email/` | 4.13 | Post-purchase transactional email | Retention |
| `credit-balance/` | 4.11 | Returns discount eligibility in balance response | Conversion |
| `generate-video/` | 4.11 | Applies first-video discount at approval | Conversion |
