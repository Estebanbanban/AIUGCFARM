-- 011_reprice_credits.sql
-- Pricing update: 1 credit = $1
-- v2.6 single = 5cr, triple = 15cr. v3 single = 10cr, triple = 30cr.
-- Plans: starter=30cr/$25, growth=100cr/$80, scale=250cr/$180.
-- Adds credit_pack_purchase and subscription_purchase to ledger reasons.
-- Free trial removed (seeded credits = 0 on signup).

-- ── 1. Expand credit_ledger reason constraint ─────────────────────────────────
ALTER TABLE credit_ledger
  DROP CONSTRAINT IF EXISTS credit_ledger_reason_check;

ALTER TABLE credit_ledger
  ADD CONSTRAINT credit_ledger_reason_check
  CHECK (reason IN (
    'subscription_renewal',
    'subscription_purchase',
    'credit_pack_purchase',
    'generation',
    'refund',
    'bonus',
    'free_trial'
  ));

-- ── 2. Update handle_new_user trigger to seed 0 credits (no free trial) ───────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Seed 0 credits (paywall hits at generate time; first video is 50% off)
  INSERT INTO public.credit_balances (owner_id, remaining)
  VALUES (NEW.id, 0)
  ON CONFLICT (owner_id) DO NOTHING;

  RETURN NEW;
END;
$$;
