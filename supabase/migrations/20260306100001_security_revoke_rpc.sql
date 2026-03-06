-- ============================================================
-- 20260306100001_security_revoke_rpc.sql
--
-- Security hardening for SECURITY DEFINER RPC functions:
--
-- 1. Revoke PUBLIC/authenticated/anon EXECUTE on decrement_credits.
--    PostgreSQL grants EXECUTE to PUBLIC by default on new functions.
--    Migration 010_fix_decrement_credits_security.sql added a service_role
--    GRANT but never revoked the implicit PUBLIC grant, allowing any
--    authenticated user to call the RPC with a negative p_amount to
--    add credits to any account.
--
-- 2. Recreate append_persona_image with SET search_path = public to
--    eliminate the schema injection risk present on SECURITY DEFINER
--    functions that omit an explicit search_path.
--
-- 3. Revoke PUBLIC/authenticated/anon EXECUTE on append_persona_image.
--    The existing GRANT to service_role is preserved.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Lock down decrement_credits
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.decrement_credits(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrement_credits(UUID, INTEGER) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_credits(UUID, INTEGER) FROM anon;

-- ------------------------------------------------------------
-- 2. Recreate append_persona_image with SET search_path = public
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.append_persona_image(
  p_persona_id uuid,
  p_owner_id   uuid,
  p_image_path text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE personas
  SET
    generated_images = generated_images || ARRAY[p_image_path],
    regen_count      = COALESCE(regen_count, 0) + 1,
    updated_at       = NOW()
  WHERE id = p_persona_id AND owner_id = p_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'persona_not_found';
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 3. Lock down append_persona_image
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.append_persona_image(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.append_persona_image(uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.append_persona_image(uuid, uuid, text) FROM anon;

-- Preserve the existing grant so edge functions (admin client) can still call it
GRANT EXECUTE ON FUNCTION public.append_persona_image(uuid, uuid, text) TO service_role;
