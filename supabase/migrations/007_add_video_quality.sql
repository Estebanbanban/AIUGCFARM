-- Add video_quality to generations table.
-- 'standard' → kling-v2-6 std ($0.042/s, 3 credits/segment)
-- 'hd'       → kling-v3 std  ($0.084/s, 6 credits/segment)

ALTER TABLE generations
  ADD COLUMN video_quality TEXT NOT NULL DEFAULT 'standard'
    CHECK (video_quality IN ('standard', 'hd'));
