-- ============================================================
-- 003_decrement_credits_function.sql
-- RPC function for atomic credit decrement (called by Edge Functions)
-- ============================================================

CREATE OR REPLACE FUNCTION decrement_credits(p_user_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE credit_balances
  SET remaining = remaining - p_amount
  WHERE owner_id = p_user_id
    AND remaining >= p_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
