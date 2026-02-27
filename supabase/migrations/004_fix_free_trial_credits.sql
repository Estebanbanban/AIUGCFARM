-- Fix: Free trial should be 9 segment credits per PRD FR34
-- (1 full batch = 3 hooks + 3 bodies + 3 CTAs = 27 video combinations)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );
  INSERT INTO credit_balances (owner_id, remaining)
  VALUES (NEW.id, 9);
  INSERT INTO credit_ledger (owner_id, amount, reason)
  VALUES (NEW.id, 9, 'free_trial');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
