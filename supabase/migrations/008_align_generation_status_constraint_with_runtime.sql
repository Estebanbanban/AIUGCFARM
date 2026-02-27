-- Align generations.status CHECK constraint with statuses used by runtime code.
-- Runtime generation flow:
-- pending -> scripting -> submitting_jobs -> generating_segments -> completed|failed

ALTER TABLE generations
  DROP CONSTRAINT IF EXISTS generations_status_check;

ALTER TABLE generations
  ADD CONSTRAINT generations_status_check
    CHECK (status IN (
      'pending',
      'scripting',
      'submitting_jobs',
      'generating_segments',
      'completed',
      'failed'
    ));

