-- Add Clerk user ID to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE;

-- Index for fast lookup by Clerk user ID
CREATE INDEX IF NOT EXISTS profiles_clerk_user_id_idx
  ON public.profiles (clerk_user_id);
