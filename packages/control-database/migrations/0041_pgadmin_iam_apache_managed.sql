UPDATE control_plane_iam_bindings
SET render_mode = 'apache_managed',
    provider_provisioning_status = 'manual_ready',
    config_json = jsonb_set(
      COALESCE(config_json, '{}'::jsonb),
      '{render}',
      COALESCE(config_json->'render', '{}'::jsonb) || '{
        "mode": "apache_managed",
        "enabled": true,
        "managedBy": "simplehostman",
        "applyPath": "/v1/iam/bindings/iam-binding-pyrosa-pgadmin-pyrosa-iam-gateway/apache/apply",
        "liveVhost": "/etc/httpd/conf.d/pyrosa-pgadmin.conf",
        "candidateVhost": "platform/httpd/vhosts/pyrosa-pgadmin-iam-bridge.conf.candidate",
        "bridgeService": "pyrosa-iam-pgadmin-gateway-bridge.service",
        "parityRequiredBeforeApply": true,
        "rollbackRoot": "/etc/simplehost/rollback"
      }'::jsonb,
      TRUE
    ),
    notes = 'Pyrosa IAM gateway bridge is active for pgAdmin and is now eligible for SimpleHostMan Apache-managed apply with rollback metadata.',
    updated_at = NOW()
WHERE binding_id = 'iam-binding-pyrosa-pgadmin-pyrosa-iam-gateway'
  AND status = 'active'
  AND auth_mode = 'proxy';
