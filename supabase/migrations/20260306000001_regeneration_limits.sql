-- Monthly regeneration limit tracking per user
CREATE TABLE IF NOT EXISTS public.regeneration_limits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,               -- format 'YYYY-MM'
  regens_used INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT regeneration_limits_owner_month_key UNIQUE (owner_id, month_year)
);

ALTER TABLE public.regeneration_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own limits"
  ON public.regeneration_limits FOR SELECT
  USING (auth.uid() = owner_id);
