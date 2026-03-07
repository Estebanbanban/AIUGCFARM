-- Drop the old Supabase Auth trigger that was creating profiles without clerk_user_id.
-- After the Clerk migration, new profiles are created via the Clerk webhook handler.
-- This trigger was causing all authenticated requests to return 401 because
-- profiles created by the trigger had clerk_user_id = null.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
