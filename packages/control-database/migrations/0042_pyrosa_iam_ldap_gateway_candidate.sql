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
  'iam-binding-pyrosa-ldap-pyrosa-iam-gateway',
  providers.provider_id,
  'app',
  'pyrosa-ldap',
  'https://ldap.pyrosa.com.do/',
  'http://host.containers.internal:10142',
  'proxy',
  'required',
  'candidate',
  'metadata_only',
  'pending',
  '["PYROSA Operators"]'::jsonb,
  '{
    "trafficManagedExternally": true,
    "pilotSurface": true,
    "activeOuterGate": "direct_lam_login",
    "rollbackProvider": "direct_vhost",
    "gatewayProxy": {
      "provider": "pyrosa-iam",
      "checkUrl": "https://iam.pyrosa.com.do/oauth/gateway/check",
      "internalCheckPath": "/oauth/gateway/check",
      "upstreamUrl": "http://host.containers.internal:10142",
      "bridgeListenUrl": "http://127.0.0.1:10145",
      "requiredAssuranceLevel": "aal2",
      "requiredGroups": ["PYROSA Operators"],
      "emittedHeaders": [
        "X-Pyrosa-IAM-User-Id",
        "X-Pyrosa-IAM-Email",
        "X-Pyrosa-IAM-Username",
        "X-Pyrosa-IAM-Role",
        "X-Pyrosa-IAM-Groups",
        "X-Pyrosa-IAM-Assurance-Level",
        "X-Pyrosa-IAM-Mfa"
      ],
      "promotionState": "candidate"
    },
    "render": {
      "mode": "metadata_only",
      "enabled": false,
      "candidateVhost": "platform/httpd/vhosts/pyrosa-ldap-iam-bridge.conf.candidate",
      "liveVhost": "/etc/httpd/conf.d/pyrosa-ldap.conf",
      "bridgeService": "pyrosa-iam-ldap-gateway-bridge.service",
      "parityRequiredBeforeApply": true,
      "reason": "LDAP Account Manager is the next administrative IAM candidate; this migration records metadata only and does not render Apache or change public traffic."
    },
    "candidateEvidence": {
      "currentPublicRoot": "302 /lam/",
      "currentPublicLogin": "LAM login served by app runtime",
      "currentRuntime": "app-pyrosa-ldap.service active on 127.0.0.1:10142",
      "excludedPublicRepository": "repos.pyrosa.com.do remains public package repository traffic and is not an IAM gateway candidate."
    },
    "validationPlan": [
      "capture current LDAP Account Manager vhost and direct-login rollback",
      "build a dedicated LDAP gateway bridge candidate on loopback",
      "render candidate Apache vhost in dry-run only",
      "validate unauthenticated GET redirect and unsafe-method fail-closed behavior",
      "validate MFA-backed operator session reaches LAM without creating anonymous access",
      "confirm LAM internal login or webserver-auth behavior before any traffic change",
      "capture backup evidence after enforcement"
    ]
  }'::jsonb,
  'Candidate Pyrosa IAM gateway metadata for LDAP Account Manager. Current public traffic remains on the direct LAM vhost; no Apache or bridge runtime change is applied by this migration.'
FROM control_plane_iam_providers providers
WHERE providers.slug = 'pyrosa-iam'
ON CONFLICT (binding_id) DO UPDATE SET
  provider_id = EXCLUDED.provider_id,
  target_kind = EXCLUDED.target_kind,
  target_slug = EXCLUDED.target_slug,
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
