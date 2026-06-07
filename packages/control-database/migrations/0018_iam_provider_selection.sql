CREATE TABLE IF NOT EXISTS control_plane_iam_providers (
  provider_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('authentik', 'pyrosa_accounts')),
  status TEXT NOT NULL CHECK (status IN ('active', 'candidate', 'future', 'disabled')),
  base_url TEXT,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS control_plane_iam_bindings (
  binding_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES control_plane_iam_providers(provider_id) ON DELETE RESTRICT,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('control', 'app', 'host_service')),
  target_slug TEXT NOT NULL,
  external_url TEXT,
  internal_url TEXT,
  auth_mode TEXT NOT NULL CHECK (auth_mode IN ('proxy', 'trusted_proxy_headers', 'ui_auth', 'oidc', 'saml')),
  mfa_policy TEXT NOT NULL CHECK (mfa_policy IN ('provider_default', 'required', 'optional', 'none')),
  status TEXT NOT NULL CHECK (status IN ('active', 'candidate', 'future', 'disabled')),
  allowed_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (target_kind, target_slug)
);

CREATE INDEX IF NOT EXISTS control_plane_iam_bindings_provider_idx
  ON control_plane_iam_bindings (provider_id, status, target_kind);

ALTER TABLE control_plane_sessions
  ADD COLUMN IF NOT EXISTS auth_provider_slug TEXT,
  ADD COLUMN IF NOT EXISTS external_subject TEXT,
  ADD COLUMN IF NOT EXISTS mfa_satisfied BOOLEAN,
  ADD COLUMN IF NOT EXISTS assurance_level TEXT;

INSERT INTO control_plane_iam_providers (
  provider_id,
  slug,
  display_name,
  kind,
  status,
  base_url,
  capabilities,
  config_json,
  notes
)
VALUES
  (
    'iam-provider-authentik',
    'authentik',
    'Authentik',
    'authentik',
    'active',
    'https://auth.pyrosa.com.do',
    '["proxy", "trusted_proxy_headers", "oidc", "saml"]'::jsonb,
    '{
      "trustedProxy": {
        "emailHeader": "x-authentik-email",
        "usernameHeader": "x-authentik-username",
        "displayNameHeader": "x-authentik-name",
        "groupsHeader": "x-authentik-groups",
        "groupSeparator": ","
      },
      "signOutPath": "/outpost.goauthentik.io/sign_out"
    }'::jsonb,
    'Default IAM provider for administrative infrastructure surfaces.'
  ),
  (
    'iam-provider-pyrosa-accounts',
    'pyrosa-accounts',
    'Pyrosa Accounts',
    'pyrosa_accounts',
    'candidate',
    'https://accounts.pyrosa.com.do',
    '["ui_auth"]'::jsonb,
    '{
      "uiAuth": {
        "introspectionPath": "/internal/ui-auth/introspect-session",
        "ticketExchangePath": "/internal/ui-auth/exchange-ticket"
      }
    }'::jsonb,
    'Pyrosa-native provider candidate for apps that implement ui-auth. Proxy gateway, OIDC, and SAML remain future work.'
  )
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  kind = EXCLUDED.kind,
  status = EXCLUDED.status,
  base_url = EXCLUDED.base_url,
  capabilities = EXCLUDED.capabilities,
  config_json = EXCLUDED.config_json,
  notes = EXCLUDED.notes,
  updated_at = NOW();

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
  allowed_groups,
  config_json,
  notes
)
SELECT
  binding_id,
  provider_id,
  target_kind,
  target_slug,
  external_url,
  internal_url,
  auth_mode,
  mfa_policy,
  status,
  allowed_groups,
  config_json,
  notes
FROM (
  VALUES
    (
      'iam-binding-code-server',
      'authentik',
      'host_service',
      'code-server',
      'https://code.pyrosa.com.do/',
      'http://host.containers.internal:18080',
      'proxy',
      'required',
      'active',
      '["PYROSA Operators"]'::jsonb,
      '{"trafficManagedExternally": true}'::jsonb,
      'Existing Authentik proxy provider. Vhost rendering is intentionally unchanged in phases 1-4.'
    ),
    (
      'iam-binding-simplehost-control',
      'authentik',
      'control',
      'simplehost-control',
      'https://vps-prd.pyrosa.com.do:3200/',
      'http://host.containers.internal:13200',
      'trusted_proxy_headers',
      'required',
      'active',
      '["PYROSA Operators"]'::jsonb,
      '{"trafficManagedExternally": true}'::jsonb,
      'Existing Authentik trusted-proxy handoff into local SimpleHostMan sessions.'
    ),
    (
      'iam-binding-pgadmin',
      'authentik',
      'app',
      'pyrosa-pgadmin',
      'https://pgadmin.pyrosa.com.do/',
      NULL,
      'proxy',
      'required',
      'active',
      '["PYROSA Operators"]'::jsonb,
      '{"trafficManagedExternally": true}'::jsonb,
      'Selected Authentik provider for pgAdmin metadata; Apache rendering remains future work.'
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
  allowed_groups = EXCLUDED.allowed_groups,
  config_json = EXCLUDED.config_json,
  notes = EXCLUDED.notes,
  updated_at = NOW();
