-- Add INSERT policy for composite-images bucket
-- (SELECT policy already exists in 002_storage_buckets.sql)

CREATE POLICY "Users can upload composite images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'composite-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
