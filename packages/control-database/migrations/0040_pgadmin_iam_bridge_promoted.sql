UPDATE control_plane_iam_bindings
SET status = 'candidate',
    provider_provisioning_status = 'pending',
    config_json = jsonb_set(
      COALESCE(config_json, '{}'::jsonb),
      '{supersededBy}',
      '{
        "bindingId": "iam-binding-pyrosa-pgadmin-pyrosa-iam-gateway",
        "provider": "pyrosa-iam",
        "authMode": "proxy",
        "changedAt": "2026-06-11T11:57:47Z",
        "reason": "pgAdmin public traffic was manually promoted to the Pyrosa IAM local gateway bridge."
      }'::jsonb,
      TRUE
    ),
    notes = 'Retained as metadata and rollback reference. Public pgAdmin traffic is currently enforced by the Pyrosa IAM local gateway bridge; Authentik is not the active pgAdmin vhost path.',
    updated_at = NOW()
WHERE binding_id = 'iam-binding-pgadmin';

UPDATE control_plane_iam_bindings
SET status = 'active',
    render_mode = 'metadata_only',
    provider_provisioning_status = 'manual_ready',
    config_json = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(config_json, '{}'::jsonb),
            '{gatewayProxy}',
            COALESCE(config_json->'gatewayProxy', '{}'::jsonb) || '{
              "bridgeMode": "local_outpost",
              "bridgeListenUrl": "http://127.0.0.1:10144",
              "loginUrl": "https://iam.pyrosa.com.do/oauth/gateway/start",
              "promotionState": "manual_active",
              "trafficChanged": true,
              "promotedAt": "2026-06-11T11:57:47Z",
              "publicVhost": "/etc/httpd/conf.d/pyrosa-pgadmin.conf",
              "rollbackPath": "/etc/simplehost/rollback/pgadmin-iam-promote-20260611T115746Z"
            }'::jsonb,
            TRUE
          ),
          '{render}',
          COALESCE(config_json->'render', '{}'::jsonb) || '{
            "mode": "metadata_only",
            "enabled": false,
            "manualPromotion": true,
            "bridgeService": "pyrosa-iam-pgadmin-gateway-bridge.service",
            "liveVhost": "/etc/httpd/conf.d/pyrosa-pgadmin.conf",
            "candidateVhost": "platform/httpd/vhosts/pyrosa-pgadmin-iam-bridge.conf.candidate"
          }'::jsonb,
          TRUE
        ),
        '{dryRun}',
        COALESCE(config_json->'dryRun', '{}'::jsonb) || '{
          "trafficChanged": true
        }'::jsonb,
        TRUE
      ),
      '{promotion}',
      '{
        "promotedAt": "2026-06-11T11:57:47Z",
        "rollbackPath": "/etc/simplehost/rollback/pgadmin-iam-promote-20260611T115746Z",
        "httpdSyntaxValidated": true,
        "publicUnauthenticatedGet": "302 gateway_login_required",
        "publicUnauthenticatedPost": "401 gateway_login_required",
        "publicAal2Get": "200 pgadmin_login",
        "temporarySessionsCleaned": true
      }'::jsonb,
      TRUE
    ),
    notes = 'Pyrosa IAM gateway bridge is manually active for pgAdmin. Public pgAdmin traffic now passes through the local bridge at 127.0.0.1:10144; rollback is the saved direct vhost under /etc/simplehost/rollback/pgadmin-iam-promote-20260611T115746Z.',
    updated_at = NOW()
WHERE binding_id = 'iam-binding-pyrosa-pgadmin-pyrosa-iam-gateway';
