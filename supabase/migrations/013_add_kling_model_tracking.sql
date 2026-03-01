-- Track the actual Kling model used for each generation so history/cost can
-- be derived from model truth instead of inferred quality only.
ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS kling_model TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'generations_kling_model_check'
  ) THEN
    ALTER TABLE generations
      ADD CONSTRAINT generations_kling_model_check
      CHECK (
        kling_model IS NULL OR kling_model IN ('kling-v2-6', 'kling-v3', 'kling-v3-0')
      );
  END IF;
END
$$;

-- Backfill existing rows from the stored quality when model is unknown.
UPDATE generations
SET kling_model = CASE
  WHEN video_quality = 'hd' THEN 'kling-v3'
  ELSE 'kling-v2-6'
END
WHERE kling_model IS NULL;
