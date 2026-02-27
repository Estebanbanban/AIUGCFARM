-- Fix generations.status CHECK constraint to include all statuses used by the
-- backend (generate-video/, video-status/) and frontend (generate/[id] page).
--
-- Root cause: original migration had 'generating_image' (never written by backend)
-- but was missing 'content_ready' (used in frontend statusConfig/types).
-- Backend actual flow: pending → scripting → submitting_jobs → generating_segments → completed|failed
-- Frontend also tracks: content_ready, generating_video, stitching (Phase 1.5 roadmap)

ALTER TABLE generations
  DROP CONSTRAINT IF EXISTS generations_status_check;

ALTER TABLE generations
  ADD CONSTRAINT generations_status_check
    CHECK (status IN (
      'pending',
      'scripting',
      'content_ready',
      'submitting_jobs',
      'generating_segments',
      'generating_video',
      'stitching',
      'completed',
      'failed'
    ));
