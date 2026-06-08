WITH updated_status AS (
  SELECT jsonb_agg(
    CASE
      WHEN item->>'key' = 'oauth' THEN jsonb_set(
        item,
        '{notes}',
        to_jsonb('Service-token resource-server pilot is validated; browser SSO remains future until Authorization Code and MFA/AAL are proven.'::text),
        true
      )
      ELSE item
    END
    ORDER BY ordinality
  ) AS capability_status
  FROM control_plane_iam_providers provider
  CROSS JOIN LATERAL jsonb_array_elements(provider.config_json->'capabilityStatus') WITH ORDINALITY AS capability(item, ordinality)
  WHERE provider.slug = 'pyrosa-accounts'
)
UPDATE control_plane_iam_providers provider
SET config_json = jsonb_set(provider.config_json, '{capabilityStatus}', updated_status.capability_status, true),
    updated_at = NOW()
FROM updated_status
WHERE provider.slug = 'pyrosa-accounts'
  AND updated_status.capability_status IS NOT NULL;
