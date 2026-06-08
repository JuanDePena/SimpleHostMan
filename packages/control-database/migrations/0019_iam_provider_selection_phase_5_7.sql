ALTER TABLE control_plane_iam_bindings
  ADD COLUMN IF NOT EXISTS render_mode TEXT NOT NULL DEFAULT 'metadata_only';

ALTER TABLE control_plane_iam_bindings
  ADD COLUMN IF NOT EXISTS provider_provisioning_status TEXT NOT NULL DEFAULT 'unknown';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'control_plane_iam_bindings_render_mode_check'
  ) THEN
    ALTER TABLE control_plane_iam_bindings
      ADD CONSTRAINT control_plane_iam_bindings_render_mode_check
      CHECK (render_mode IN ('metadata_only', 'apache_managed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'control_plane_iam_bindings_provider_provisioning_status_check'
  ) THEN
    ALTER TABLE control_plane_iam_bindings
      ADD CONSTRAINT control_plane_iam_bindings_provider_provisioning_status_check
      CHECK (
        provider_provisioning_status IN (
          'unknown',
          'not_required',
          'manual_ready',
          'pending',
          'future'
        )
      );
  END IF;
END $$;

UPDATE control_plane_iam_providers
SET config_json = jsonb_set(
      config_json,
      '{capabilityStatus}',
      '[
        {
          "key": "proxy",
          "status": "available",
          "notes": "Authentik proxy/outpost is the active path for administrative browser surfaces."
        },
        {
          "key": "trusted_proxy_headers",
          "status": "available",
          "notes": "SimpleHostMan accepts the current Authentik trusted proxy headers from loopback only."
        },
        {
          "key": "oidc",
          "status": "available",
          "notes": "Available in Authentik for applications that need an OIDC integration."
        },
        {
          "key": "saml",
          "status": "available",
          "notes": "Available in Authentik for applications that need a SAML integration."
        }
      ]'::jsonb,
      true
    ),
    updated_at = NOW()
WHERE slug = 'authentik';

UPDATE control_plane_iam_providers
SET config_json = jsonb_set(
      jsonb_set(
        config_json,
        '{uiAuth}',
        '{
          "authorizePath": "/ui-auth/authorize",
          "introspectionPath": "/internal/ui-auth/introspect-session",
          "ticketExchangePath": "/internal/ui-auth/exchange-ticket",
          "revokePath": "/internal/ui-auth/revoke-session",
          "secretStorage": "app-owned runtime env"
        }'::jsonb,
        true
      ),
      '{capabilityStatus}',
      '[
        {
          "key": "ui_auth",
          "status": "available",
          "notes": "Available for Pyrosa-native apps that already delegate browser login to Accounts."
        },
        {
          "key": "oauth",
          "status": "future",
          "notes": "Service-token resource-server pilot is validated; browser SSO remains future until Authorization Code and MFA/AAL are proven."
        },
        {
          "key": "oidc",
          "status": "future",
          "notes": "Design track only; Pyrosa Accounts must implement discovery, clients and tokens first."
        },
        {
          "key": "gateway_proxy",
          "status": "future",
          "notes": "Scaffold is intentionally disabled until a real gateway/outpost exists."
        },
        {
          "key": "saml",
          "status": "disabled",
          "notes": "Not advertised as a Pyrosa Accounts capability unless a concrete requirement appears."
        }
      ]'::jsonb,
      true
    ),
    updated_at = NOW()
WHERE slug = 'pyrosa-accounts';

UPDATE control_plane_iam_bindings
SET render_mode = 'metadata_only',
    provider_provisioning_status = CASE target_slug
      WHEN 'code-server' THEN 'manual_ready'
      WHEN 'simplehost-control' THEN 'manual_ready'
      WHEN 'pyrosa-pgadmin' THEN 'pending'
      ELSE provider_provisioning_status
    END,
    config_json = config_json || '{
      "render": {
        "mode": "metadata_only",
        "enabled": false,
        "parityRequiredBeforeApply": true
      }
    }'::jsonb,
    updated_at = NOW()
WHERE target_slug IN ('code-server', 'simplehost-control', 'pyrosa-pgadmin');

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
      'pyrosa-accounts',
      'app',
      'pyrosa-directory',
      'https://directory.pyrosa.com.do/',
      NULL,
      'ui_auth',
      'required',
      'active',
      'metadata_only',
      'not_required',
      '[]'::jsonb,
      '{
        "authHandledByApp": true,
        "render": {
          "mode": "metadata_only",
          "enabled": false,
          "reason": "ui-auth is handled inside the app, not by Apache reverse proxy."
        },
        "uiAuth": {
          "clientSlug": "directory",
          "accountsBaseUrl": "https://accounts.pyrosa.com.do",
          "authorizePath": "/ui-auth/authorize",
          "ticketExchangePath": "/internal/ui-auth/exchange-ticket",
          "introspectionPath": "/internal/ui-auth/introspect-session",
          "callbackUrl": "https://directory.pyrosa.com.do/auth/callback",
          "secretStorage": "PYROSA_DIRECTORY_ACCOUNTS_CLIENT_SECRET in app runtime env"
        }
      }'::jsonb,
      'Existing Pyrosa Accounts ui-auth integration. SimpleHostMan only models the binding metadata.'
    ),
    (
      'iam-binding-pyrosa-newsync',
      'pyrosa-accounts',
      'app',
      'pyrosa-newsync',
      'https://newsync.pyrosa.com.do/',
      NULL,
      'ui_auth',
      'required',
      'active',
      'metadata_only',
      'not_required',
      '[]'::jsonb,
      '{
        "authHandledByApp": true,
        "inventoryBoundary": "Allowed even if pyrosa-newsync remains outside full PostgreSQL app inventory.",
        "render": {
          "mode": "metadata_only",
          "enabled": false,
          "reason": "ui-auth is handled inside the app, not by Apache reverse proxy."
        },
        "uiAuth": {
          "clientSlug": "sync",
          "accountsBaseUrl": "https://accounts.pyrosa.com.do",
          "internalAccountsBaseUrl": "http://127.0.0.1:10124",
          "authorizePath": "/ui-auth/authorize",
          "ticketExchangePath": "/internal/ui-auth/exchange-ticket",
          "introspectionPath": "/internal/ui-auth/introspect-session",
          "callbackUrl": "https://newsync.pyrosa.com.do/auth/callback",
          "secretStorage": "PYROSA_SYNC_UI_AUTH_CLIENT_SECRET in app runtime env"
        }
      }'::jsonb,
      'Existing Pyrosa Accounts ui-auth integration; app inventory remains an explicit operational boundary.'
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
ON CONFLICT (target_kind, target_slug) DO UPDATE SET
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
