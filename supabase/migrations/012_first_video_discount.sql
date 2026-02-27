-- 012_first_video_discount.sql
-- Adds first_video_discount_used to profiles.
-- Tracks whether a user has used their 50% off first-video discount.
-- Once used, normal credit pricing applies.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_video_discount_used BOOLEAN NOT NULL DEFAULT FALSE;
