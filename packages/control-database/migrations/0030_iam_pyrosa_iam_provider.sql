ALTER TABLE control_plane_iam_providers
  DROP CONSTRAINT IF EXISTS control_plane_iam_providers_kind_check;

ALTER TABLE control_plane_iam_providers
  ADD CONSTRAINT control_plane_iam_providers_kind_check
  CHECK (kind IN ('authentik', 'pyrosa_accounts', 'pyrosa_iam'));

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
VALUES (
  'iam-provider-pyrosa-iam',
  'pyrosa-iam',
  'Pyrosa IAM',
  'pyrosa_iam',
  'candidate',
  'https://iam.pyrosa.com.do',
  '["oauth_login", "oidc"]'::jsonb,
  '{
    "runtime": {
      "status": "metadata_only",
      "domain": "iam.pyrosa.com.do",
      "envPrefix": "PYROSA_IAM",
      "database": "app_pyrosa_iam",
      "providerSlug": "pyrosa-iam",
      "sourceRepository": "/srv/containers/apps/pyrosa-iam/app",
      "activationRequires": [
        "runtime container",
        "database provisioning",
        "backup policy",
        "health check",
        "rollback plan"
      ]
    },
    "oauthLogin": {
      "candidateStatus": "future",
      "loginStartPath": "/auth/pyrosa-iam/start",
      "loginCallbackPath": "/auth/pyrosa-iam/callback",
      "requiredAudience": "simplehost-control",
      "requiredScopes": ["profile:read", "mfa:read"],
      "requiredPrincipalType": "human",
      "requiredAssuranceLevel": "aal2",
      "sessionIssuer": "https://iam.pyrosa.com.do",
      "promotionState": "candidate",
      "activeOuterGate": "authentik"
    },
    "oidcReadiness": {
      "status": "future",
      "advertiseAsProvider": true,
      "promotionState": "candidate",
      "activeOuterGate": "authentik",
      "promotionGate": "pyrosa_iam_oidc_runtime",
      "requiredFeatures": [
        "openid-configuration",
        "jwks",
        "signed_id_tokens",
        "nonce",
        "stable_claims",
        "userinfo",
        "logout"
      ]
    },
    "gatewayProxyReadiness": {
      "status": "future",
      "advertiseAsProvider": true,
      "promotionState": "candidate",
      "activeOuterGate": "authentik",
      "promotionGate": "pyrosa_iam_gateway_runtime",
      "endpoint": "/oauth/gateway/check",
      "trustBoundary": "internal_allowlist_only",
      "emittedHeaders": [
        "X-Pyrosa-IAM-User-Id",
        "X-Pyrosa-IAM-Email",
        "X-Pyrosa-IAM-Username",
        "X-Pyrosa-IAM-Role",
        "X-Pyrosa-IAM-Groups",
        "X-Pyrosa-IAM-Assurance-Level",
        "X-Pyrosa-IAM-Mfa"
      ]
    },
    "compatibility": {
      "legacyProvider": "pyrosa-accounts",
      "legacyHeaderCompatibility": true,
      "notes": "The cloned runtime can continue emitting legacy Pyrosa Accounts headers during migration, but new integrations should prefer X-Pyrosa-IAM-*."
    },
    "capabilityStatus": [
      {
        "key": "ui_auth",
        "status": "future",
        "notes": "Formal IAM runtime is not yet active. Existing app-native ui-auth remains served by Pyrosa Accounts during the split."
      },
      {
        "key": "oauth",
        "status": "future",
        "notes": "Target capability for SimpleHostMan after the Pyrosa IAM runtime is provisioned and validated."
      },
      {
        "key": "oidc",
        "status": "future",
        "notes": "Target capability for standard clients after discovery, JWKS, signed ID tokens, userinfo and logout are validated on iam.pyrosa.com.do."
      },
      {
        "key": "gateway_proxy",
        "status": "future",
        "notes": "Target replacement for Authentik-style reverse proxy protection only after a gateway pilot and rollback are validated."
      },
      {
        "key": "saml",
        "status": "disabled",
        "notes": "Not advertised as operational until a concrete SAML SP requirement appears."
      }
    ]
  }'::jsonb,
  'Formal IAM provider candidate split from Pyrosa Accounts. Metadata-only until the runtime, database, backups and rollback path are provisioned.'
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
      'iam-binding-simplehost-control-pyrosa-iam-oauth',
      'pyrosa-iam',
      'control',
      'simplehost-control',
      'https://vps-prd.pyrosa.com.do:3200/',
      'http://host.containers.internal:13200',
      'oauth_login',
      'required',
      'candidate',
      'metadata_only',
      'future',
      '["PYROSA Operators"]'::jsonb,
      '{
        "authHandledByControlPlane": true,
        "trafficManagedExternally": true,
        "oauthLogin": {
          "clientId": "simplehost-control-pyrosa-iam-oauth-pilot",
          "loginStartPath": "/auth/pyrosa-iam/start",
          "loginCallbackPath": "/auth/pyrosa-iam/callback",
          "requiredAudience": "simplehost-control",
          "requiredScopes": ["profile:read", "mfa:read"],
          "requiredPrincipalType": "human",
          "requiredAssuranceLevel": "aal2",
          "sessionIssuer": "https://iam.pyrosa.com.do",
          "revocation": "required_before_promotion",
          "externalLogout": "required_before_promotion",
          "promotionState": "candidate",
          "activeOuterGate": "authentik"
        },
        "render": {
          "mode": "metadata_only",
          "enabled": false,
          "reason": "Pyrosa IAM runtime is not active; no Apache or public traffic change."
        }
      }'::jsonb,
      'Candidate native OAuth login metadata for SimpleHostMan through Pyrosa IAM. Authentik remains the active external gate.'
    ),
    (
      'iam-binding-simplehost-control-pyrosa-iam-oidc',
      'pyrosa-iam',
      'control',
      'simplehost-control',
      'https://vps-prd.pyrosa.com.do:3200/',
      'http://host.containers.internal:13200',
      'oidc',
      'required',
      'candidate',
      'metadata_only',
      'future',
      '["PYROSA Operators"]'::jsonb,
      '{
        "trafficManagedExternally": true,
        "oidc": {
          "issuer": "https://iam.pyrosa.com.do",
          "discoveryUrl": "https://iam.pyrosa.com.do/.well-known/openid-configuration",
          "jwksUrl": "https://iam.pyrosa.com.do/.well-known/jwks.json",
          "userinfoUrl": "https://iam.pyrosa.com.do/oidc/userinfo",
          "clientId": "simplehost-control-pyrosa-iam-oidc-pilot",
          "requiredScopes": ["openid", "profile", "email", "groups", "mfa:read"],
          "requiredAcr": "aal2",
          "requiredGroups": ["PYROSA Operators"],
          "promotionState": "candidate",
          "activeOuterGate": "authentik"
        },
        "render": {
          "mode": "metadata_only",
          "enabled": false,
          "reason": "OIDC candidate only; Pyrosa IAM runtime and client pilot are not active."
        }
      }'::jsonb,
      'Candidate OIDC metadata for SimpleHostMan through Pyrosa IAM. Authentik remains active until an explicit promotion decision.'
    ),
    (
      'iam-binding-simplehost-control-pyrosa-iam-gateway',
      'pyrosa-iam',
      'control',
      'simplehost-control',
      'https://vps-prd.pyrosa.com.do:3200/',
      'http://host.containers.internal:13200',
      'proxy',
      'required',
      'candidate',
      'metadata_only',
      'future',
      '["PYROSA Operators"]'::jsonb,
      '{
        "trafficManagedExternally": true,
        "gatewayProxy": {
          "provider": "pyrosa-iam",
          "checkUrl": "https://iam.pyrosa.com.do/oauth/gateway/check",
          "internalCheckPath": "/oauth/gateway/check",
          "trustedBoundary": "internal_allowlist_only",
          "requiredAssuranceLevel": "aal2",
          "requiredGroups": ["PYROSA Operators"],
          "emittedHeaders": [
            "X-Pyrosa-IAM-User-Id",
            "X-Pyrosa-IAM-Email",
            "X-Pyrosa-IAM-Username",
            "X-Pyrosa-IAM-Role",
            "X-Pyrosa-IAM-Groups",
            "X-Pyrosa-IAM-Assurance-Level",
            "X-Pyrosa-IAM-Mfa"
          ],
          "legacyHeaderCompatibility": true,
          "promotionState": "candidate",
          "activeOuterGate": "authentik"
        },
        "render": {
          "mode": "metadata_only",
          "enabled": false,
          "reason": "Gateway candidate only; no Apache forward-auth render or public traffic change."
        }
      }'::jsonb,
      'Candidate Pyrosa IAM forward-auth gateway metadata for SimpleHostMan. Authentik remains active until explicit promotion.'
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
