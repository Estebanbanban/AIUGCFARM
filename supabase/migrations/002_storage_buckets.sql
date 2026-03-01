-- ============================================================
-- 002_storage_buckets.sql
-- Storage buckets and access policies for UGC Farm AI
-- ============================================================

-- =========================
-- Create private buckets
-- =========================
INSERT INTO storage.buckets (id, name, public) VALUES ('persona-images',    'persona-images',    false);
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-videos',  'generated-videos',  false);
INSERT INTO storage.buckets (id, name, public) VALUES ('composite-images',  'composite-images',  false);
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images',    'product-images',    false);

-- =========================
-- Storage access policies
-- =========================

-- Product images: authenticated users can upload to their own folder
CREATE POLICY "Users can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Product images: users can view their own uploads
CREATE POLICY "Users can view own product images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Persona images: authenticated users can upload to their own folder
CREATE POLICY "Users can upload persona images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'persona-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Persona images: users can view their own uploads
CREATE POLICY "Users can view own persona images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'persona-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Composite images: users can view their own composites
CREATE POLICY "Users can view own composite images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'composite-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Generated videos: users can view their own videos
CREATE POLICY "Users can view own generated videos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'generated-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
