-- Update generations.mode CHECK constraint from easy/expert to single/triple
ALTER TABLE generations DROP CONSTRAINT IF EXISTS generations_mode_check;
ALTER TABLE generations ADD CONSTRAINT generations_mode_check
  CHECK (mode IN ('single', 'triple'));
ALTER TABLE generations ALTER COLUMN mode SET DEFAULT 'single';
