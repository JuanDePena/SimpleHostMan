UPDATE control_plane_iam_providers
SET config_json = jsonb_set(
      jsonb_set(
        jsonb_set(
          config_json,
          '{oauthLogin,promotionPolicyStatus}',
          '"selected_native_login_policy"'::jsonb,
          TRUE
        ),
        '{promotionPolicy}',
        '{
          "selectedPolicy": "native_oauth_login_under_authentik_outer_gate",
          "selectedAt": "2026-06-11T09:05:00Z",
          "activeOuterGate": "authentik",
          "rollbackProvider": "authentik",
          "publicEntryPointChange": false,
          "bindingId": "iam-binding-simplehost-control-pyrosa-iam-oauth",
          "nextPilot": "pgadmin_gateway"
        }'::jsonb,
        TRUE
      ),
      '{compatibilityRetirement,status}',
      '"completed"'::jsonb,
      TRUE
    ),
    notes = 'Pyrosa IAM is the selected native OAuth login policy for SimpleHostMan metadata while Authentik remains the active public outer gate and rollback provider.',
    updated_at = NOW()
WHERE slug = 'pyrosa-iam';

UPDATE control_plane_iam_bindings
SET provider_provisioning_status = 'manual_ready',
    config_json = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            config_json,
            '{oauthLogin,promotionState}',
            '"selected_native_login_policy"'::jsonb,
            TRUE
          ),
          '{oauthLogin,promotionPolicy}',
          '"native_oauth_login_under_authentik_outer_gate"'::jsonb,
          TRUE
        ),
        '{promotionPolicy}',
        '{
          "selectedPolicy": "native_oauth_login_under_authentik_outer_gate",
          "selectedAt": "2026-06-11T09:05:00Z",
          "activeOuterGate": "authentik",
          "rollbackProvider": "authentik",
          "publicEntryPointChange": false,
          "applyScope": "metadata_and_inner_oauth_policy_only",
          "manualBrowserValidationRequiredBeforeCutover": true,
          "rollbackPath": "keep iam-binding-simplehost-control active with provider=authentik and auth_mode=trusted_proxy_headers",
          "nextPilot": "pgadmin_gateway"
        }'::jsonb,
        TRUE
      ),
      '{releaseValidation}',
      jsonb_build_object(
        'status', 'selected_native_login_policy',
        'releaseTag', 'v2606.110826',
        'validatedAt', '2026-06-11T09:05:00Z',
        'activeOuterGate', 'authentik',
        'rollbackProvider', 'authentik',
        'promotionState', 'selected_native_login_policy'
      ),
      TRUE
    ),
    notes = 'Selected native OAuth login policy for SimpleHostMan through Pyrosa IAM. Authentik remains the active public outer gate and rollback provider; no public vhost or traffic change is applied.',
    updated_at = NOW()
WHERE binding_id = 'iam-binding-simplehost-control-pyrosa-iam-oauth';
