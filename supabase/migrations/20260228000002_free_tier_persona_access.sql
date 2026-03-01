-- Free-tier persona access: allow 1 persona + track image-gen attempts for rate limiting
-- Free users can create 1 persona and regenerate images up to FREE_REGEN_LIMIT times
-- (2 images per call × 5 calls = 10 images max as a guardrail against abuse)

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS regen_count INTEGER NOT NULL DEFAULT 0;
