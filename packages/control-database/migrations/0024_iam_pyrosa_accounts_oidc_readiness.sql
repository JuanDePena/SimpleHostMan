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
          "status": "future",
          "notes": "Future only; Accounts must ship OIDC discovery, JWKS, signed ID tokens, nonce handling, stable claims and userinfo before SimpleHostMan can select it.",
          "requiredFeatures": [
            "openid-configuration",
            "jwks",
            "signed_id_tokens",
            "nonce",
            "stable_claims",
            "userinfo"
          ],
          "promotionGate": "accounts_oidc_release"
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
           "oidcReadiness": {
             "status": "future",
             "advertiseAsProvider": false,
             "promotionGate": "accounts_oidc_release",
             "requiredFeatures": [
               "openid-configuration",
               "jwks",
               "signed_id_tokens",
               "nonce",
               "stable_claims",
               "userinfo"
             ],
             "notes": "Do not mark Pyrosa Accounts OIDC available until these runtime features ship and a real OIDC app pilot validates them."
           }
         }'::jsonb,
         '{capabilityStatus}',
         capability_status.items,
         true
       ),
       updated_at = NOW()
  FROM capability_status
 WHERE provider.provider_id = capability_status.provider_id;
