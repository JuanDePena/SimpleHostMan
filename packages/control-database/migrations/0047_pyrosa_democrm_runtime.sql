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
  'app-pyrosa-democrm',
  'tenant-pyrosa',
  'zone-pyrosa.com.do',
  'primary',
  'secondary',
  'pyrosa-democrm',
  'docker.io/library/node:22-bookworm-slim',
  10166,
  '/srv/containers/apps/pyrosa-democrm/app',
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
VALUES (
  'site-pyrosa-democrm',
  'app-pyrosa-democrm',
  'democrm.pyrosa.com.do',
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
VALUES (
  'record-pyrosa-democrm-a-51-222-204-86',
  'zone-pyrosa.com.do',
  'democrm',
  'A',
  '51.222.204.86',
  300,
  NOW(),
  NOW()
)
ON CONFLICT (zone_id, name, type, value) DO UPDATE SET
  ttl = EXCLUDED.ttl,
  updated_at = NOW();

INSERT INTO control_plane_databases (
  database_id,
  app_id,
  primary_node_id,
  standby_node_id,
  engine,
  database_name,
  database_user,
  created_at,
  updated_at
)
VALUES (
  'database-pyrosa-democrm-postgresql',
  'app-pyrosa-democrm',
  'primary',
  'secondary',
  'postgresql',
  'app_pyrosa_democrm',
  'app_pyrosa_democrm',
  NOW(),
  NOW()
)
ON CONFLICT (engine, database_name) DO UPDATE SET
  app_id = EXCLUDED.app_id,
  primary_node_id = EXCLUDED.primary_node_id,
  standby_node_id = EXCLUDED.standby_node_id,
  database_user = EXCLUDED.database_user,
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
VALUES (
  'backup-policy-pyrosa-democrm-files-daily',
  'tenant-pyrosa',
  'primary',
  'pyrosa-democrm-files-daily',
  '59 1 * * *',
  14,
  '/srv/backups/apps/pyrosa-democrm',
  '["app-files:pyrosa-democrm"]'::jsonb,
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
    config_json,
    '{uiAuth,clients}',
    CASE
      WHEN COALESCE(config_json #> '{uiAuth,clients}', '[]'::jsonb) ? 'crm'
        THEN COALESCE(config_json #> '{uiAuth,clients}', '[]'::jsonb)
      ELSE COALESCE(config_json #> '{uiAuth,clients}', '[]'::jsonb) || '["crm"]'::jsonb
    END,
    TRUE
  ),
  updated_at = NOW()
WHERE slug = 'pyrosa-iam';

INSERT INTO control_plane_iam_bindings (
  binding_id,
  provider_id,
  target_kind,
  target_slug,
  external_url,
  internal_url,
  auth_mode,
  mfa_policy,
  status,
  render_mode,
  provider_provisioning_status,
  allowed_groups,
  config_json,
  notes
)
SELECT
  'iam-binding-pyrosa-democrm',
  providers.provider_id,
  'app',
  'pyrosa-democrm',
  'https://democrm.pyrosa.com.do/',
  NULL,
  'ui_auth',
  'required',
  'active',
  'metadata_only',
  'manual_ready',
  '[]'::jsonb,
  '{
    "authHandledByApp": true,
    "uiAuth": {
      "clientSlug": "crm",
      "callbackUrl": "https://democrm.pyrosa.com.do/auth/callback",
      "issuer": "https://iam.pyrosa.com.do",
      "secretStorage": "PYROSA_CRM_IAM_CLIENT_SECRET in app runtime env"
    },
    "supportApps": ["pyrosa-platform", "pyrosa-iam", "pyrosa-accounts"]
  }'::jsonb,
  'Pyrosa DemoCRM delegates app-native ui-auth directly to Pyrosa IAM.'
FROM control_plane_iam_providers providers
WHERE providers.slug = 'pyrosa-iam'
ON CONFLICT (binding_id) DO UPDATE SET
  provider_id = EXCLUDED.provider_id,
  external_url = EXCLUDED.external_url,
  internal_url = EXCLUDED.internal_url,
  auth_mode = EXCLUDED.auth_mode,
  mfa_policy = EXCLUDED.mfa_policy,
  status = EXCLUDED.status,
  render_mode = EXCLUDED.render_mode,
  provider_provisioning_status = EXCLUDED.provider_provisioning_status,
  allowed_groups = EXCLUDED.allowed_groups,
  config_json = EXCLUDED.config_json,
  notes = EXCLUDED.notes,
  updated_at = NOW();
