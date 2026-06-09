WITH pyrosa_provider AS (
  SELECT provider_id, config_json
    FROM control_plane_iam_providers
   WHERE slug = 'pyrosa-accounts'
),
capability_status AS (
  SELECT
    provider_id,
    jsonb_agg(
      CASE
        WHEN item->>'key' = 'oidc' THEN item || '{
          "status": "pilot_validated",
          "notes": "Pyrosa Accounts now ships OIDC discovery, JWKS, signed ID tokens, nonce handling, stable claims and userinfo. SimpleHostMan keeps it candidate-only until an operational OIDC client pilot is deployed and validated.",
          "promotionState": "candidate",
          "activeOuterGate": "authentik",
          "promotionGate": "simplehost_oidc_login_pilot"
        }'::jsonb
        ELSE item
      END
      ORDER BY ordinality
    ) AS items
  FROM pyrosa_provider
  CROSS JOIN LATERAL jsonb_array_elements(config_json->'capabilityStatus') WITH ORDINALITY AS capability(item, ordinality)
  GROUP BY provider_id
)
UPDATE control_plane_iam_providers provider
   SET capabilities = '["ui_auth", "oauth_login", "oidc"]'::jsonb,
       config_json = jsonb_set(
         provider.config_json || '{
           "oidcReadiness": {
             "status": "pilot_validated",
             "advertiseAsProvider": true,
             "promotionState": "candidate",
             "activeOuterGate": "authentik",
             "promotionGate": "simplehost_oidc_login_pilot",
             "implementedFeatures": [
               "openid-configuration",
               "jwks",
               "signed_id_tokens",
               "nonce",
               "stable_claims",
               "userinfo"
             ],
             "notes": "OIDC provider runtime is implemented in Pyrosa Accounts, but SimpleHostMan must keep Authentik active until a real OIDC client pilot validates login, logout and rollback."
           }
         }'::jsonb,
         '{capabilityStatus}',
         capability_status.items,
         true
       ),
       updated_at = NOW()
  FROM capability_status
 WHERE provider.provider_id = capability_status.provider_id;

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
  'iam-binding-simplehost-control-pyrosa-oidc',
  providers.provider_id,
  'control',
  'simplehost-control',
  'https://vps-prd.pyrosa.com.do:3200/',
  'http://host.containers.internal:13200',
  'oidc',
  'required',
  'candidate',
  'metadata_only',
  'pending',
  '["PYROSA Operators"]'::jsonb,
  '{
    "trafficManagedExternally": true,
    "oidc": {
      "issuer": "https://accounts.pyrosa.com.do",
      "discoveryUrl": "https://accounts.pyrosa.com.do/.well-known/openid-configuration",
      "jwksUrl": "https://accounts.pyrosa.com.do/.well-known/jwks.json",
      "userinfoUrl": "https://accounts.pyrosa.com.do/oidc/userinfo",
      "clientId": "simplehost-control-oidc-pilot",
      "requiredScopes": ["openid", "profile", "email", "groups", "mfa:read"],
      "requiredAcr": "aal2",
      "requiredGroups": ["PYROSA Operators"],
      "promotionState": "candidate",
      "activeOuterGate": "authentik"
    },
    "render": {
      "mode": "metadata_only",
      "enabled": false,
      "reason": "OIDC candidate only; no Apache, Authentik or public traffic change."
    }
  }'::jsonb,
  'Candidate OIDC login metadata for SimpleHostMan. Authentik remains active until an explicit promotion decision.'
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
