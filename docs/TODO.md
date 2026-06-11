# SimpleHost TODO

Updated on `2026-06-11`.

This file tracks only work that is still open. Closed implementation evidence
belongs in the feature runbook that owns the behavior, not in this tracker.

## Baseline

- canonical source tree: `/opt/simplehostman/src`
- canonical runtime root: `/opt/simplehostman/release`
- active control-plane release: `2606.11.21`
- implemented IAM/SSO state:
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)
- implemented operational inspection and hardening evidence:
  [`OPERATIONAL_INSPECTION_20260501.md`](/opt/simplehostman/src/docs/OPERATIONAL_INSPECTION_20260501.md)
- implemented mail platform behavior:
  [`MAIL.md`](/opt/simplehostman/src/docs/MAIL.md)

## Open Items

### 1. Decide SimpleHostMan Public Pyrosa IAM Promotion

Current state:

- `pyrosa-iam/oauth_login` is the selected native SimpleHostMan login policy in
  metadata, using `native_oauth_login_under_authentik_outer_gate`.
- Authentik remains the active public outer gate and rollback provider for
  `https://vps-prd.pyrosa.com.do:3200/`.
- Public SimpleHostMan still redirects unauthenticated clients to the
  Authentik outpost.
- Pyrosa IAM OAuth login is validated behind that outer gate: MFA, callback,
  local active-operator enforcement, `shp_session` creation, logout and token
  revocation all have audit evidence.
- Pyrosa IAM source release `v2606.112122` is published and deployed with
  Account Center/IAM documentation alignment, pgAdmin gateway-pilot state
  recorded, namespace guard passing and runtime health validated.
- Release `2606.11.21` is active from `/opt/simplehostman/release/current`.
- The post-release Pyrosa IAM root-config backup succeeded from
  `release/current` as
  `backup-run-d4b78600-6160-44bb-9901-0d69517eb2a1` and replicated two
  artifacts to the secondary.

Pending work:

- run one final manual operator browser validation through the normal public
  Authentik-protected SimpleHostMan URL immediately before any user-facing
  entry-point change
- keep Authentik as rollback and as the active reverse-proxy provider until a
  separate explicit public cutover window is approved
- if promotion is approved, execute it as a separate change with live rollback
  verification and post-change burn-in logs

### 2. Expand Apache-Managed IAM Bindings Deliberately

Current state:

- IAM provider and binding metadata lives in PostgreSQL.
- Bindings remain `metadata_only` unless explicitly promoted to
  `apache_managed`.
- SimpleHostMan release `2606.11.18` includes the guarded Apache apply path:
  render from binding metadata, spool under `/var/lib/simplehost/iam-apache`,
  privileged root helper, `httpd -t`, Apache reload, rollback copy and
  `lastApacheApply` metadata.
- SimpleHostMan release `2606.11.21` exposes the latest
  `lastApacheApply` record in the IAM dashboard so operators can see apply
  time, live vhost, rollback path, backup file, checksum and rendered line
  count before expanding the pattern to another binding.
- `iam-binding-pyrosa-pgadmin-pyrosa-iam-gateway` is the first active
  `apache_managed` binding. Its successful apply wrote
  `/etc/httpd/conf.d/pyrosa-pgadmin.conf`, recorded checksum
  `fdc031ac2256b30689f338e7d6400eca4eece5b0c8bdce775f31b24048f37ec9`, and
  saved rollback under
  `/etc/simplehost/rollback/iam-apache-iam-binding-pyrosa-pgadmin-pyrosa-iam-gateway-2026-06-11T183729868Z`.
- `https://pgadmin.pyrosa.com.do/` returns the expected Pyrosa IAM gateway
  redirect and `pyrosa-iam` now marks `gateway_proxy` as `available`.
- `ldap.pyrosa.com.do` is recorded as the next Pyrosa IAM gateway candidate in
  metadata only. Its binding remains `candidate`/`metadata_only`/`pending`;
  no bridge, Apache render or traffic change has been applied.
- `repos.pyrosa.com.do` is explicitly excluded from gateway promotion because
  it is public package repository traffic.

Pending work:

- build and dry-run the LDAP Account Manager gateway bridge before promoting
  any additional binding to `apache_managed`
- keep each future apply scoped to one binding with an explicit rollback path
  and post-change smoke check

### 3. Complete Pyrosa IAM Provider Capability Decisions

Current state:

- Pyrosa IAM `oauth_login` is pilot validated for SimpleHostMan but not
  promoted as the only administrative login path.
- Pyrosa IAM OIDC discovery and JWKS are available publicly at
  `https://iam.pyrosa.com.do`.
- The SimpleHostMan pilot client validates Authorization Code + PKCE with a
  real MFA-backed identity.
- Pyrosa IAM `/oauth/gateway/check` has a forward-auth smoke: unauthenticated
  requests fail closed and authenticated AAL2 sessions return trusted headers.
- The pgAdmin bridge is the first Apache-managed enforcement pilot for
  `gateway_proxy`; burn-in, webserver-auth handoff, root-config backup,
  renderer parity and PostgreSQL-driven apply are complete.
- SAML remains disabled by decision. SSO assertions, SP registry and a pilot
  app are still required before any SAML capability can be promoted.
- Authentik remains the provider for generic reverse-proxy enforcement.

Pending work:

- decide whether SimpleHostMan should consume OIDC directly, OAuth
  introspection directly, or both before any promotion from Authentik
- keep LDAP Account Manager as the next `gateway_proxy` candidate, but only
  after a dedicated bridge runtime, dry-run vhost parity, unsafe-method
  fail-closed checks and LAM login/webserver-auth behavior are validated
- keep SAML disabled unless a concrete SP pilot requirement appears

## Deferred Unless Explicitly Requested

- Automatic IAM failover. Keep manual promotion until a controlled secondary
  promotion test proves the data and file behavior.
- SSH changes. SSH remains outside Authentik/IAM scope.
- Capacity upgrades and broad database retuning. Current inspection guidance
  does not recommend an urgent VPS size change.
