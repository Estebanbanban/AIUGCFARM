-- Block direct user writes to sensitive tables via anon key
-- Edge functions use service_role and bypass RLS, so this only blocks frontend REST calls

-- generations table
CREATE POLICY "block_user_insert_generations" ON public.generations FOR INSERT WITH CHECK (false);
CREATE POLICY "block_user_update_generations" ON public.generations FOR UPDATE USING (false);
CREATE POLICY "block_user_delete_generations" ON public.generations FOR DELETE USING (false);

-- credit_balances table
CREATE POLICY "block_user_insert_credit_balances" ON public.credit_balances FOR INSERT WITH CHECK (false);
CREATE POLICY "block_user_update_credit_balances" ON public.credit_balances FOR UPDATE USING (false);
CREATE POLICY "block_user_delete_credit_balances" ON public.credit_balances FOR DELETE USING (false);

-- credit_ledger table
CREATE POLICY "block_user_insert_credit_ledger" ON public.credit_ledger FOR INSERT WITH CHECK (false);
CREATE POLICY "block_user_update_credit_ledger" ON public.credit_ledger FOR UPDATE USING (false);
CREATE POLICY "block_user_delete_credit_ledger" ON public.credit_ledger FOR DELETE USING (false);
