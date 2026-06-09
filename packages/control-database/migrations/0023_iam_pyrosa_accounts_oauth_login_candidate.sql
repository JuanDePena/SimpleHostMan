ALTER TABLE control_plane_iam_bindings
  DROP CONSTRAINT IF EXISTS control_plane_iam_bindings_auth_mode_check;

ALTER TABLE control_plane_iam_bindings
  ADD CONSTRAINT control_plane_iam_bindings_auth_mode_check
  CHECK (auth_mode IN (
    'proxy',
    'trusted_proxy_headers',
    'ui_auth',
    'oauth_login',
    'oidc',
    'saml'
  ));

ALTER TABLE control_plane_iam_bindings
  DROP CONSTRAINT IF EXISTS control_plane_iam_bindings_target_kind_target_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS control_plane_iam_bindings_target_provider_mode_idx
  ON control_plane_iam_bindings (target_kind, target_slug, provider_id, auth_mode);

CREATE UNIQUE INDEX IF NOT EXISTS control_plane_iam_bindings_active_target_idx
  ON control_plane_iam_bindings (target_kind, target_slug)
  WHERE status = 'active';

UPDATE control_plane_iam_providers
SET capabilities = '["ui_auth", "oauth_login"]'::jsonb,
    config_json = jsonb_set(
      jsonb_set(
        config_json,
        '{oauthLogin}',
        '{
          "candidateStatus": "pilot_validated",
          "loginStartPath": "/auth/pyrosa-accounts/start",
          "loginCallbackPath": "/auth/pyrosa-accounts/callback",
          "requiredAudience": "simplehost-control",
          "requiredScopes": ["profile:read", "mfa:read"],
          "requiredPrincipalType": "human",
          "requiredAssuranceLevel": "aal2",
          "sessionIssuer": "https://accounts.pyrosa.com.do",
          "promotionState": "candidate",
          "activeOuterGate": "authentik"
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
          "status": "pilot_validated",
          "notes": "Native SimpleHostMan OAuth login is implemented as a candidate path and remains layered behind Authentik until promotion."
        },
        {
          "key": "oidc",
          "status": "future",
          "notes": "Future only; Pyrosa Accounts still needs OIDC discovery, JWKS, signed ID tokens, nonce handling, stable claims and userinfo."
        },
        {
          "key": "gateway_proxy",
          "status": "future",
          "notes": "Future only; no gateway/outpost replacement for Authentik exists yet."
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
  'iam-binding-simplehost-control-pyrosa-oauth',
  providers.provider_id,
  'control',
  'simplehost-control',
  'https://vps-prd.pyrosa.com.do:3200/',
  'http://host.containers.internal:13200',
  'oauth_login',
  'required',
  'candidate',
  'metadata_only',
  'manual_ready',
  '["PYROSA Operators"]'::jsonb,
  '{
    "authHandledByControlPlane": true,
    "trafficManagedExternally": true,
    "oauthLogin": {
      "clientId": "simplehost-control-oauth-pilot",
      "loginStartPath": "/auth/pyrosa-accounts/start",
      "loginCallbackPath": "/auth/pyrosa-accounts/callback",
      "requiredAudience": "simplehost-control",
      "requiredScopes": ["profile:read", "mfa:read"],
      "requiredPrincipalType": "human",
      "requiredAssuranceLevel": "aal2",
      "sessionIssuer": "https://accounts.pyrosa.com.do",
      "revocation": "enabled",
      "externalLogout": "enabled",
      "promotionState": "candidate",
      "activeOuterGate": "authentik"
    },
    "render": {
      "mode": "metadata_only",
      "enabled": false,
      "reason": "OAuth login candidate only; no Apache or vhost traffic change."
    }
  }'::jsonb,
  'Candidate native OAuth login for SimpleHostMan. Authentik remains the active external gate until promotion.'
FROM control_plane_iam_providers providers
WHERE providers.slug = 'pyrosa-accounts'
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
