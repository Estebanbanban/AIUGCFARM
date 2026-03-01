-- ============================================================
-- 010_fix_decrement_credits_security.sql
-- Fix SECURITY DEFINER function: add explicit search_path to prevent
-- schema resolution issues, and grant EXECUTE to service_role.
-- ============================================================

CREATE OR REPLACE FUNCTION decrement_credits(p_user_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.credit_balances
  SET remaining = remaining - p_amount
  WHERE owner_id = p_user_id
    AND remaining >= p_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure service_role (used by Edge Functions admin client) can call this
GRANT EXECUTE ON FUNCTION decrement_credits(UUID, INTEGER) TO service_role;
