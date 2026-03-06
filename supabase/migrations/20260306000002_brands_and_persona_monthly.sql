-- Brands table
CREATE TABLE IF NOT EXISTS public.brands (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  store_url       TEXT,
  visual_identity JSONB NOT NULL DEFAULT '{}',
  messaging       JSONB NOT NULL DEFAULT '{}',
  brand_type      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own brands" ON public.brands
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- FK on products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

-- Monthly persona creation tracking
CREATE TABLE IF NOT EXISTS public.persona_monthly_limits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month_year    TEXT NOT NULL,
  personas_created INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT persona_monthly_limits_owner_month_key UNIQUE (owner_id, month_year)
);
ALTER TABLE public.persona_monthly_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own persona limits" ON public.persona_monthly_limits FOR SELECT USING (auth.uid() = owner_id);

-- Backfill: auto-create brands from existing store_url groupings
INSERT INTO public.brands (owner_id, name, store_url)
SELECT DISTINCT
  p.owner_id,
  CASE WHEN p.store_url IS NULL THEN 'My Products'
       ELSE regexp_replace(regexp_replace(split_part(regexp_replace(p.store_url,'^https?://',''),'/',1),'^www\.',''),'\.myshopify\.com$','')
  END,
  CASE WHEN p.store_url IS NULL THEN NULL
       ELSE split_part(regexp_replace(p.store_url,'^https?://',''),'/',1)
  END
FROM public.products p
ON CONFLICT DO NOTHING;

-- Link existing products to their brand
UPDATE public.products pr SET brand_id = b.id
FROM public.brands b
WHERE b.owner_id = pr.owner_id
  AND ((pr.store_url IS NULL AND b.store_url IS NULL)
    OR (pr.store_url IS NOT NULL AND b.store_url = split_part(regexp_replace(pr.store_url,'^https?://',''),'/',1)))
  AND pr.brand_id IS NULL;
