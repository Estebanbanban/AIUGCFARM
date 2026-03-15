-- Add screen_recording_url column to generations for SaaS Demo Mode
-- When set, the body segment's visuals are replaced with this screen recording
-- while keeping the AI-generated body audio as voiceover.
ALTER TABLE generations ADD COLUMN IF NOT EXISTS screen_recording_url TEXT;

-- Create storage bucket for screen recordings (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('screen-recordings', 'screen-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: owners can upload to their own folder
CREATE POLICY "Users can upload screen recordings"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'screen-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: owners can read their own screen recordings
CREATE POLICY "Users can read own screen recordings"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'screen-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: owners can delete their own screen recordings
CREATE POLICY "Users can delete own screen recordings"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'screen-recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
