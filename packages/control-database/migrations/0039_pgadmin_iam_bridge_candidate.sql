UPDATE control_plane_iam_bindings
SET provider_provisioning_status = 'pending',
    config_json = jsonb_set(
      jsonb_set(
        jsonb_set(
          config_json,
          '{gatewayProxy}',
          COALESCE(config_json->'gatewayProxy', '{}'::jsonb) || '{
            "bridgeMode": "local_outpost",
            "bridgeListenUrl": "http://127.0.0.1:10144",
            "loginUrl": "https://iam.pyrosa.com.do/oauth/gateway/start",
            "promotionState": "bridge_candidate"
          }'::jsonb,
          TRUE
        ),
        '{render}',
        COALESCE(config_json->'render', '{}'::jsonb) || '{
          "mode": "metadata_only",
          "enabled": false,
          "candidateVhost": "platform/httpd/vhosts/pyrosa-pgadmin-iam-bridge.conf.candidate",
          "bridgeService": "pyrosa-iam-pgadmin-gateway-bridge.service",
          "parityRequiredBeforeApply": true
        }'::jsonb,
        TRUE
      ),
      '{dryRun}',
      '{
        "createdAt": "2026-06-11T09:55:46Z",
        "path": "/etc/simplehost/rollback/pgadmin-iam-bridge-dry-run-20260611T095546Z",
        "currentVhostCopy": "pyrosa-pgadmin.conf.current",
        "candidateVhost": "pyrosa-pgadmin-iam-bridge.conf.candidate",
        "syntaxValidated": true,
        "trafficChanged": false
      }'::jsonb,
      TRUE
    ),
    notes = 'Pyrosa IAM gateway bridge candidate prepared for pgAdmin. The live vhost still proxies directly to pgAdmin; bridge service and candidate vhost require explicit activation in a rollback window.',
    updated_at = NOW()
WHERE binding_id = 'iam-binding-pyrosa-pgadmin-pyrosa-iam-gateway';
