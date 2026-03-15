-- Add single-video support columns to generations table
ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'multi-segment',
  ADD COLUMN IF NOT EXISTS sora_model TEXT,
  ADD COLUMN IF NOT EXISTS duration INTEGER,
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_image_path TEXT,
  ADD COLUMN IF NOT EXISTS is_saas BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS freeform_prompt TEXT;

-- Make product_id and persona_id nullable for single-video mode
ALTER TABLE generations ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE generations ALTER COLUMN persona_id DROP NOT NULL;

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_generations_type ON generations(type);

-- Check constraints (idempotent: drop if exists before adding)
ALTER TABLE generations DROP CONSTRAINT IF EXISTS chk_generation_type;
ALTER TABLE generations ADD CONSTRAINT chk_generation_type CHECK (type IN ('multi-segment', 'single-video'));

ALTER TABLE generations DROP CONSTRAINT IF EXISTS chk_sora_model;
ALTER TABLE generations ADD CONSTRAINT chk_sora_model CHECK (sora_model IS NULL OR sora_model IN ('sora-2', 'sora-2-pro'));

ALTER TABLE generations DROP CONSTRAINT IF EXISTS chk_reference_type;
ALTER TABLE generations ADD CONSTRAINT chk_reference_type CHECK (reference_type IS NULL OR reference_type IN ('composite', 'persona', 'custom', 'none'));

ALTER TABLE generations DROP CONSTRAINT IF EXISTS chk_duration;
ALTER TABLE generations ADD CONSTRAINT chk_duration CHECK (duration IS NULL OR duration IN (16, 20));
