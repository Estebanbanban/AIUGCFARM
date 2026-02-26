-- 005: Segment batches and segments
CREATE TYPE segment_type AS ENUM ('hook', 'body', 'cta');
CREATE TYPE segment_status AS ENUM ('pending', 'generating_script', 'generating_image', 'generating_video', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS segment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  pov_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_segments INT NOT NULL DEFAULT 0,
  completed_segments INT NOT NULL DEFAULT 0,
  credits_used INT NOT NULL DEFAULT 0,
  credits_refunded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES segment_batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type segment_type NOT NULL,
  status segment_status NOT NULL DEFAULT 'pending',
  script_text TEXT,
  duration_seconds NUMERIC(5,2),
  video_url TEXT,
  thumbnail_url TEXT,
  kling_task_id TEXT,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_segment_batches_user_id ON segment_batches(user_id);
CREATE INDEX idx_segments_batch_id ON segments(batch_id);
CREATE INDEX idx_segments_user_id ON segments(user_id);
CREATE INDEX idx_segments_status ON segments(status);
