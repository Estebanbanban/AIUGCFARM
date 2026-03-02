-- Fix: two check constraints were corrupted in production due to line-ending issues
-- at migration push time ('scale' was stored as 'sc\n  ale', 'canceled' as 'canceled\n  ').
-- This caused the Stripe webhook's profile.plan update to silently fail (constraint violation),
-- leaving paid users stuck on the free plan despite having an active subscription.
-- Recreate both constraints with the correct values.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'starter', 'growth', 'scale'));

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete'));
