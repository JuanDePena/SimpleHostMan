UPDATE control_plane_iam_providers
SET config_json = jsonb_set(
      jsonb_set(
        config_json,
        '{oauth}',
        '{
          "pilotStatus": "validated",
          "pilotValidatedAt": "2026-06-09T00:00:00Z",
          "validatedClientId": "simplehost-control-oauth-pilot",
          "validatedAudience": "simplehost-control",
          "validatedScopes": ["profile:read", "mfa:read"],
          "requiredPrincipalType": "human",
          "requiredAssuranceLevel": "aal2",
          "surfaceReadiness": "candidate_only"
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
          "notes": "Browser Authorization Code with PKCE and human MFA/AAL2 was validated for the SimpleHostMan pilot; keep candidate-only until promoted."
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
