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
VALUES (
  'app-pyrosa-iam',
  'tenant-pyrosa',
  'zone-pyrosa.com.do',
  'primary',
  NULL,
  'pyrosa-iam',
  'docker.io/library/node:22-bookworm-slim',
  10134,
  '/srv/containers/apps/pyrosa-iam',
  'metadata-only',
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
VALUES (
  'site-pyrosa-iam',
  'app-pyrosa-iam',
  'iam.pyrosa.com.do',
  '[]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (canonical_domain) DO UPDATE SET
  app_id = EXCLUDED.app_id,
  aliases = EXCLUDED.aliases,
  updated_at = NOW();

INSERT INTO control_plane_databases (
  database_id,
  app_id,
  primary_node_id,
  standby_node_id,
  engine,
  database_name,
  database_user,
  pending_migration_to,
  migration_completed_from,
  migration_completed_at,
  created_at,
  updated_at
)
VALUES (
  'database-pyrosa-iam',
  'app-pyrosa-iam',
  'primary',
  NULL,
  'postgresql',
  'app_pyrosa_iam',
  'app_pyrosa_iam',
  NULL,
  NULL,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (engine, database_name) DO UPDATE SET
  app_id = EXCLUDED.app_id,
  primary_node_id = EXCLUDED.primary_node_id,
  standby_node_id = EXCLUDED.standby_node_id,
  database_user = EXCLUDED.database_user,
  pending_migration_to = EXCLUDED.pending_migration_to,
  migration_completed_from = EXCLUDED.migration_completed_from,
  migration_completed_at = EXCLUDED.migration_completed_at,
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
    'backup-policy-pyrosa-iam-database-daily',
    'tenant-pyrosa',
    'primary',
    'pyrosa-iam-database-daily',
    '43 1 * * *',
    14,
    '/srv/backups/databases/pyrosa-iam',
    '["database:app_pyrosa_iam"]'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'backup-policy-pyrosa-iam-files-daily',
    'tenant-pyrosa',
    'primary',
    'pyrosa-iam-files-daily',
    '53 1 * * *',
    14,
    '/srv/backups/apps/pyrosa-iam',
    '["app-files:pyrosa-iam"]'::jsonb,
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

UPDATE control_plane_iam_providers
SET
  config_json = jsonb_set(
    jsonb_set(
      config_json,
      '{runtime,status}',
      '"loopback_pilot_active"'::jsonb,
      true
    ),
    '{runtime,controlPlaneResources}',
    '{
      "appSlug": "pyrosa-iam",
      "canonicalDomain": "iam.pyrosa.com.do",
      "backendPort": 10134,
      "database": "app_pyrosa_iam",
      "backupPolicies": [
        "pyrosa-iam-database-daily",
        "pyrosa-iam-files-daily"
      ],
      "traffic": "not_public",
      "reconciliation": "metadata_only"
    }'::jsonb,
    true
  ),
  notes = 'Formal IAM provider candidate split from Pyrosa Accounts. Runtime is active only on loopback with app/database/backup catalog metadata; public traffic remains on Authentik.',
  updated_at = NOW()
WHERE slug = 'pyrosa-iam';
