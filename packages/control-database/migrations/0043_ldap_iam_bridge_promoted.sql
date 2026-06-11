UPDATE control_plane_iam_bindings
SET status = 'active',
    render_mode = 'apache_managed',
    provider_provisioning_status = 'manual_ready',
    config_json = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              COALESCE(config_json, '{}'::jsonb),
              '{gatewayProxy}',
              COALESCE(config_json->'gatewayProxy', '{}'::jsonb) || '{
                "bridgeMode": "local_outpost",
                "bridgeListenUrl": "http://127.0.0.1:10145",
                "loginUrl": "https://iam.pyrosa.com.do/oauth/gateway/start",
                "promotionState": "manual_active",
                "trafficChanged": true,
                "promotedAt": "2026-06-11T22:13:05.380Z",
                "publicVhost": "/etc/httpd/conf.d/pyrosa-ldap.conf",
                "rollbackPath": "/etc/simplehost/rollback/iam-apache-iam-binding-pyrosa-ldap-pyrosa-iam-gateway-2026-06-11T221305380Z",
                "iamAllowlistRuntimeBackup": "/etc/simplehost/rollback/pyrosa-iam-env-ldap-gateway-20260611T220938Z"
              }'::jsonb,
              TRUE
            ),
            '{render}',
            COALESCE(config_json->'render', '{}'::jsonb) || '{
              "mode": "apache_managed",
              "enabled": true,
              "manualPromotion": true,
              "bridgeService": "pyrosa-iam-ldap-gateway-bridge.service",
              "liveVhost": "/etc/httpd/conf.d/pyrosa-ldap.conf",
              "candidateVhost": "platform/httpd/vhosts/pyrosa-ldap-iam-bridge.conf.candidate",
              "spoolPath": "/var/lib/simplehost/iam-apache/pyrosa-ldap-pyrosa-iam-gateway.conf",
              "contentSha256": "543a3404e1a3cdbde5d54117481fb8a786fe332f878761928dd70d90e4022185",
              "renderedLineCount": 47
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
          "promotedAt": "2026-06-11T22:13:05.380Z",
          "rollbackPath": "/etc/simplehost/rollback/iam-apache-iam-binding-pyrosa-ldap-pyrosa-iam-gateway-2026-06-11T221305380Z",
          "backupPath": "/etc/simplehost/rollback/iam-apache-iam-binding-pyrosa-ldap-pyrosa-iam-gateway-2026-06-11T221305380Z/pyrosa-ldap.conf",
          "bridgeServiceActive": true,
          "httpdSyntaxValidated": true,
          "httpdReloaded": true,
          "publicUnauthenticatedGet": "302 gateway_login_required",
          "publicUnauthenticatedPost": "401 gateway_login_required",
          "iamGatewayCheck": "204 aal2 PYROSA Operators",
          "publicAal2Get": "200 lam_login",
          "lamAuthMode": "iam_gateway_then_lam_native_login",
          "trafficChanged": true
        }'::jsonb,
        TRUE
      ),
      '{lastApacheApply}',
      '{
        "appliedAt": "2026-06-11T22:13:05.380Z",
        "liveVhostPath": "/etc/httpd/conf.d/pyrosa-ldap.conf",
        "backupPath": "/etc/simplehost/rollback/iam-apache-iam-binding-pyrosa-ldap-pyrosa-iam-gateway-2026-06-11T221305380Z/pyrosa-ldap.conf",
        "rollbackDirectory": "/etc/simplehost/rollback/iam-apache-iam-binding-pyrosa-ldap-pyrosa-iam-gateway-2026-06-11T221305380Z",
        "sourcePath": "/var/lib/simplehost/iam-apache/pyrosa-ldap-pyrosa-iam-gateway.conf",
        "contentSha256": "543a3404e1a3cdbde5d54117481fb8a786fe332f878761928dd70d90e4022185",
        "renderedLineCount": 47,
        "httpdSyntaxValidated": true,
        "httpdReloaded": true
      }'::jsonb,
      TRUE
    ),
    notes = 'Pyrosa IAM gateway bridge is active for LDAP Account Manager. Public LDAP traffic now passes through the local bridge at 127.0.0.1:10145 before reaching the LAM native login; rollback is the saved direct vhost under /etc/simplehost/rollback/iam-apache-iam-binding-pyrosa-ldap-pyrosa-iam-gateway-2026-06-11T221305380Z.',
    updated_at = NOW()
WHERE binding_id = 'iam-binding-pyrosa-ldap-pyrosa-iam-gateway';
