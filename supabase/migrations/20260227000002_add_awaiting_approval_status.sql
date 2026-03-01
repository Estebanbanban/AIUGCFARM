-- Status is a text column with a CHECK constraint (not an enum).
-- Add 'awaiting_approval' to the allowed values.
ALTER TABLE generations
  DROP CONSTRAINT IF EXISTS generations_status_check;

ALTER TABLE generations
  ADD CONSTRAINT generations_status_check
    CHECK (status IN (
      'pending',
      'scripting',
      'awaiting_approval',
      'locking',
      'submitting_jobs',
      'generating_segments',
      'completed',
      'failed'
    ));
