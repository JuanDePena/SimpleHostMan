CREATE TABLE IF NOT EXISTS control_plane_ddns_hosts (
  host_id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL UNIQUE,
  zone_id TEXT NOT NULL REFERENCES control_plane_dns_zones(zone_id) ON DELETE CASCADE,
  record_name TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('A', 'AAAA')),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  ttl INTEGER NOT NULL DEFAULT 300 CHECK (ttl > 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_ip TEXT,
  last_seen_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (zone_id, record_name, record_type)
);

CREATE INDEX IF NOT EXISTS control_plane_ddns_hosts_zone_idx
  ON control_plane_ddns_hosts (zone_id, record_name, record_type);

CREATE INDEX IF NOT EXISTS control_plane_ddns_hosts_username_idx
  ON control_plane_ddns_hosts (username, hostname);
