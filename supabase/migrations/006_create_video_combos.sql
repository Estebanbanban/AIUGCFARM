-- 006: Video combos
CREATE TYPE combo_status AS ENUM ('pending', 'assembling', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS video_combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hook_segment_id UUID NOT NULL REFERENCES segments(id),
  body_segment_id UUID NOT NULL REFERENCES segments(id),
  cta_segment_id UUID NOT NULL REFERENCES segments(id),
  status combo_status NOT NULL DEFAULT 'pending',
  video_url TEXT,
  duration_seconds NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_combos_user_id ON video_combos(user_id);
