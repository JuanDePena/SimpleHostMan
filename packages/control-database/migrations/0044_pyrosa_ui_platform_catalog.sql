INSERT INTO control_plane_apps (
  app_id,
  tenant_id,
  zone_id,
  primary_node_id,
  standby_node_id,
  slug,
  runtime_image,
  backend_port,
  storage_root,
  mode,
  created_at,
  updated_at
)
VALUES
  (
    'app-pyrosa-ui',
    'tenant-pyrosa',
    'zone-pyrosa.com.do',
    'primary',
    'secondary',
    'pyrosa-ui',
    'registry.example.com/pyrosa-placeholder:stable',
    10164,
    '/srv/containers/apps/pyrosa-ui',
    'active-passive',
    NOW(),
    NOW()
  ),
  (
    'app-pyrosa-platform',
    'tenant-pyrosa',
    'zone-pyrosa.com.do',
    'primary',
    'secondary',
    'pyrosa-platform',
    'registry.example.com/pyrosa-placeholder:stable',
    10165,
    '/srv/containers/apps/pyrosa-platform',
    'active-passive',
    NOW(),
    NOW()
  )
ON CONFLICT (slug) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  zone_id = EXCLUDED.zone_id,
  primary_node_id = EXCLUDED.primary_node_id,
  standby_node_id = EXCLUDED.standby_node_id,
  runtime_image = EXCLUDED.runtime_image,
  backend_port = EXCLUDED.backend_port,
  storage_root = EXCLUDED.storage_root,
  mode = EXCLUDED.mode,
  updated_at = NOW();

INSERT INTO control_plane_sites (
  site_id,
  app_id,
  canonical_domain,
  aliases,
  created_at,
  updated_at
)
VALUES
  (
    'site-pyrosa-ui',
    'app-pyrosa-ui',
    'ui.pyrosa.com.do',
    '[]'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'site-pyrosa-platform',
    'app-pyrosa-platform',
    'platform.pyrosa.com.do',
    '[]'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT (canonical_domain) DO UPDATE SET
  app_id = EXCLUDED.app_id,
  aliases = EXCLUDED.aliases,
  updated_at = NOW();

INSERT INTO control_plane_dns_records (
  record_id,
  zone_id,
  name,
  type,
  value,
  ttl,
  created_at,
  updated_at
)
VALUES
  (
    'record-pyrosa-ui-a-51-222-204-86',
    'zone-pyrosa.com.do',
    'ui',
    'A',
    '51.222.204.86',
    300,
    NOW(),
    NOW()
  ),
  (
    'record-pyrosa-platform-a-51-222-204-86',
    'zone-pyrosa.com.do',
    'platform',
    'A',
    '51.222.204.86',
    300,
    NOW(),
    NOW()
  )
ON CONFLICT (zone_id, name, type, value) DO UPDATE SET
  ttl = EXCLUDED.ttl,
  updated_at = NOW();

INSERT INTO control_plane_backup_policies (
  policy_id,
  tenant_id,
  target_node_id,
  policy_slug,
  schedule,
  retention_days,
  storage_location,
  resource_selectors,
  created_at,
  updated_at
)
VALUES
  (
    'backup-policy-pyrosa-ui-files-daily',
    'tenant-pyrosa',
    'primary',
    'pyrosa-ui-files-daily',
    '55 1 * * *',
    14,
    '/srv/backups/apps/pyrosa-ui',
    '["app-files:pyrosa-ui"]'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'backup-policy-pyrosa-platform-files-daily',
    'tenant-pyrosa',
    'primary',
    'pyrosa-platform-files-daily',
    '57 1 * * *',
    14,
    '/srv/backups/apps/pyrosa-platform',
    '["app-files:pyrosa-platform"]'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT (policy_slug) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  target_node_id = EXCLUDED.target_node_id,
  schedule = EXCLUDED.schedule,
  retention_days = EXCLUDED.retention_days,
  storage_location = EXCLUDED.storage_location,
  resource_selectors = EXCLUDED.resource_selectors,
  updated_at = NOW();
