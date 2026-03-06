-- ============================================================
-- 20260306200000_fix_trigger_search_path.sql
--
-- Add SET search_path = public to the update_updated_at() trigger
-- function. Without an explicit search_path, a SECURITY DEFINER
-- function (or a trigger function called by one) could resolve
-- table names against an attacker-controlled schema if search_path
-- is manipulated. Explicit search_path eliminates this risk.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
