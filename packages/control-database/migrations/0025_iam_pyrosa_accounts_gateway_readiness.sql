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
          "status": "future",
          "notes": "Future only; Accounts must ship a gateway or outpost that enforces HTTP access before upstream apps and emits trusted headers safely.",
          "requiredFeatures": [
            "forward_auth_or_outpost",
            "internal_trust_boundary",
            "upstream_header_mapping",
            "unsafe_method_tests",
            "logout",
            "pilot_app"
          ],
          "promotionGate": "accounts_gateway_proxy_release"
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
             "status": "future",
             "advertiseAsProvider": false,
             "promotionGate": "accounts_gateway_proxy_release",
             "requiredFeatures": [
               "forward_auth_or_outpost",
               "internal_trust_boundary",
               "upstream_header_mapping",
               "unsafe_method_tests",
               "logout",
               "pilot_app"
             ],
             "notes": "Do not mark Pyrosa Accounts gateway_proxy available until a real gateway/outpost protects an app before upstream access and passes rollback validation."
           }
         }'::jsonb,
         '{capabilityStatus}',
         capability_status.items,
         true
       ),
       updated_at = NOW()
  FROM capability_status
 WHERE provider.provider_id = capability_status.provider_id;
