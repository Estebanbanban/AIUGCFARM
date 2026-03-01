-- ============================================================
-- 20260228000001_drop_admin_rls_policies.sql
-- Drop admin RLS policies that caused data leakage.
--
-- The admin panel exclusively uses the service role key
-- (which bypasses RLS entirely), so these policies are
-- both redundant and harmful: any user with role='admin'
-- could see ALL users' products, personas, and other data
-- through the regular browser client.
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all products"    ON products;
DROP POLICY IF EXISTS "Admins can view all personas"    ON personas;
DROP POLICY IF EXISTS "Admins can view all generations" ON generations;
DROP POLICY IF EXISTS "Admins can view all profiles"    ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles"  ON profiles;
DROP POLICY IF EXISTS "Admins can view all subscriptions"       ON subscriptions;
DROP POLICY IF EXISTS "Admins can update all subscriptions"     ON subscriptions;
DROP POLICY IF EXISTS "Admins can view all credit balances"     ON credit_balances;
DROP POLICY IF EXISTS "Admins can update all credit balances"   ON credit_balances;
DROP POLICY IF EXISTS "Admins can view all credit ledger"       ON credit_ledger;
DROP POLICY IF EXISTS "Admins can insert credit ledger entries" ON credit_ledger;
