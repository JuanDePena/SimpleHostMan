# SimpleHost TODO

Updated on `2026-06-11`.

This file tracks only work that is still open. Closed implementation evidence
belongs in the feature runbook that owns the behavior, not in this tracker.

## Baseline

- canonical source tree: `/opt/simplehostman/src`
- canonical runtime root: `/opt/simplehostman/release`
- active control-plane release: `2606.11.11`
- implemented IAM/SSO state:
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)
- implemented operational inspection and hardening evidence:
  [`OPERATIONAL_INSPECTION_20260501.md`](/opt/simplehostman/src/docs/OPERATIONAL_INSPECTION_20260501.md)
- implemented mail platform behavior:
  [`MAIL.md`](/opt/simplehostman/src/docs/MAIL.md)

## Open Items

### 1. Finish pgAdmin IAM Bridge Burn-In

Current state:

- Public `pgadmin.pyrosa.com.do` traffic is manually enforced by the Pyrosa IAM
  local bridge on `127.0.0.1:10144`.
- The previous direct vhost rollback is saved under
  `/etc/simplehost/rollback/pgadmin-iam-promote-20260611T115746Z`.
- SimpleHostMan migration `0040_pgadmin_iam_bridge_promoted.sql` records the
  Pyrosa IAM pgAdmin binding as `active`/`metadata_only` with
  `provider_provisioning_status=manual_ready`.
- Evidence for the dry-run, promotion and smoke checks is recorded in
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md).

Pending work:

- perform one real operator browser login to pgAdmin through IAM/MFA and record
  the outcome
- run or confirm a post-enforcement backup covering Pyrosa IAM config/database,
  the active pgAdmin bridge service, and the promoted vhost
- monitor bridge, IAM and httpd logs through the burn-in window before removing
  the manual rollback hold

### 2. Promote IAM Apache Rendering From Metadata

Current state:

- IAM provider and binding metadata lives in PostgreSQL.
- Bindings are intentionally `metadata_only` unless explicitly promoted to
  `apache_managed`.
- The IAM UI exposes provider capability status, render mode, MFA policy, and
  provisioning posture.
- The pgAdmin bridge is active by controlled manual promotion, not by the
  automatic renderer.

Pending work:

- validate generated Apache output from IAM PostgreSQL metadata against the
  current hand-managed Authentik vhosts
- keep apply disabled until generated output has parity with the live vhosts and
  a rollback path exists
- decide whether the active pgAdmin bridge should become the first
  `apache_managed` binding after burn-in, or remain manual until another
  low-risk binding is available
- document the renderer parity and apply procedure in
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)

### 3. Confirm Pyrosa IAM Promotion Policy Before Any Public Cutover

Current state:

- `pyrosa-accounts` is decommissioned only from SimpleHostMan IAM provider
  selection. It remains the user-facing Account Center portal and is cataloged
  as app/site/database/backup metadata.
- `pyrosa-iam` owns Pyrosa authentication concerns: OAuth login, OIDC,
  gateway/forward-auth metadata and app-native `ui_auth` tickets.
- SimpleHostMan release `2606.11.11` supports
  `SIMPLEHOST_OAUTH_LOGIN_PROVIDER_SLUG=pyrosa-iam`,
  `/auth/pyrosa-iam/*`, `/v1/auth/pyrosa-iam/*`, public PKCE clients without
  `client_secret`, IAM snake_case claims and the current Pyrosa IAM pilot
  contract.
- `pyrosa-iam` runs on the primary at `127.0.0.1:10134`, uses
  `app_pyrosa_iam`, and is cataloged in SimpleHostMan as `metadata-only`.
- Public `https://iam.pyrosa.com.do` now proxies to the loopback IAM runtime
  for OAuth/OIDC pilots. Authentik still guards the public SimpleHostMan
  administrative surface.
- `pyrosa-iam` release `v2606.102227` is published and smoke-validated. The
  provider catalog records this as release-validated candidate metadata while
  keeping Authentik active and every SimpleHostMan `pyrosa-iam` binding
  `metadata_only`.
- A browser-like loopback validation on 2026-06-10 UTC confirmed
  `SimpleHostMan /auth/pyrosa-iam/start -> IAM login -> MFA -> callback`;
  the callback issued `shp_session` and cleared the temporary OAuth cookie.
- On 2026-06-10 UTC, the controlled IAM switch was rehearsed successfully:
  active operator login + TOTP created a local `shp_session`, logout revoked
  the OAuth token and redirected to IAM logout, and a temporarily inactive
  local operator was rejected without issuing `shp_session`.
- Audit evidence exists for `auth.oauth_login`, `auth.oauth_token_revoked`,
  `auth.logout` and `auth.oauth_callback_rejected` with
  `local_operator_not_active`.
- Backup run `backup-run-7c91dd58-bcdb-4e78-91e0-cbdf19931830` captured the
  updated root-only IAM runtime config and replicated it to the secondary.
- Pyrosa Directory, NewSync and DemoERP redirect app-native login directly to
  `https://iam.pyrosa.com.do/ui-auth/authorize`.
- `pyrosa-demosync` and legacy `pyrosa-sync` remain intentionally outside this
  transition because they keep local/application-owned login.
- On 2026-06-11 UTC, public SimpleHostMan remained protected by Authentik while
  the loopback Pyrosa IAM OAuth flow still completed through MFA, callback,
  `shp_session` creation and temporary OAuth cookie cleanup.
- On 2026-06-11 UTC, a scratch IAM/DR restore drill restored Pyrosa IAM and
  Authentik databases plus IAM/Auth file archives into temporary targets and
  dropped the temporary databases afterward. Evidence is recorded in
  [`BACKUPS.md`](/opt/simplehostman/src/docs/BACKUPS.md) and
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md).
- `pyrosa-iam` release `v2606.110826` retired legacy technical aliases and was
  deployed on 2026-06-11 UTC. Loopback/public `/login` now sets only
  `PYROSA_IAM_SESSION`; gateway checks emit only `X-Pyrosa-IAM-*`; the public
  gateway remains blocked by internal allowlist as expected.
- `pyrosa-iam/oauth_login` is now the selected native SimpleHostMan login
  policy in metadata, using
  `native_oauth_login_under_authentik_outer_gate`.
- Authentik remains the active public outer gate and rollback provider; this
  policy does not change vhosts, DNS or public entry points.

Pending work:

- run one manual operator browser validation through the normal public
  Authentik-protected SimpleHostMan URL before changing any user-facing entry
  point
- keep Authentik as rollback and as the active reverse-proxy provider until a
  separate explicit public cutover is approved
- keep the SimpleHostMan public entry point behind Authentik until a separate
  explicit promotion window is approved

### 4. Implement Pyrosa IAM OIDC/Gateway Provider Support

Current state:

- Pyrosa IAM `oauth_login` is pilot validated for SimpleHostMan but not
  promoted as the only administrative login path.
- SimpleHostMan has a `pyrosa-iam` provider catalog entry with release
  candidate metadata for OAuth login, OIDC and gateway proxy. All remain
  metadata-only until pilots validate rollback.
- `pyrosa-iam` OIDC discovery and JWKS are available publicly at
  `https://iam.pyrosa.com.do`, and the SimpleHostMan pilot client validates
  Authorization Code + PKCE with a real MFA-backed identity.
- `pyrosa-iam` `/oauth/gateway/check` has a forward-auth smoke:
  unauthenticated requests fail closed and authenticated AAL2 sessions return
  trusted headers.
- The pgAdmin bridge is the first manual Apache enforcement pilot for
  `gateway_proxy`; it still needs burn-in and renderer integration before
  promotion to a general provider capability.
- SAML remains disabled by decision. Accounts has a metadata scaffold, but SSO
  assertions, SP registry and a pilot app are still required before promotion.
- Authentik remains the provider for generic reverse-proxy enforcement.

Pending work:

- decide whether SimpleHostMan should consume OIDC directly, OAuth
  introspection directly, or both before any promotion from Authentik
- finish pgAdmin bridge burn-in, then decide whether that evidence is enough to
  mark `gateway_proxy` available for selected administrative apps
- record SimpleHostMan readiness evidence in
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)

## Deferred Unless Explicitly Requested

- Pyrosa IAM operational `saml` support. Metadata scaffold remains disabled
  unless a concrete SP pilot requirement appears.
- Automatic IAM failover. Keep manual promotion until a controlled secondary
  promotion test proves the data and file behavior.
- SSH changes. SSH remains outside Authentik/IAM scope.
- Capacity upgrades and broad database retuning. Current inspection guidance
  does not recommend an urgent VPS size change.
