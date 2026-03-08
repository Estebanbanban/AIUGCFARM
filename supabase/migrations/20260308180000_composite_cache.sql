-- composite_cache: persists generated scene preview paths server-side so they
-- survive localStorage clears, Stripe redirects, and browser restarts.
-- One row per (user, product, persona, format) — upserted on every generation.

CREATE TABLE IF NOT EXISTS composite_cache (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  product_id UUID        NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  persona_id UUID        NOT NULL REFERENCES personas(id)  ON DELETE CASCADE,
  format     TEXT        NOT NULL CHECK (format IN ('9:16', '16:9')),
  paths      TEXT[]      NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One cache entry per (user, product, persona, format) — used for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_composite_cache_unique
  ON composite_cache (user_id, product_id, persona_id, format);

-- Fast lookup by owner
CREATE INDEX IF NOT EXISTS idx_composite_cache_user
  ON composite_cache (user_id);

ALTER TABLE composite_cache ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own cache entries
CREATE POLICY "composite_cache_select"
  ON composite_cache FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "composite_cache_insert"
  ON composite_cache FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "composite_cache_update"
  ON composite_cache FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "composite_cache_delete"
  ON composite_cache FOR DELETE TO authenticated
  USING (user_id = auth.uid());
