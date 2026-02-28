-- Fix handle_new_user trigger: set explicit search_path so public.profiles,
-- public.credit_balances, and public.credit_ledger resolve correctly when
-- the function runs in the auth schema context (SECURITY DEFINER functions
-- use a restricted search_path by default in recent Postgres/Supabase versions).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );

  INSERT INTO credit_balances (owner_id, remaining)
  VALUES (NEW.id, 0);

  INSERT INTO credit_ledger (owner_id, amount, reason)
  VALUES (NEW.id, 0, 'free_trial');

  RETURN NEW;
END;
$$;
