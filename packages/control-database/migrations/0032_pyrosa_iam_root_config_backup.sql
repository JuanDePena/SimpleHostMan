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
  'backup-policy-pyrosa-iam-root-config-daily',
  'tenant-pyrosa',
  'primary',
  'pyrosa-iam-root-config-daily',
  '5 2 * * *',
  14,
  '/srv/backups/iam/pyrosa-iam/root-config',
  '["iam:pyrosa-iam"]'::jsonb,
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
    '{runtime,controlPlaneResources,backupPolicies}',
    '[
      "pyrosa-iam-database-daily",
      "pyrosa-iam-files-daily",
      "pyrosa-iam-root-config-daily"
    ]'::jsonb,
    true
  ),
  updated_at = NOW()
WHERE slug = 'pyrosa-iam';
