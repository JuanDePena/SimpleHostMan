# SimpleHost TODO

Updated on `2026-06-11`.

This file tracks only work that is still open. Closed implementation evidence
belongs in the feature runbook that owns the behavior, not in this tracker.

## Baseline

- canonical source tree: `/opt/simplehostman/src`
- canonical runtime root: `/opt/simplehostman/release`
- active control-plane release: `2606.11.14`
- implemented IAM/SSO state:
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)
- implemented operational inspection and hardening evidence:
  [`OPERATIONAL_INSPECTION_20260501.md`](/opt/simplehostman/src/docs/OPERATIONAL_INSPECTION_20260501.md)
- implemented mail platform behavior:
  [`MAIL.md`](/opt/simplehostman/src/docs/MAIL.md)

## Open Items

### 1. Promote IAM Apache Apply Path From Metadata

Current state:

- IAM provider and binding metadata lives in PostgreSQL.
- Bindings are intentionally `metadata_only` unless explicitly promoted to
  `apache_managed`.
- The IAM UI exposes provider capability status, render mode, MFA policy, and
  provisioning posture.
- The pgAdmin bridge is active by controlled manual promotion, with rollback
  saved under `/etc/simplehost/rollback/pgadmin-iam-promote-20260611T115746Z`.
- `apps/control/src/iam-apache-renderer.ts` can render the Pyrosa IAM
  gateway-proxy Apache vhost from IAM binding metadata.
- The renderer test compares the generated pgAdmin vhost with
  `platform/httpd/vhosts/pyrosa-pgadmin-iam-bridge.conf.candidate` after
  comment/blank-line normalization.
- The generated candidate, committed candidate artifact and live
  `/etc/httpd/conf.d/pyrosa-pgadmin.conf` match after normalization, and
  `httpd -t` returned `Syntax OK`.

Pending work:

- implement the guarded apply/dispatch path that writes Apache vhosts from
  PostgreSQL metadata only when a binding is explicitly `apache_managed`
- record rendered output checksums and rollback paths in binding metadata
- decide whether the active pgAdmin bridge should become the first
  `apache_managed` binding, or remain manual until another low-risk binding is
  available

### 2. Decide SimpleHostMan Public Pyrosa IAM Promotion

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
- Release `2606.11.14` is active from `/opt/simplehostman/release/current`.
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
- The pgAdmin bridge is the first manual Apache enforcement pilot for
  `gateway_proxy`; burn-in, webserver-auth handoff, root-config backup and
  renderer parity are complete.
- SAML remains disabled by decision. SSO assertions, SP registry and a pilot
  app are still required before any SAML capability can be promoted.
- Authentik remains the provider for generic reverse-proxy enforcement.

Pending work:

- decide whether SimpleHostMan should consume OIDC directly, OAuth
  introspection directly, or both before any promotion from Authentik
- decide whether the pgAdmin evidence is enough to mark `gateway_proxy`
  available for selected administrative apps
- keep SAML disabled unless a concrete SP pilot requirement appears

## Deferred Unless Explicitly Requested

- Automatic IAM failover. Keep manual promotion until a controlled secondary
  promotion test proves the data and file behavior.
- SSH changes. SSH remains outside Authentik/IAM scope.
- Capacity upgrades and broad database retuning. Current inspection guidance
  does not recommend an urgent VPS size change.
