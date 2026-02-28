-- Free plan users get 0 initial credits.
-- They explore the app (persona creation, image gen, scripting) for free,
-- and are prompted to purchase at the video generation step.

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
  VALUES (NEW.id, 0);
  INSERT INTO credit_ledger (owner_id, amount, reason)
  VALUES (NEW.id, 0, 'free_plan');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
