CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS is enabled intentionally. No anon INSERT policy is created.
-- Submissions go through the submit-feedback Edge Function which uses the
-- service-role admin client — service role bypasses RLS entirely, so inserts
-- will succeed without any explicit policy. Direct anon inserts are blocked.
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
