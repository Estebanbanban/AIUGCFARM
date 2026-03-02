ALTER TABLE generations
  ADD COLUMN video_provider TEXT NOT NULL DEFAULT 'kling'
    CHECK (video_provider IN ('kling', 'sora'));
