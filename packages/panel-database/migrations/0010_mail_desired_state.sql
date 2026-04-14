CREATE TABLE IF NOT EXISTS shp_mail_domains (
  mail_domain_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES shp_tenants(tenant_id) ON DELETE CASCADE,
  zone_id TEXT NOT NULL REFERENCES shp_dns_zones(zone_id) ON DELETE CASCADE,
  primary_node_id TEXT NOT NULL REFERENCES shp_nodes(node_id) ON DELETE RESTRICT,
  standby_node_id TEXT REFERENCES shp_nodes(node_id) ON DELETE RESTRICT,
  domain_name TEXT NOT NULL UNIQUE,
  mail_host TEXT NOT NULL UNIQUE,
  dkim_selector TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shp_mail_domains_tenant_idx
  ON shp_mail_domains (tenant_id, domain_name);

CREATE INDEX IF NOT EXISTS shp_mail_domains_zone_idx
  ON shp_mail_domains (zone_id, domain_name);

CREATE INDEX IF NOT EXISTS shp_mail_domains_primary_node_idx
  ON shp_mail_domains (primary_node_id, domain_name);

CREATE TABLE IF NOT EXISTS shp_mailboxes (
  mailbox_id TEXT PRIMARY KEY,
  mail_domain_id TEXT NOT NULL REFERENCES shp_mail_domains(mail_domain_id) ON DELETE CASCADE,
  primary_node_id TEXT NOT NULL REFERENCES shp_nodes(node_id) ON DELETE RESTRICT,
  standby_node_id TEXT REFERENCES shp_nodes(node_id) ON DELETE RESTRICT,
  address TEXT NOT NULL UNIQUE,
  local_part TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mail_domain_id, local_part)
);

CREATE INDEX IF NOT EXISTS shp_mailboxes_domain_idx
  ON shp_mailboxes (mail_domain_id, local_part);

CREATE INDEX IF NOT EXISTS shp_mailboxes_primary_node_idx
  ON shp_mailboxes (primary_node_id, address);

CREATE TABLE IF NOT EXISTS shp_mailbox_credentials (
  mailbox_id TEXT PRIMARY KEY REFERENCES shp_mailboxes(mailbox_id) ON DELETE CASCADE,
  secret_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shp_mail_aliases (
  mail_alias_id TEXT PRIMARY KEY,
  mail_domain_id TEXT NOT NULL REFERENCES shp_mail_domains(mail_domain_id) ON DELETE CASCADE,
  address TEXT NOT NULL UNIQUE,
  local_part TEXT NOT NULL,
  destinations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mail_domain_id, local_part)
);

CREATE INDEX IF NOT EXISTS shp_mail_aliases_domain_idx
  ON shp_mail_aliases (mail_domain_id, local_part);

CREATE TABLE IF NOT EXISTS shp_mailbox_quotas (
  mailbox_id TEXT PRIMARY KEY REFERENCES shp_mailboxes(mailbox_id) ON DELETE CASCADE,
  storage_bytes BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (storage_bytes > 0)
);
