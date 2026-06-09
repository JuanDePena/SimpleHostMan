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
        WHEN item->>'key' = 'gateway_proxy' THEN item || '{
          "status": "pilot_validated",
          "notes": "Pyrosa Accounts now ships an internal forward-auth gateway check endpoint. It remains candidate-only until an Apache/vhost pilot protects a non-critical surface and rollback is validated.",
          "promotionState": "candidate",
          "activeOuterGate": "authentik",
          "promotionGate": "apache_forward_auth_pilot"
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
   SET config_json = jsonb_set(
         provider.config_json || '{
           "gatewayProxyReadiness": {
             "status": "pilot_validated",
             "advertiseAsProvider": true,
             "promotionState": "candidate",
             "activeOuterGate": "authentik",
             "promotionGate": "apache_forward_auth_pilot",
             "endpoint": "/oauth/gateway/check",
             "trustBoundary": "internal_allowlist_only",
             "emittedHeaders": [
               "X-Pyrosa-Account-User-Id",
               "X-Pyrosa-Account-Email",
               "X-Pyrosa-Account-Username",
               "X-Pyrosa-Account-Role",
               "X-Pyrosa-Account-Groups",
               "X-Pyrosa-Account-Assurance-Level",
               "X-Pyrosa-Account-Mfa"
             ],
             "notes": "Gateway check is implemented but not wired to Apache or public traffic by SimpleHostMan."
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
  'iam-binding-simplehost-control-pyrosa-gateway',
  providers.provider_id,
  'control',
  'simplehost-control',
  'https://vps-prd.pyrosa.com.do:3200/',
  'http://host.containers.internal:13200',
  'proxy',
  'required',
  'candidate',
  'metadata_only',
  'manual_ready',
  '["PYROSA Operators"]'::jsonb,
  '{
    "trafficManagedExternally": true,
    "gatewayProxy": {
      "provider": "pyrosa-accounts",
      "checkUrl": "https://accounts.pyrosa.com.do/oauth/gateway/check",
      "internalCheckPath": "/oauth/gateway/check",
      "trustedBoundary": "internal_allowlist_only",
      "requiredAssuranceLevel": "aal2",
      "requiredGroups": ["PYROSA Operators"],
      "emittedHeaders": [
        "X-Pyrosa-Account-User-Id",
        "X-Pyrosa-Account-Email",
        "X-Pyrosa-Account-Username",
        "X-Pyrosa-Account-Role",
        "X-Pyrosa-Account-Groups",
        "X-Pyrosa-Account-Assurance-Level",
        "X-Pyrosa-Account-Mfa"
      ],
      "promotionState": "candidate",
      "activeOuterGate": "authentik"
    },
    "render": {
      "mode": "metadata_only",
      "enabled": false,
      "reason": "Gateway candidate only; no Apache forward-auth render or public traffic change."
    }
  }'::jsonb,
  'Candidate Pyrosa Accounts forward-auth gateway metadata for SimpleHostMan. Authentik remains active until explicit promotion.'
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
