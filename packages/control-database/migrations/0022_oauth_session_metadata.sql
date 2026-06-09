ALTER TABLE control_plane_sessions
  ADD COLUMN IF NOT EXISTS oauth_client_id TEXT,
  ADD COLUMN IF NOT EXISTS oauth_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS oauth_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS oauth_issuer TEXT;

CREATE INDEX IF NOT EXISTS control_plane_sessions_auth_provider_idx
  ON control_plane_sessions (auth_provider_slug, revoked_at, expires_at);
