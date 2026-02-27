# Payments + Stripe Handoff

Purpose: give your friend a single source to create the right Stripe Price IDs and connect them to this app without guesswork.

## 1) What Stripe Prices Must Be Created

Create 6 Stripe Prices total.

### A) Subscription prices (monthly, recurring)

| Key in code | Plan | Amount | Billing type | Env var |
| --- | --- | ---: | --- | --- |
| `starter` | Starter | $25/mo | Recurring monthly | `STRIPE_PRICE_STARTER` |
| `growth` | Growth | $80/mo | Recurring monthly | `STRIPE_PRICE_GROWTH` |
| `scale` | Scale | $180/mo | Recurring monthly | `STRIPE_PRICE_SCALE` |

### B) One-time credit packs

| Key in code | Pack | Amount | Billing type | Env var |
| --- | --- | ---: | --- | --- |
| `pack_10` | 10 credits | $12 | One-time | `STRIPE_PRICE_PACK_10` |
| `pack_30` | 30 credits | $33 | One-time | `STRIPE_PRICE_PACK_30` |
| `pack_100` | 100 credits | $95 | One-time | `STRIPE_PRICE_PACK_100` |

## 2) Pricing Rationale (Why These Price IDs Exist)

Source of truth is `frontend/src/lib/stripe.ts`.

- Credit model: `1 credit = $1 value`.
- Subscriptions are discounted per credit to reward commitment.
- Credit packs are priced higher per credit than subscriptions for occasional users.

Effective price per credit:

| Offer | Price | Credits | Effective $/credit |
| --- | ---: | ---: | ---: |
| Starter subscription | $25 | 30 | $0.83 |
| Growth subscription | $80 | 100 | $0.80 |
| Scale subscription | $180 | 250 | $0.72 |
| Pack 10 | $12 | 10 | $1.20 |
| Pack 30 | $33 | 30 | $1.10 |
| Pack 100 | $95 | 100 | $0.95 |

Why this matters for setup:
- Each key must map to its own `price_...` ID.
- Webhook logic uses those IDs to identify plan changes and apply credits correctly.

## 3) Where Everything Is In Code

- Frontend pricing config:
  - `frontend/src/lib/stripe.ts`
- Frontend checkout calls:
  - `frontend/src/hooks/use-checkout.ts`
- Stripe checkout session creation:
  - `supabase/functions/stripe-checkout/index.ts`
- Stripe webhook processing:
  - `supabase/functions/stripe-webhook/index.ts`
- Stripe billing portal:
  - `supabase/functions/stripe-portal/index.ts`
- Billing UI:
  - `frontend/src/app/(dashboard)/settings/billing/page.tsx`
- Credit helper functions:
  - `supabase/functions/_shared/credits.ts`
  - `supabase/functions/credit-balance/index.ts`
- DB schema and migrations:
  - `supabase/migrations/001_initial_schema.sql`
  - `supabase/migrations/011_reprice_credits.sql`
  - `supabase/migrations/012_first_video_discount.sql`

## 4) Secrets / Env Vars Required

Set these in Supabase Edge Function secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_URL`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_SCALE`
- `STRIPE_PRICE_PACK_10`
- `STRIPE_PRICE_PACK_30`
- `STRIPE_PRICE_PACK_100`

## 5) End-to-End Payment Flow

### A) Checkout initiation (`stripe-checkout`)

File: `supabase/functions/stripe-checkout/index.ts`

- Frontend sends either `{ plan }` or `{ pack }`.
- Function resolves Stripe price ID from env var mapping.
- Creates or reuses Stripe customer.
- Creates Checkout Session:
  - `mode: "subscription"` for plans
  - `mode: "payment"` for packs
- Writes metadata:
  - always `supabase_user_id`
  - plus `plan` or `pack`

### B) Webhook handling (`stripe-webhook`)

File: `supabase/functions/stripe-webhook/index.ts`

Handled events and credit behavior:

1. `checkout.session.completed`
- If `session.mode === "payment"` (pack):
  - credits user by pack amount (`10`, `30`, `100`)
  - ledger reason: `credit_pack_purchase`
- If subscription:
  - upserts `subscriptions`
  - updates `profiles.plan`
  - grants initial plan credits (`30`, `100`, `250`)
  - ledger reason: `subscription_purchase`

2. `invoice.paid` (only renewal invoices: `billing_reason=subscription_cycle`)
- resets balance to plan credits (`30`, `100`, `250`)
- ledger reason: `subscription_renewal`

3. `customer.subscription.updated`
- reverse maps Stripe `price.id` to plan via:
  - `STRIPE_PRICE_STARTER`
  - `STRIPE_PRICE_GROWTH`
  - `STRIPE_PRICE_SCALE`
- updates subscription status + periods
- syncs `profiles.plan` when active

4. `customer.subscription.deleted`
- marks subscription canceled
- downgrades profile to `free`
- clears remaining credits

Idempotency:
- Every processed event is written to `audit_logs.event_id`.
- Duplicate webhook events are skipped.

## 6) DB Objects Involved

Main tables:
- `profiles` (plan and role)
- `subscriptions` (Stripe customer/subscription IDs and status)
- `credit_balances` (current credit balance)
- `credit_ledger` (credit history entries)
- `audit_logs` (webhook idempotency by Stripe event ID)

Ledger reasons currently expected include:
- `subscription_purchase`
- `credit_pack_purchase`
- `subscription_renewal`
- `generation`
- `refund`
- `bonus`
- `free_trial`

## 7) Stripe Dashboard Creation Checklist

1. Create product for subscriptions (optional naming: `AIUGC Subscriptions`).
2. Create 3 monthly recurring USD prices: `$25`, `$80`, `$180`.
3. Create product for one-time packs (optional naming: `AIUGC Credit Packs`).
4. Create 3 one-time USD prices: `$12`, `$33`, `$95`.
5. Copy all six `price_...` IDs into the matching Supabase secrets.
6. Confirm Stripe webhook endpoint points to:
   - `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
7. Subscribe webhook to:
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
8. Run test purchases:
   - one subscription checkout
   - one pack checkout
   - one renewal simulation
   - one cancellation

## 8) Important Notes / Gotchas

1. `frontend/src/schemas/billing.ts` has `priceId` in schema, but current runtime checkout sends `plan` or `pack` keys to edge functions.
2. Keep frontend plan/pack constants and webhook credit constants aligned:
   - `frontend/src/lib/stripe.ts`
   - `supabase/functions/stripe-webhook/index.ts`
3. If a Stripe price ID is missing in env vars, checkout returns a `503` and purchase cannot start.
