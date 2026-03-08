-- Decouple profiles.id from auth.users.id for Clerk migration.
-- Clerk users don't have auth.users entries, so the FK constraint
-- prevents profile creation. Drop it and add a UUID default.

-- Drop FK constraint tying profiles.id to auth.users.id
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Add default UUID generation so inserts without explicit id work
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Drop old RLS policies that rely on auth.uid() matching profiles.id
-- (Edge functions use service_role which bypasses RLS anyway)
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

-- New RLS: allow service_role full access (already implicit), and
-- disable self-service read/write since all access goes via edge functions.
-- This keeps the table locked down; only service_role (edge functions) can touch it.
