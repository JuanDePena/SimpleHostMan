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
        WHEN item->>'key' = 'saml' THEN item || '{
          "status": "disabled",
          "notes": "Disabled by decision; Pyrosa Accounts must not be advertised as a SAML provider without a concrete requirement and full protocol implementation.",
          "disabledReason": "no_concrete_saml_requirement",
          "promotionGate": "concrete_saml_requirement"
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
           "samlDecision": {
             "status": "disabled",
             "advertiseAsProvider": false,
             "disabledReason": "no_concrete_saml_requirement",
             "promotionGate": "concrete_saml_requirement",
             "notes": "Do not model Pyrosa Accounts as a SAML provider until a real application requirement asks for it and Accounts implements SAML metadata, signing, SSO and ACS handling."
           }
         }'::jsonb,
         '{capabilityStatus}',
         capability_status.items,
         true
       ),
       updated_at = NOW()
  FROM capability_status
 WHERE provider.provider_id = capability_status.provider_id;
