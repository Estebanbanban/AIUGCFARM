-- 20260306300000_security_hardening.sql
-- Security hardening from audit:
-- 1. Explicit write-blocking RLS on regeneration_limits + persona_monthly_limits (H3)
-- 2. Missing credit_ledger reasons: composite_generation, free_plan (L8)
-- 3. Index on products.brand_id for query performance (L2)

-- ── 1. Explicit write-blocking RLS on regeneration_limits ────────────────────
-- These tables previously relied on implicit denial (no INSERT/UPDATE policy).
-- Add explicit blocking policies matching the pattern in 20260303100000.

CREATE POLICY "block_user_insert_regen_limits"
  ON public.regeneration_limits
  FOR INSERT WITH CHECK (false);

CREATE POLICY "block_user_update_regen_limits"
  ON public.regeneration_limits
  FOR UPDATE USING (false);

CREATE POLICY "block_user_delete_regen_limits"
  ON public.regeneration_limits
  FOR DELETE USING (false);

-- ── 2. Explicit write-blocking RLS on persona_monthly_limits ─────────────────

CREATE POLICY "block_user_insert_persona_monthly"
  ON public.persona_monthly_limits
  FOR INSERT WITH CHECK (false);

CREATE POLICY "block_user_update_persona_monthly"
  ON public.persona_monthly_limits
  FOR UPDATE USING (false);

CREATE POLICY "block_user_delete_persona_monthly"
  ON public.persona_monthly_limits
  FOR DELETE USING (false);

-- ── 3. Expand credit_ledger reason constraint ─────────────────────────────────
-- composite_generation is used by generate-composite-images + edit-composite-image
-- free_plan is used by the handle_new_user trigger in one migration path

ALTER TABLE public.credit_ledger
  DROP CONSTRAINT IF EXISTS credit_ledger_reason_check;

ALTER TABLE public.credit_ledger
  ADD CONSTRAINT credit_ledger_reason_check
  CHECK (reason IN (
    'subscription_renewal',
    'subscription_purchase',
    'credit_pack_purchase',
    'composite_generation',
    'generation',
    'refund',
    'bonus',
    'free_trial',
    'free_plan'
  ));

-- ── 4. Index on products.brand_id ────────────────────────────────────────────
-- brand_id FK was added in 20260306000002 without an index.
-- Queries in confirm-products checking per-brand limits do sequential scans.

CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products (brand_id);
