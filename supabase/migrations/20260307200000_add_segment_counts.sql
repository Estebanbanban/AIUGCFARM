-- Story 13.1: Custom segment counts for campaign mode
-- Adds per-slot segment count columns to support variable N×M×P generation matrices.
-- Defaults to 3 (existing 3×3×3 behaviour). Capped at 5 per slot.
ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS hooks_count INTEGER NOT NULL DEFAULT 3
    CONSTRAINT hooks_count_range CHECK (hooks_count BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS bodies_count INTEGER NOT NULL DEFAULT 3
    CONSTRAINT bodies_count_range CHECK (bodies_count BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS ctas_count INTEGER NOT NULL DEFAULT 3
    CONSTRAINT ctas_count_range CHECK (ctas_count BETWEEN 1 AND 5);

COMMENT ON COLUMN generations.hooks_count  IS 'Number of hook variants generated (1–5, default 3)';
COMMENT ON COLUMN generations.bodies_count IS 'Number of body variants generated (1–5, default 3)';
COMMENT ON COLUMN generations.ctas_count   IS 'Number of CTA variants generated (1–5, default 3)';
