UPDATE control_plane_iam_providers
SET status = 'candidate',
    capabilities = '["ui_auth", "oauth_login", "oidc", "gateway_proxy"]'::jsonb,
    config_json = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                config_json,
                '{releaseValidation}',
                '{
                  "status": "release_validated_candidate",
                  "releaseTag": "v2606.101205",
                  "releaseUrl": "https://github.com/JuanDePena/pyrosa-iam/releases/tag/v2606.101205",
                  "validatedAt": "2026-06-10T12:08:16Z",
                  "sourceRepository": "/srv/containers/apps/pyrosa-iam/app",
                  "service": "app-pyrosa-iam.service",
                  "healthUrl": "http://127.0.0.1:10134/__pyrosa_iam_health",
                  "publicIssuer": "https://iam.pyrosa.com.do",
                  "checks": [
                    "typecheck",
                    "unit_tests",
                    "production_build",
                    "systemd_health",
                    "public_oidc_discovery",
                    "gateway_fail_closed",
                    "login_cookie_compatibility"
                  ],
                  "activeOuterGate": "authentik"
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
        '{accountCenterBoundary}',
        '{
          "slug": "pyrosa-accounts",
          "purpose": "user_account_center",
          "iamProvider": false,
          "authenticationDelegatesTo": "pyrosa-iam"
        }'::jsonb,
        TRUE
      ),
      '{capabilityStatus}',
      '[
        {
          "key": "ui_auth",
          "status": "available",
          "notes": "Pyrosa IAM owns app-native ui-auth for Directory, NewSync and DemoERP. Pyrosa Accounts remains Account Center only."
        },
        {
          "key": "oauth",
          "status": "pilot_validated",
          "notes": "Authorization Code + PKCE and the v2606.101205 runtime release are validated for SimpleHostMan candidate login. Authentik remains the active outer gate."
        },
        {
          "key": "oidc",
          "status": "pilot_validated",
          "notes": "OIDC discovery and JWKS are public on iam.pyrosa.com.do for controlled pilots; no SimpleHostMan OIDC cutover is active."
        },
        {
          "key": "gateway_proxy",
          "status": "pilot_validated",
          "notes": "Forward-auth check exists and fails closed; Apache forward-auth rendering remains a future pilot before promotion."
        },
        {
          "key": "saml",
          "status": "disabled",
          "notes": "Not advertised as operational until a concrete SAML SP requirement appears."
        }
      ]'::jsonb,
      TRUE
    ),
    notes = 'Release-validated Pyrosa IAM candidate for OAuth/OIDC/gateway pilots. Authentik remains the active administrative outer gate; Pyrosa Accounts is Account Center only.',
    updated_at = NOW()
WHERE slug = 'pyrosa-iam';

UPDATE control_plane_iam_bindings
SET provider_provisioning_status = 'manual_ready',
    config_json = jsonb_set(
      jsonb_set(
        config_json,
        '{releaseValidation}',
        '{
          "status": "release_validated_candidate",
          "releaseTag": "v2606.101205",
          "validatedAt": "2026-06-10T12:08:16Z",
          "activeOuterGate": "authentik",
          "promotionState": "candidate"
        }'::jsonb,
        TRUE
      ),
      '{oauthLogin,promotionState}',
      '"candidate"'::jsonb,
      TRUE
    ),
    notes = 'Release-validated native OAuth login candidate for SimpleHostMan through Pyrosa IAM. Authentik remains the active external gate until explicit promotion.',
    updated_at = NOW()
WHERE binding_id = 'iam-binding-simplehost-control-pyrosa-iam-oauth';

UPDATE control_plane_iam_bindings
SET provider_provisioning_status = 'manual_ready',
    config_json = jsonb_set(
      jsonb_set(
        config_json,
        '{releaseValidation}',
        '{
          "status": "pilot_validated",
          "releaseTag": "v2606.101205",
          "validatedAt": "2026-06-10T12:08:16Z",
          "publicDiscoveryValidated": true,
          "activeOuterGate": "authentik",
          "promotionState": "candidate"
        }'::jsonb,
        TRUE
      ),
      '{oidc,promotionState}',
      '"candidate"'::jsonb,
      TRUE
    ),
    notes = 'Candidate OIDC metadata for SimpleHostMan through Pyrosa IAM. Discovery/JWKS are validated, but no OIDC cutover is active.',
    updated_at = NOW()
WHERE binding_id = 'iam-binding-simplehost-control-pyrosa-iam-oidc';

UPDATE control_plane_iam_bindings
SET provider_provisioning_status = 'manual_ready',
    config_json = jsonb_set(
      jsonb_set(
        config_json,
        '{releaseValidation}',
        '{
          "status": "pilot_validated",
          "releaseTag": "v2606.101205",
          "validatedAt": "2026-06-10T12:08:16Z",
          "gatewayCheckFailClosed": true,
          "apacheForwardAuthPilotRequired": true,
          "activeOuterGate": "authentik",
          "promotionState": "candidate"
        }'::jsonb,
        TRUE
      ),
      '{gatewayProxy,promotionState}',
      '"candidate"'::jsonb,
      TRUE
    ),
    notes = 'Candidate Pyrosa IAM forward-auth gateway metadata for SimpleHostMan. Runtime check is validated fail-closed; Apache forward-auth pilot is still required before promotion.',
    updated_at = NOW()
WHERE binding_id = 'iam-binding-simplehost-control-pyrosa-iam-gateway';
