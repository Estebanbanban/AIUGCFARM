-- ============================================================
-- 20260315100000_slideshow_feature.sql
-- Epic 14: TikTok Slideshow Generator
-- Tables, RLS policies, storage buckets, triggers, and indexes
-- ============================================================

BEGIN;

-- =========================
-- 1. image_collections
-- =========================
CREATE TABLE image_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE image_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own collections"
  ON image_collections FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "Service role full access"
  ON image_collections FOR ALL
  USING (true)
  WITH CHECK (true);

-- =========================
-- 2. collection_images
-- =========================
CREATE TABLE collection_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES image_collections(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  content_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE collection_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own images"
  ON collection_images FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "Service role full access"
  ON collection_images FOR ALL
  USING (true)
  WITH CHECK (true);

-- =========================
-- 3. slideshows
-- =========================
CREATE TABLE slideshows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Slideshow',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'rendering', 'complete', 'failed')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  video_storage_path TEXT,
  video_duration_seconds NUMERIC,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  hook_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE slideshows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own slideshows"
  ON slideshows FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "Service role full access"
  ON slideshows FOR ALL
  USING (true)
  WITH CHECK (true);

-- =========================
-- 4. slideshow_hooks
-- =========================
CREATE TABLE slideshow_hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  niche TEXT,
  text TEXT NOT NULL,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE slideshow_hooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own hooks"
  ON slideshow_hooks FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "Service role full access"
  ON slideshow_hooks FOR ALL
  USING (true)
  WITH CHECK (true);

-- =========================
-- 5. format_instructions
-- =========================
CREATE TABLE format_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  system_prompt TEXT NOT NULL,
  soft_cta TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE format_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own instructions"
  ON format_instructions FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "Service role full access"
  ON format_instructions FOR ALL
  USING (true)
  WITH CHECK (true);

-- =========================
-- 6. Storage buckets
-- =========================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('slideshow-images', 'slideshow-images', false);

INSERT INTO storage.buckets (id, name, public)
  VALUES ('slideshow-videos', 'slideshow-videos', false);

-- Storage policies for slideshow-images
CREATE POLICY "Users can upload slideshow images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'slideshow-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own slideshow images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'slideshow-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own slideshow images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'slideshow-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Service role slideshow images"
  ON storage.objects FOR ALL
  USING (bucket_id = 'slideshow-images')
  WITH CHECK (bucket_id = 'slideshow-images');

-- Storage policies for slideshow-videos
CREATE POLICY "Users can view own slideshow videos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'slideshow-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Service role slideshow videos"
  ON storage.objects FOR ALL
  USING (bucket_id = 'slideshow-videos')
  WITH CHECK (bucket_id = 'slideshow-videos');

-- =========================
-- 7. Trigger: auto-update image_count
-- =========================
CREATE OR REPLACE FUNCTION update_collection_image_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE image_collections
      SET image_count = image_count + 1, updated_at = now()
      WHERE id = NEW.collection_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE image_collections
      SET image_count = image_count - 1, updated_at = now()
      WHERE id = OLD.collection_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collection_image_count_trigger
  AFTER INSERT OR DELETE ON collection_images
  FOR EACH ROW EXECUTE FUNCTION update_collection_image_count();

-- =========================
-- 8. Indexes
-- =========================
CREATE INDEX idx_collection_images_collection ON collection_images(collection_id);
CREATE INDEX idx_collection_images_owner ON collection_images(owner_id);
CREATE INDEX idx_slideshows_owner ON slideshows(owner_id);
CREATE INDEX idx_slideshow_hooks_owner ON slideshow_hooks(owner_id);
CREATE INDEX idx_slideshow_hooks_product ON slideshow_hooks(product_id);
CREATE INDEX idx_format_instructions_owner ON format_instructions(owner_id);

COMMIT;
