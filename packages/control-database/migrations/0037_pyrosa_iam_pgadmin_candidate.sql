UPDATE control_plane_iam_providers
SET capabilities = '["ui_auth", "oauth_login", "oidc", "gateway_proxy"]'::jsonb,
    config_json = jsonb_set(
      jsonb_set(
        jsonb_set(
          config_json,
          '{releaseValidation}',
          '{
            "status": "release_validated_candidate",
            "releaseTag": "v2606.102227",
            "releaseUrl": "https://github.com/JuanDePena/pyrosa-iam/releases/tag/v2606.102227",
            "validatedAt": "2026-06-10T22:44:00Z",
            "sourceRepository": "/srv/containers/apps/pyrosa-iam/app",
            "service": "app-pyrosa-iam.service",
            "healthUrl": "http://127.0.0.1:10134/__pyrosa_iam_health",
            "publicIssuer": "https://iam.pyrosa.com.do",
            "checks": [
              "unit_tests",
              "client_api_namespace_tests",
              "namespace_guard",
              "typecheck",
              "production_build",
              "systemd_health",
              "public_oidc_discovery",
              "gateway_fail_closed",
              "simplehostman_loopback_oauth_login"
            ],
            "activeOuterGate": "authentik"
          }'::jsonb,
          TRUE
        ),
        '{oauthLogin,lastLoopbackValidation}',
        '{
          "validatedAt": "2026-06-10T22:44:00Z",
          "provider": "pyrosa-iam",
          "operator": "webmaster@pyrosa.com.do",
          "assuranceLevel": "aal2",
          "path": "SimpleHostMan loopback start -> IAM login -> MFA -> SimpleHostMan callback",
          "result": "shp_session issued and temporary OAuth cookie cleared",
          "activeOuterGate": "authentik"
        }'::jsonb,
        TRUE
      ),
      '{compatibilityRetirement}',
      '{
        "status": "planned",
        "canonicalEnvPrefix": "PYROSA_IAM",
        "canonicalHeaders": "X-Pyrosa-IAM-*",
        "legacyCookie": "PYROSA_ACCOUNTS_SESSION",
        "legacyHeaders": [
          "X-Pyrosa-Account-*",
          "X-Pyrosa-Accounts-*"
        ],
        "retireAfter": [
          "Directory, NewSync and DemoERP consume canonical IAM headers or app-native ui-auth only",
          "SimpleHostMan and pgAdmin pilots no longer rely on compatibility aliases",
          "one release keeps dual-read/write telemetry clean"
        ]
      }'::jsonb,
      TRUE
    ),
    notes = 'Release-validated Pyrosa IAM candidate at v2606.102227. SimpleHostMan loopback OAuth login validates end-to-end behind Authentik; pgAdmin is modeled as the next metadata-only gateway pilot.',
    updated_at = NOW()
WHERE slug = 'pyrosa-iam';

UPDATE control_plane_iam_bindings
SET provider_provisioning_status = 'manual_ready',
    config_json = jsonb_set(
      jsonb_set(
        config_json,
        '{releaseValidation}',
        '{
          "status": "loopback_login_validated",
          "releaseTag": "v2606.102227",
          "validatedAt": "2026-06-10T22:44:00Z",
          "activeOuterGate": "authentik",
          "promotionState": "candidate",
          "result": "shp_session issued and shp_oauth_login cleared"
        }'::jsonb,
        TRUE
      ),
      '{oauthLogin,promotionState}',
      '"candidate"'::jsonb,
      TRUE
    ),
    notes = 'Native OAuth login candidate for SimpleHostMan through Pyrosa IAM. Loopback browser-like login validated with MFA; Authentik remains the active external gate until explicit promotion.',
    updated_at = NOW()
WHERE binding_id = 'iam-binding-simplehost-control-pyrosa-iam-oauth';

UPDATE control_plane_iam_bindings
SET provider_provisioning_status = 'manual_ready',
    config_json = jsonb_set(
      config_json,
      '{releaseValidation}',
      '{
        "status": "release_validated_candidate",
        "releaseTag": "v2606.102227",
        "validatedAt": "2026-06-10T22:44:00Z",
        "publicDiscoveryValidated": true,
        "activeOuterGate": "authentik",
        "promotionState": "candidate"
      }'::jsonb,
      TRUE
    ),
    updated_at = NOW()
WHERE binding_id = 'iam-binding-simplehost-control-pyrosa-iam-oidc';

UPDATE control_plane_iam_bindings
SET provider_provisioning_status = 'manual_ready',
    config_json = jsonb_set(
      config_json,
      '{releaseValidation}',
      '{
        "status": "release_validated_candidate",
        "releaseTag": "v2606.102227",
        "validatedAt": "2026-06-10T22:44:00Z",
        "gatewayCheckFailClosed": true,
        "apacheForwardAuthPilotRequired": true,
        "activeOuterGate": "authentik",
        "promotionState": "candidate"
      }'::jsonb,
      TRUE
    ),
    updated_at = NOW()
WHERE binding_id = 'iam-binding-simplehost-control-pyrosa-iam-gateway';

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
  'iam-binding-pyrosa-pgadmin-pyrosa-iam-gateway',
  providers.provider_id,
  'app',
  'pyrosa-pgadmin',
  'https://pgadmin.pyrosa.com.do/',
  'http://host.containers.internal:10143',
  'proxy',
  'required',
  'candidate',
  'metadata_only',
  'pending',
  '["PYROSA Operators"]'::jsonb,
  '{
    "trafficManagedExternally": true,
    "pilotSurface": true,
    "activeOuterGate": "authentik",
    "rollbackProvider": "authentik",
    "gatewayProxy": {
      "provider": "pyrosa-iam",
      "checkUrl": "https://iam.pyrosa.com.do/oauth/gateway/check",
      "internalCheckPath": "/oauth/gateway/check",
      "upstreamUrl": "http://host.containers.internal:10143",
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
      "promotionState": "candidate"
    },
    "render": {
      "mode": "metadata_only",
      "enabled": false,
      "parityRequiredBeforeApply": true,
      "reason": "pgAdmin is the next administrative IAM pilot candidate; no Apache or traffic change is applied by this migration."
    },
    "validationPlan": [
      "capture current pgAdmin vhost and direct-login rollback",
      "render candidate forward-auth vhost in dry-run",
      "validate unauthenticated redirect and MFA-backed gateway allow",
      "validate pgAdmin login behavior behind SSO",
      "confirm local break-glass or rollback path",
      "capture backup evidence after enforcement"
    ]
  }'::jsonb,
  'Candidate Pyrosa IAM gateway metadata for pgAdmin. Authentik remains the active administrative rollback provider; Apache is not rendered by this migration.'
FROM control_plane_iam_providers providers
WHERE providers.slug = 'pyrosa-iam'
ON CONFLICT (binding_id) DO UPDATE SET
  provider_id = EXCLUDED.provider_id,
  target_kind = EXCLUDED.target_kind,
  target_slug = EXCLUDED.target_slug,
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
