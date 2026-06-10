# SimpleHost TODO

Updated on `2026-06-10`.

This file tracks only work that is still open. Closed implementation evidence
belongs in the feature runbook that owns the behavior, not in this tracker.

## Baseline

- canonical source tree: `/opt/simplehostman/src`
- canonical runtime root: `/opt/simplehostman/release`
- active control-plane release: `2606.10.06`
- implemented IAM/SSO state:
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)
- implemented operational inspection and hardening evidence:
  [`OPERATIONAL_INSPECTION_20260501.md`](/opt/simplehostman/src/docs/OPERATIONAL_INSPECTION_20260501.md)
- implemented mail platform behavior:
  [`MAIL.md`](/opt/simplehostman/src/docs/MAIL.md)

## Open Items

### 1. Execute The pgAdmin Administrative IAM Pilot

Current state:

- SimpleHostMan models `pyrosa-pgadmin` as an IAM binding with
  `provider=authentik`, `auth_mode=proxy`, `render_mode=metadata_only`, and
  `provider_provisioning_status=pending`.
- SimpleHostMan also models
  `iam-binding-pyrosa-pgadmin-pyrosa-iam-gateway` as the next
  `pyrosa-iam` gateway candidate with `render_mode=metadata_only`; no Apache
  or traffic change has been applied.
- No automatic Apache or Authentik API apply should happen until parity and
  rollback are confirmed.

Pending work:

- decide whether the first pgAdmin pilot is Authentik proxy enforcement,
  Pyrosa IAM gateway dry-run, or Authentik first followed by Pyrosa IAM
- prepare a direct-vhost rollback copy before enforcement
- render the candidate pgAdmin vhost in dry-run and compare it to the current
  direct pgAdmin vhost
- validate unauthenticated redirect, MFA login, pgAdmin behavior after SSO,
  unsafe-method handling, and local break-glass access
- run or confirm a post-enforcement backup covering Authentik state
- record completion evidence in
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)

### 2. Promote IAM Apache Rendering From Metadata

Current state:

- IAM provider and binding metadata lives in PostgreSQL.
- Bindings are intentionally `metadata_only` unless explicitly promoted to
  `apache_managed`.
- The IAM UI exposes provider capability status, render mode, MFA policy, and
  provisioning posture.

Pending work:

- validate generated Apache output from IAM PostgreSQL metadata against the
  current hand-managed Authentik vhosts
- keep apply disabled until generated output has parity with the live vhosts and
  a rollback path exists
- promote one low-risk binding first, preferably the pgAdmin binding after its
  Authentik provider object is ready
- document the renderer parity and apply procedure in
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)

### 3. Run An IAM/DR Restore Drill

Current state:

- Authentik runs on the primary during normal operation.
- The secondary carries restored Authentik files, vhosts, units, pinned image,
  and standby posture, but services remain held behind
  `/etc/simplehost/iam/authentik/SECONDARY_PROMOTED`.
- Automatic IAM failover remains disabled.

Pending work:

- choose a current replicated Authentik backup as the drill source
- restore database and files into scratch targets
- verify users, MFA devices, applications, providers, outpost links, branding,
  and recovery posture from the restored state
- optionally rehearse the secondary promotion procedure without enabling
  automatic failover
- record drill evidence in
  [`BACKUPS.md`](/opt/simplehostman/src/docs/BACKUPS.md) and
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)

### 4. Decide Pyrosa IAM Promotion Policy For SimpleHostMan

Current state:

- `pyrosa-accounts` is decommissioned only from SimpleHostMan IAM provider
  selection. It remains the user-facing Account Center portal and is cataloged
  as app/site/database/backup metadata.
- `pyrosa-iam` owns Pyrosa authentication concerns: OAuth login, OIDC,
  gateway/forward-auth metadata and app-native `ui_auth` tickets.
- SimpleHostMan release `2606.10.06` supports
  `SIMPLEHOST_OAUTH_LOGIN_PROVIDER_SLUG=pyrosa-iam`,
  `/auth/pyrosa-iam/*`, `/v1/auth/pyrosa-iam/*`, public PKCE clients without
  `client_secret`, IAM snake_case claims and inherited compatibility aliases.
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

Pending work:

- decide whether to promote the `control:simplehost-control`
  `pyrosa-iam/oauth_login` binding from candidate metadata to the selected
  native login policy while Authentik remains the outer public gate
- keep Authentik as rollback and as the active reverse-proxy provider until a
  separate explicit cutover is approved
- run one manual operator browser validation through the normal public
  Authentik-protected SimpleHostMan URL before changing any user-facing entry
  point
- execute the pgAdmin pilot from the new metadata-only `pyrosa-iam/gateway`
  candidate after vhost parity and rollback are ready
- retire inherited `X-Pyrosa-Accounts-*`, cookie and storage aliases after all
  dependent clients have moved to the new `PYROSA_IAM_*` and
  `X-Pyrosa-IAM-*` names

### 5. Implement Pyrosa IAM OIDC/Gateway Provider Support

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
  trusted headers; an Apache-rendered pilot is still pending.
- SAML remains disabled by decision. Accounts has a metadata scaffold, but SSO
  assertions, SP registry and a pilot app are still required before promotion.
- Authentik remains the provider for generic reverse-proxy enforcement.

Pending work:

- decide whether SimpleHostMan should consume OIDC directly, OAuth
  introspection directly, or both before any promotion from Authentik
- validate an Apache forward-auth pilot against a non-critical app before
  promoting `gateway_proxy`
- promote `gateway_proxy` only after a non-critical Apache forward-auth pilot
  validates rollback and unsafe-method behavior
- record SimpleHostMan readiness evidence in
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)

### 6. Retire Legacy Accounts IAM Compatibility Aliases

Current state:

- `pyrosa-iam` writes canonical IAM names but still accepts compatibility
  aliases inherited from the cloned Accounts runtime.
- The legacy names include `PYROSA_ACCOUNTS_SESSION`,
  `X-Pyrosa-Account-*`, `X-Pyrosa-Accounts-*`, and remaining
  `PYROSA_ACCOUNTS_*` runtime fallbacks.
- This compatibility is intentional while Directory, NewSync, DemoERP,
  SimpleHostMan, pgAdmin and any proxy pilot finish their migration.

Pending work:

- confirm every active app consumes `PYROSA_IAM_*`, `PYROSA_IAM_SESSION` and
  `X-Pyrosa-IAM-*` where IAM headers/cookies are relevant
- add telemetry or log checks for legacy-cookie/header usage during one release
- remove write-side legacy aliases first while keeping read-side fallback
- remove read-side fallback only after a clean release and documented rollback
- record final removal evidence in the Pyrosa IAM compatibility guide and
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)

## Deferred Unless Explicitly Requested

- Pyrosa IAM operational `saml` support. Metadata scaffold remains disabled
  unless a concrete SP pilot requirement appears.
- Automatic IAM failover. Keep manual promotion until a controlled secondary
  promotion test proves the data and file behavior.
- SSH changes. SSH remains outside Authentik/IAM scope.
- Capacity upgrades and broad database retuning. Current inspection guidance
  does not recommend an urgent VPS size change.
