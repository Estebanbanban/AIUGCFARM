-- 011_reprice_credits.sql
-- Pricing update: 1 credit = $1.
-- Kling v2.6 single = 5cr, triple = 15cr. v3 single = 10cr, triple = 30cr.
-- Plans: starter=30cr/$25, growth=100cr/$80, scale=250cr/$180.
-- Adds credit_pack_purchase and subscription_purchase to ledger reasons.

-- ── 1. Expand credit_ledger reason constraint ────────────────────────────────
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

-- ── 2. Update free trial credit grant for new signups (trigger or function) ──
-- The trigger that seeds new users is in the auth.users trigger.
-- We update the seed amount to 5 credits (enough for 1 standard single video).
-- Note: existing users keep their current balance; this only affects new signups.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, plan)
  VALUES (NEW.id, NEW.email, 'free')
  ON CONFLICT (id) DO NOTHING;

  -- Seed 5 trial credits (1 standard single video at the new pricing)
  INSERT INTO public.credit_balances (owner_id, remaining)
  VALUES (NEW.id, 5)
  ON CONFLICT (owner_id) DO NOTHING;

  INSERT INTO public.credit_ledger (owner_id, amount, reason)
  VALUES (NEW.id, 5, 'free_trial');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
