DELETE FROM control_plane_apps
WHERE slug = 'pyrosa-accounts';

UPDATE control_plane_iam_providers
SET
  config_json = jsonb_set(
    jsonb_set(
      config_json,
      '{runtime,status}',
      '"public_active"'::jsonb,
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
        "pyrosa-iam-files-daily",
        "pyrosa-iam-root-config-daily"
      ],
      "traffic": "public",
      "reconciliation": "metadata_only",
      "replacesRetiredAppSlug": "pyrosa-accounts"
    }'::jsonb,
    true
  ),
  notes = 'Pyrosa IAM owns authentication, MFA, OAuth/OIDC, gateway and app-native ui-auth. Pyrosa Accounts has been decommissioned from IAM and app catalog metadata.',
  updated_at = NOW()
WHERE slug = 'pyrosa-iam';

UPDATE control_plane_iam_bindings
SET
  config_json = jsonb_set(
    config_json,
    '{oauthLogin,clientId}',
    '"client-simplehost-control-oauth-pilot"'::jsonb,
    true
  ),
  updated_at = NOW()
WHERE binding_id = 'iam-binding-simplehost-control-pyrosa-iam-oauth';
