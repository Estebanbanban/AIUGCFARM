-- YouTube Publishing: connections + publishes tables
-- Edge Functions use service_role (admin client) which bypasses RLS,
-- so we enable RLS but do not create user-facing policies.

-- 1. youtube_connections
CREATE TABLE youtube_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_title TEXT NOT NULL,
  channel_thumbnail TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, channel_id)
);

ALTER TABLE youtube_connections ENABLE ROW LEVEL SECURITY;

-- 2. youtube_publishes
CREATE TABLE youtube_publishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES youtube_connections(id) ON DELETE CASCADE,
  youtube_video_id TEXT,
  youtube_url TEXT,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'unlisted', 'private')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'processing', 'completed', 'failed')),
  error_message TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE youtube_publishes ENABLE ROW LEVEL SECURITY;

-- 3. youtube_oauth_states (short-lived nonces for CSRF protection)
CREATE TABLE youtube_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE youtube_oauth_states ENABLE ROW LEVEL SECURITY;

-- 4. Indexes
CREATE INDEX idx_youtube_connections_owner ON youtube_connections(owner_id);
CREATE INDEX idx_youtube_publishes_owner ON youtube_publishes(owner_id);
CREATE INDEX idx_youtube_publishes_generation ON youtube_publishes(generation_id);
CREATE INDEX idx_youtube_oauth_states_nonce ON youtube_oauth_states(nonce);
