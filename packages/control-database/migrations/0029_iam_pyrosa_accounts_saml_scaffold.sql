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
          "notes": "Pyrosa Accounts has a disabled SAML metadata scaffold, but SSO assertions, SP configuration and a pilot app are not implemented. Do not advertise SAML as operational.",
          "disabledReason": "saml_provider_disabled_until_sp_pilot",
          "promotionGate": "saml_sp_pilot"
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
             "providerMetadataScaffold": true,
             "metadataPath": "/saml/metadata",
             "enabledByDefault": false,
             "disabledReason": "saml_provider_disabled_until_sp_pilot",
             "promotionGate": "saml_sp_pilot",
             "missingFeatures": [
               "service_provider_registry",
               "authn_request_validation",
               "signed_saml_responses",
               "assertion_encryption_policy",
               "single_logout",
               "pilot_app"
             ],
             "notes": "SAML metadata can be generated only when explicitly enabled and configured in Accounts. SimpleHostMan keeps SAML disabled until a concrete SP pilot requires it."
           }
         }'::jsonb,
         '{capabilityStatus}',
         capability_status.items,
         true
       ),
       updated_at = NOW()
  FROM capability_status
 WHERE provider.provider_id = capability_status.provider_id;
