-- 20260306500000_allow_delete_own_generations.sql
--
-- Allow users to delete their own generation records.
-- Replaces the blanket block_user_delete_generations policy with
-- an owner-scoped allow policy so users can clean up their history.

DROP POLICY IF EXISTS "block_user_delete_generations" ON public.generations;

CREATE POLICY "Users can delete own generations"
  ON public.generations
  FOR DELETE
  USING (auth.uid() = owner_id);
