ALTER TABLE shp_mailbox_credentials
  ADD COLUMN IF NOT EXISTS credential_state TEXT NOT NULL DEFAULT 'configured';

ALTER TABLE shp_mailbox_credentials
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;

ALTER TABLE shp_mailbox_credentials
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;

ALTER TABLE shp_mailbox_credentials
  ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ;

UPDATE shp_mailbox_credentials
SET credential_state = 'configured'
WHERE credential_state IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shp_mailbox_credentials_state_check'
  ) THEN
    ALTER TABLE shp_mailbox_credentials
      ADD CONSTRAINT shp_mailbox_credentials_state_check
      CHECK (credential_state IN ('missing', 'configured', 'reset_required'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS shp_mailbox_credential_reveals (
  reveal_id TEXT PRIMARY KEY,
  mailbox_id TEXT NOT NULL REFERENCES shp_mailboxes(mailbox_id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES shp_users(user_id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  secret_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  CHECK (action IN ('generated', 'rotated'))
);

CREATE INDEX IF NOT EXISTS shp_mailbox_credential_reveals_actor_idx
  ON shp_mailbox_credential_reveals (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS shp_mailbox_credential_reveals_mailbox_idx
  ON shp_mailbox_credential_reveals (mailbox_id, created_at DESC);

CREATE INDEX IF NOT EXISTS shp_mailbox_credential_reveals_expires_idx
  ON shp_mailbox_credential_reveals (expires_at, consumed_at);
