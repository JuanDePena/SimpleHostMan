UPDATE control_plane_iam_providers
SET status = 'candidate',
    capabilities = '["ui_auth", "oauth_login", "oidc", "gateway_proxy"]'::jsonb,
    config_json = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              config_json,
              '{uiAuth}',
              '{
                "status": "available",
                "ticketExchangePath": "/internal/ui-auth/exchange-ticket",
                "introspectionPath": "/internal/ui-auth/introspect-session",
                "clients": ["directory", "sync", "erp"],
                "decommissionedLegacyProvider": "pyrosa-accounts"
              }'::jsonb,
              TRUE
            ),
            '{oauthLogin,candidateStatus}',
            '"pilot_validated"'::jsonb,
            TRUE
          ),
          '{oidcReadiness,status}',
          '"pilot_validated"'::jsonb,
          TRUE
        ),
        '{gatewayProxyReadiness,status}',
        '"pilot_validated"'::jsonb,
        TRUE
      ),
      '{capabilityStatus}',
      '[
        {
          "key": "ui_auth",
          "status": "available",
          "notes": "Pyrosa IAM now owns app-native ui-auth for Directory, NewSync and DemoERP."
        },
        {
          "key": "oauth",
          "status": "pilot_validated",
          "notes": "Authorization Code + PKCE pilot validated for SimpleHostMan; Authentik remains the active outer administrative gate."
        },
        {
          "key": "oidc",
          "status": "pilot_validated",
          "notes": "OIDC discovery/JWKS/userinfo runtime is available for controlled pilots."
        },
        {
          "key": "gateway_proxy",
          "status": "pilot_validated",
          "notes": "Forward-auth gateway endpoint exists for controlled pilots; no Apache render is automatic."
        },
        {
          "key": "saml",
          "status": "disabled",
          "notes": "Not advertised as operational until a concrete SAML SP requirement appears."
        }
      ]'::jsonb,
      TRUE
    ),
    notes = 'Pyrosa IAM is the owner for authentication, MFA, OAuth/OIDC, gateway and app-native ui-auth. Pyrosa Accounts has been removed from IAM provider selection.',
    updated_at = NOW()
WHERE slug = 'pyrosa-iam';

DELETE FROM control_plane_iam_bindings
WHERE provider_id IN (
  SELECT provider_id
  FROM control_plane_iam_providers
  WHERE slug = 'pyrosa-accounts'
)
AND target_slug IN ('pyrosa-directory', 'pyrosa-newsync', 'pyrosa-demoerp');

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
  seed.binding_id,
  providers.provider_id,
  seed.target_kind,
  seed.target_slug,
  seed.external_url,
  seed.internal_url,
  seed.auth_mode,
  seed.mfa_policy,
  seed.status,
  seed.render_mode,
  seed.provider_provisioning_status,
  seed.allowed_groups,
  seed.config_json,
  seed.notes
FROM (
  VALUES
    (
      'iam-binding-pyrosa-directory',
      'pyrosa-iam',
      'app',
      'pyrosa-directory',
      'https://directory.pyrosa.com.do/',
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
          "clientSlug": "directory",
          "callbackUrl": "https://directory.pyrosa.com.do/auth/callback",
          "issuer": "https://iam.pyrosa.com.do",
          "secretStorage": "PYROSA_DIRECTORY_IAM_CLIENT_SECRET in app runtime env"
        }
      }'::jsonb,
      'Pyrosa Directory delegates app-native ui-auth directly to Pyrosa IAM.'
    ),
    (
      'iam-binding-pyrosa-newsync',
      'pyrosa-iam',
      'app',
      'pyrosa-newsync',
      'https://newsync.pyrosa.com.do/',
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
          "clientSlug": "sync",
          "callbackUrl": "https://newsync.pyrosa.com.do/auth/callback",
          "issuer": "https://iam.pyrosa.com.do",
          "secretStorage": "PYROSA_SYNC_UI_AUTH_CLIENT_SECRET in app runtime env"
        },
        "excludedLegacySurfaces": ["pyrosa-demosync", "pyrosa-sync"]
      }'::jsonb,
      'Pyrosa NewSync delegates app-native ui-auth directly to Pyrosa IAM. Legacy pyrosa-demosync and pyrosa-sync are intentionally untouched.'
    ),
    (
      'iam-binding-pyrosa-demoerp',
      'pyrosa-iam',
      'app',
      'pyrosa-demoerp',
      'https://demoerp.pyrosa.com.do/',
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
          "clientSlug": "erp",
          "callbackUrl": "https://demoerp.pyrosa.com.do/auth/callback",
          "issuer": "https://iam.pyrosa.com.do",
          "secretStorage": "PYROSA_ERP_IAM_CLIENT_SECRET in app runtime env"
        }
      }'::jsonb,
      'Pyrosa DemoERP delegates app-native ui-auth directly to Pyrosa IAM.'
    )
) AS seed(
  binding_id,
  provider_slug,
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
INNER JOIN control_plane_iam_providers providers
  ON providers.slug = seed.provider_slug
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

DELETE FROM control_plane_iam_bindings
WHERE provider_id IN (
  SELECT provider_id
  FROM control_plane_iam_providers
  WHERE slug = 'pyrosa-accounts'
);

DELETE FROM control_plane_iam_providers
WHERE slug = 'pyrosa-accounts';
