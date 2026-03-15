-- Hook Library: pre-recorded hooks with TikTok/Instagram style text overlays
-- Users select a hook from the library to use in SaaS Demo Mode
CREATE TABLE IF NOT EXISTS hook_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'tiktok', -- 'tiktok' | 'instagram'
  description TEXT,
  storage_path TEXT NOT NULL, -- path in hook-library bucket
  thumbnail_path TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hook_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read hook library"
  ON hook_library FOR SELECT TO authenticated USING (true);

-- Storage bucket for hook videos (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('hook-library', 'hook-library', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "hook_lib_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hook-library');

-- Seed hooks (replace storage_path with real uploaded videos)
INSERT INTO hook_library (title, style, description, storage_path, sort_order) VALUES
  ('Wait till you see this', 'tiktok', 'Classic TikTok text hook with bold caption overlay', 'hooks/tiktok-wait-till-you-see.mp4', 1),
  ('POV: You found the app', 'tiktok', 'POV-style hook with TikTok trending format', 'hooks/tiktok-pov-found-app.mp4', 2),
  ('Stop scrolling if you run a SaaS', 'tiktok', 'Direct address hook targeting SaaS founders', 'hooks/tiktok-stop-scrolling-saas.mp4', 3),
  ('I built this in a weekend', 'instagram', 'Instagram Reel story-style hook', 'hooks/ig-built-in-weekend.mp4', 4),
  ('This tool replaced my entire team', 'instagram', 'Bold claim hook for Instagram Reels', 'hooks/ig-replaced-team.mp4', 5),
  ('Before vs After using our app', 'tiktok', 'Before/after transformation hook', 'hooks/tiktok-before-after.mp4', 6);
