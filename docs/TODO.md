# SimpleHost TODO

Updated on `2026-06-10`.

This file tracks only work that is still open. Closed implementation evidence
belongs in the feature runbook that owns the behavior, not in this tracker.

## Baseline

- canonical source tree: `/opt/simplehostman/src`
- canonical runtime root: `/opt/simplehostman/release`
- active control-plane release: `2606.10.01`
- implemented IAM/SSO state:
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)
- implemented operational inspection and hardening evidence:
  [`OPERATIONAL_INSPECTION_20260501.md`](/opt/simplehostman/src/docs/OPERATIONAL_INSPECTION_20260501.md)
- implemented mail platform behavior:
  [`MAIL.md`](/opt/simplehostman/src/docs/MAIL.md)

## Open Items

### 1. Protect `pgadmin.pyrosa.com.do` With Authentik

Current state:

- SimpleHostMan models `pyrosa-pgadmin` as an IAM binding with
  `provider=authentik`, `auth_mode=proxy`, `render_mode=metadata_only`, and
  `provider_provisioning_status=pending`.
- No automatic Apache or Authentik API apply should happen until parity and
  rollback are confirmed.

Pending work:

- create or confirm the upstream Authentik application, provider, group policy,
  and outpost association for `pgadmin.pyrosa.com.do`
- prepare a direct-vhost rollback copy before enforcement
- validate unauthenticated redirect, MFA login, pgAdmin behavior after SSO, and
  local break-glass access
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

### 4. Promote Pyrosa IAM OAuth Login For SimpleHostMan

Current state:

- SimpleHostMan currently models `pyrosa-accounts` as the inherited candidate
  IAM provider because the pilot implementation started inside Accounts.
- Product direction changed on 2026-06-09: `pyrosa-accounts` remains the
  user-facing Account Center, while `pyrosa-iam` becomes the formal candidate
  IAM provider for future promotion.
- `ui_auth` is available for compatible Pyrosa apps, and `oauth_login` is
  modeled as the candidate SimpleHostMan browser login mode.
- `oauth` has a validated browser Authorization Code + PKCE + MFA/AAL2 pilot
  for SimpleHostMan and remains candidate-only until promotion.
- The Accounts OAuth migration was applied on the primary runtime database on
  2026-06-08 UTC.
- The isolated `oauth-smoke` client is configured with `oauth_enabled=true`,
  `client_credentials`, `profile:read`, and root-only client secret storage.
- OAuth metadata, token issue, introspection, and revoke were smoke-validated
  locally on 2026-06-08 UTC.
- SimpleHostMan source now includes a feature-flagged read-only resource-server
  pilot at `/v1/oauth/pilot/profile`.
- Runtime release `2606.08.02` validated the resource-server pilot with opaque
  service tokens, introspection, `profile:read`, `simplehost-control` audience,
  revocation and fail-closed checks on 2026-06-08 UTC.
- SimpleHostMan release `2606.08.03` adds a feature-flagged browser
  Authorization Code pilot at `/v1/oauth/pilot/start` and
  `/v1/oauth/pilot/callback`.
- The `simplehost-control-oauth-pilot` client is configured in Pyrosa Accounts
  with `authorization_code`, PKCE, `profile:read mfa:read`, callback
  `https://vps-prd.pyrosa.com.do:3200/v1/oauth/pilot/callback`, and root-only
  secret storage.
- Local runtime validation on 2026-06-08 UTC confirmed SimpleHostMan
  `2606.08.03` health, OAuth start redirect generation, Accounts authorize
  redirect to login when no root session exists, and callback fail-closed
  behavior for invalid state.
- Interactive operator validation on 2026-06-09 UTC confirmed the browser
  pilot returns `OK` with provider `pyrosa-accounts`, issuer
  `https://accounts.pyrosa.com.do`, audience `simplehost-control`, client
  `simplehost-control-oauth-pilot`, principal `human`, assurance level `aal2`,
  and scopes `profile:read mfa:read`.
- SimpleHostMan source now includes native candidate login routes at
  `/auth/pyrosa-accounts/start` and `/auth/pyrosa-accounts/callback`. The web
  route owns PKCE/state cookies, while the internal control API exchanges the
  code, introspects the access token, validates `simplehost-control`, `human`,
  `aal2`, `profile:read`, and `mfa:read`, and creates `shp_session` only for an
  active local operator.
- OAuth sessions now persist non-sensitive provider metadata and token hash;
  logout revokes the raw access token from the path-scoped
  `shp_oauth_logout` cookie when present, clears local cookies, audits
  revocation/logout, and redirects to the configured Pyrosa Accounts logout
  endpoint.
- The IAM PostgreSQL catalog and UI now expose a candidate
  `control:simplehost-control` binding with provider `pyrosa-accounts`,
  `auth_mode=oauth_login`, `status=candidate`, and `render_mode=metadata_only`.
- SimpleHostMan migration `0030_iam_pyrosa_iam_provider.sql` adds the parallel
  `pyrosa-iam` provider row and metadata-only candidate bindings for
  `control:simplehost-control` using `oauth_login`, `oidc`, and gateway
  `proxy`. Authentik remains active; these bindings do not render Apache or
  change traffic.
- The IAM view shows active provider, OAuth candidate provider, latest OAuth
  login and latest OAuth callback rejection when audit evidence exists.
- Runtime release `2606.09.02` is active on the primary. Startup applied IAM
  migrations through `0023`, preserved Authentik as the active
  `trusted_proxy_headers` binding, and registered Pyrosa Accounts as the
  candidate `oauth_login` binding for `control:simplehost-control`.
- Non-interactive runtime smoke confirmed health, PKCE start redirect to
  Pyrosa Accounts, and fail-closed invalid callback behavior.
- SimpleHostMan still keeps Authentik as the default provider for
  administrative proxy surfaces until there is an explicit promotion and
  rollback plan for a selected surface.
- `oidc` and `gateway_proxy` remain future/scaffold-disabled in SimpleHostMan.
- The `pyrosa-iam` clone now starts the namespace split: `PYROSA_IAM_*` first,
  `PYROSA_ACCOUNTS_*` fallback, defaults for `iam.pyrosa.com.do` and
  `app_pyrosa_iam`, and gateway headers `X-Pyrosa-IAM-*` plus legacy
  compatibility headers.
- `pyrosa-iam` is provisioned as a loopback-only pilot on the primary at
  `127.0.0.1:10134` with PostgreSQL database `app_pyrosa_iam`.
- SimpleHostMan migration `0031_pyrosa_iam_runtime_resources.sql` registers
  `pyrosa-iam` in the app, site, database, and backup policy catalogs with
  app mode `metadata-only`.
- The reconciler skips `metadata-only` apps for proxy/container/database jobs,
  so the catalog row does not publish Apache or replace the hand-provisioned
  Quadlet runtime.
- Backup policies now cover the `app_pyrosa_iam` database, the app storage
  root, and root-only runtime configuration through
  `pyrosa-iam-root-config-daily`.
- `pyrosa-iam` now has a reproducible SimpleHostMan OAuth/OIDC pilot client
  seeded by `database/migrations/0008_simplehostman_oauth_oidc_pilot.sql`.
- Loopback validation on 2026-06-09 UTC confirmed health, OAuth/OIDC discovery,
  JWKS, authorize redirect preservation, gateway fail-closed behavior, SAML
  disabled posture, and invalid token exchange fail-closed behavior.
- A real pilot identity for `webmaster@pyrosa.com.do` now exists in
  `app_pyrosa_iam`, is active, requires MFA, and has one active TOTP factor.
- Loopback validation on 2026-06-10 UTC confirmed Authorization Code + PKCE
  with the real pilot identity, `aal2`, `profile:read`, `mfa:read`, successful
  token revocation, post-revocation inactive introspection, and
  `/oauth/gateway/check` fail-closed/allow behavior.
- SimpleHostMan source now supports `SIMPLEHOST_OAUTH_LOGIN_PROVIDER_SLUG=pyrosa-iam`,
  `/auth/pyrosa-iam/*`, `/v1/auth/pyrosa-iam/*`, public PKCE clients without
  `client_secret`, and both IAM snake_case claims plus inherited compatibility
  aliases.
- SimpleHostMan release `2606.10.01` is deployed on the primary with this
  source support. Runtime OAuth env still points at Accounts until a deliberate
  IAM switch is rehearsed.
- Public `iam.pyrosa.com.do` remains an HTTPS hold vhost returning HTTP 503.
  Authentik remains the active provider for SimpleHostMan.

Pending work:

- configure a controlled runtime switch to
  `SIMPLEHOST_OAUTH_LOGIN_PROVIDER_SLUG=pyrosa-iam`, IAM issuer/endpoints and
  callback `/auth/pyrosa-iam/callback` while keeping Authentik outside it
- validate active operator login through the native SimpleHostMan
  `/auth/pyrosa-iam/*` path
- validate unprovisioned and inactive local operator rejection against
  `pyrosa-iam`
- validate local logout plus external IAM logout redirect against `pyrosa-iam`
- keep Authentik and the `iam.pyrosa.com.do` hold vhost in place until an
  explicit promotion/rollback decision

### 5. Implement Pyrosa IAM OIDC/Gateway Provider Support

Current state:

- Pyrosa Accounts `oauth` is pilot validated for SimpleHostMan but not promoted.
- OIDC provider support is implemented in the inherited Accounts codebase and
  should move behind the `pyrosa-iam` runtime boundary before being promoted.
- The inherited gateway check endpoint should move behind the `pyrosa-iam`
  runtime boundary before being promoted.
- Gateway readiness is now modeled in SimpleHostMan metadata with promotion
  gate `accounts_gateway_proxy_release` and `advertiseAsProvider=false`.
- Pyrosa Accounts keeps `/oauth/gateway` fail-closed with
  `gateway_proxy_not_available` and required-feature metadata; it is not a
  reverse proxy or outpost yet.
- SimpleHostMan now has a separate `pyrosa-iam` provider catalog entry with
  candidate metadata for OAuth login, OIDC, and gateway proxy. All remain
  metadata-only until the runtime exists and pilots validate rollback.
- `pyrosa-iam` OIDC discovery and JWKS are available on the loopback runtime,
  and the SimpleHostMan pilot client validates Authorization Code + PKCE with a
  real MFA-backed identity.
- `pyrosa-iam` `/oauth/gateway/check` has a loopback forward-auth smoke:
  unauthenticated requests fail closed and authenticated AAL2 sessions return
  trusted headers.
- SAML remains disabled by decision. Accounts has a metadata scaffold, but SSO
  assertions, SP registry and a pilot app are still required before promotion.
- Authentik remains the provider for generic reverse-proxy enforcement.

Pending work:

- decide whether SimpleHostMan should consume OIDC directly, OAuth
  introspection directly, or both before any promotion from Authentik
- validate an Apache forward-auth pilot against a non-critical app before
  promoting `gateway_proxy`
- update SimpleHostMan provider capability status only after those releases and
  pilots are complete
- record SimpleHostMan readiness evidence in
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)

## Deferred Unless Explicitly Requested

- Pyrosa Accounts operational `saml` support. Metadata scaffold exists, but it
  remains disabled unless a concrete SP pilot requirement appears.
- Automatic IAM failover. Keep manual promotion until a controlled secondary
  promotion test proves the data and file behavior.
- SSH changes. SSH remains outside Authentik/IAM scope.
- Capacity upgrades and broad database retuning. Current inspection guidance
  does not recommend an urgent VPS size change.
