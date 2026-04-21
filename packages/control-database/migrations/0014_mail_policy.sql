CREATE TABLE IF NOT EXISTS shp_mail_policy (
  policy_id TEXT PRIMARY KEY,
  reject_threshold DOUBLE PRECISION NOT NULL,
  add_header_threshold DOUBLE PRECISION NOT NULL,
  greylist_threshold DOUBLE PRECISION,
  sender_allowlist JSONB NOT NULL DEFAULT '[]'::jsonb,
  sender_denylist JSONB NOT NULL DEFAULT '[]'::jsonb,
  rate_limit_burst INTEGER,
  rate_limit_period_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reject_threshold > 0),
  CHECK (add_header_threshold > 0),
  CHECK (greylist_threshold IS NULL OR greylist_threshold > 0),
  CHECK (rate_limit_burst IS NULL OR rate_limit_burst > 0),
  CHECK (rate_limit_period_seconds IS NULL OR rate_limit_period_seconds > 0)
);
