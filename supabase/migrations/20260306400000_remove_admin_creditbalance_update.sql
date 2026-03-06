-- 20260306400000_remove_admin_creditbalance_update.sql
--
-- Security hardening: remove admin direct-UPDATE on credit_balances.
--
-- Problem: the "Admins can update all credit balances" policy (0131_admin_panel.sql:63-71)
-- allowed admin-role users to modify credit_balances directly via the client,
-- bypassing the credit_ledger audit trail entirely. An admin could add or remove
-- credits with zero record of the change.
--
-- Fix: drop the policy. All credit adjustments must go through the
-- increment_credits / deduct_credits RPCs (which enforce the ledger atomically)
-- or through Edge Functions using the service_role client.
--
-- Admin SELECT on credit_balances is preserved (read-only access for dashboards).
-- Admin INSERT on credit_ledger is preserved (manual bonus/adjustment entries).

DROP POLICY IF EXISTS "Admins can update all credit balances" ON public.credit_balances;
