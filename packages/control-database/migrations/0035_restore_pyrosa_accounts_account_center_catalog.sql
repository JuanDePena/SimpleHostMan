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
  'app-pyrosa-accounts',
  'tenant-pyrosa',
  'zone-pyrosa.com.do',
  'primary',
  NULL,
  'pyrosa-accounts',
  'docker.io/library/node:22-bookworm-slim',
  10124,
  '/srv/containers/apps/pyrosa-accounts',
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
  'site-pyrosa-accounts',
  'app-pyrosa-accounts',
  'accounts.pyrosa.com.do',
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
  'database-pyrosa-accounts',
  'app-pyrosa-accounts',
  'primary',
  NULL,
  'postgresql',
  'app_pyrosa_accounts',
  'app_pyrosa_accounts',
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
    'backup-policy-pyrosa-accounts-database-daily',
    'tenant-pyrosa',
    'primary',
    'pyrosa-accounts-database-daily',
    '41 1 * * *',
    14,
    '/srv/backups/databases/pyrosa-accounts',
    '["database:app_pyrosa_accounts"]'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'backup-policy-pyrosa-accounts-files-daily',
    'tenant-pyrosa',
    'primary',
    'pyrosa-accounts-files-daily',
    '51 1 * * *',
    14,
    '/srv/backups/apps/pyrosa-accounts',
    '["app-files:pyrosa-accounts"]'::jsonb,
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
    config_json #- '{runtime,controlPlaneResources,replacesRetiredAppSlug}',
    '{runtime,controlPlaneResources,accountsPortal}',
    '{
      "appSlug": "pyrosa-accounts",
      "canonicalDomain": "accounts.pyrosa.com.do",
      "backendPort": 10124,
      "database": "app_pyrosa_accounts",
      "backupPolicies": [
        "pyrosa-accounts-database-daily",
        "pyrosa-accounts-files-daily"
      ],
      "purpose": "user_account_center",
      "iamProvider": false,
      "reconciliation": "metadata_only"
    }'::jsonb,
    true
  ),
  notes = 'Pyrosa IAM owns authentication, MFA, OAuth/OIDC, gateway and app-native ui-auth. Pyrosa Accounts remains a user-facing account/profile portal, not an IAM provider.',
  updated_at = NOW()
WHERE slug = 'pyrosa-iam';
