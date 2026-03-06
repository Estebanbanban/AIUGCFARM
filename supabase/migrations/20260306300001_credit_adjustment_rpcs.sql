-- 20260306300001_credit_adjustment_rpcs.sql
-- Atomic credit adjustment RPCs — fix H2 race condition in stripe-webhook.
--
-- Problem: stripe-webhook used SELECT → compute → UPSERT (non-atomic).
-- Two concurrent webhook deliveries could both read the same stale balance
-- and one credit grant would be silently lost.
--
-- Fix: single SQL statement UPDATE ... SET remaining = remaining + amount
-- which PostgreSQL serialises with a row-level lock automatically.
-- The ledger INSERT is in the same transaction so both succeed or both fail.

-- ── increment_credits ─────────────────────────────────────────────────────────
-- Atomically adds p_amount credits and records the ledger entry.
-- Uses INSERT ... ON CONFLICT DO UPDATE to handle the rare case where the
-- credit_balances row doesn't exist yet (belt-and-suspenders — handle_new_user
-- always creates it, but this makes the function safe regardless).

CREATE OR REPLACE FUNCTION public.increment_credits(
  p_owner_id uuid,
  p_amount   integer,
  p_reason   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO credit_balances (owner_id, remaining)
  VALUES (p_owner_id, p_amount)
  ON CONFLICT (owner_id) DO UPDATE
    SET remaining = credit_balances.remaining + p_amount;

  INSERT INTO credit_ledger (owner_id, amount, reason)
  VALUES (p_owner_id, p_amount, p_reason);
END;
$$;

-- ── deduct_credits ────────────────────────────────────────────────────────────
-- Atomically deducts p_amount credits (floored at 0) and records the ledger entry.
-- Used for refunds where the amount is calculated from Stripe data, not DB state.

CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_owner_id uuid,
  p_amount   integer,
  p_reason   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO credit_balances (owner_id, remaining)
  VALUES (p_owner_id, 0)
  ON CONFLICT (owner_id) DO UPDATE
    SET remaining = GREATEST(0, credit_balances.remaining - p_amount);

  INSERT INTO credit_ledger (owner_id, amount, reason)
  VALUES (p_owner_id, p_amount, p_reason);
END;
$$;

-- Lock down: only service_role (Edge Functions) may call these
REVOKE ALL ON FUNCTION public.increment_credits(uuid, integer, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.increment_credits(uuid, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.deduct_credits(uuid, integer, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, text) TO service_role;
