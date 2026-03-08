-- Add format and cta_style to generations so the full wizard state
-- is recoverable from a single DB query (survives localStorage loss).

ALTER TABLE generations
  ADD COLUMN format TEXT CHECK (format IN ('9:16', '16:9'));

ALTER TABLE generations
  ADD COLUMN cta_style TEXT;
