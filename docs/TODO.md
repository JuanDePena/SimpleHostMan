# SimpleHost TODO

Updated on `2026-06-09`.

This file tracks only work that is still open. Closed implementation evidence
belongs in the feature runbook that owns the behavior, not in this tracker.

## Baseline

- canonical source tree: `/opt/simplehostman/src`
- canonical runtime root: `/opt/simplehostman/release`
- active control-plane release: `2606.09.02`
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

### 4. Promote Pyrosa Accounts OAuth Login For SimpleHostMan

Current state:

- SimpleHostMan models `pyrosa-accounts` as a candidate IAM provider.
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

Pending work:

- validate active operator login, unprovisioned/inactive identity rejection,
  token revocation and external logout redirect in an interactive browser
  session before promotion

### 5. Implement Pyrosa Accounts OIDC/Gateway Provider Support

Current state:

- Pyrosa Accounts `oauth` is pilot validated for SimpleHostMan but not promoted.
- `oidc` and `gateway_proxy` are intentionally future/scaffold-disabled.
- OIDC readiness is now modeled in SimpleHostMan metadata with promotion gate
  `accounts_oidc_release` and `advertiseAsProvider=false`.
- Pyrosa Accounts keeps OIDC discovery fail-closed with
  `oidc_not_available` and required-feature metadata instead of publishing
  partial OIDC discovery.
- Gateway readiness is now modeled in SimpleHostMan metadata with promotion
  gate `accounts_gateway_proxy_release` and `advertiseAsProvider=false`.
- Pyrosa Accounts keeps `/oauth/gateway` fail-closed with
  `gateway_proxy_not_available` and required-feature metadata; it is not a
  reverse proxy or outpost yet.
- Authentik remains the provider for generic reverse-proxy enforcement.

Pending work:

- implement OIDC discovery, JWKS, signed ID tokens, claims and `/userinfo`
  before advertising `pyrosa-accounts` as an OIDC provider
- implement a real gateway/outpost path before advertising
  `gateway_proxy`
- update SimpleHostMan provider capability status only after those releases and
  pilots are complete
- record SimpleHostMan readiness evidence in
  [`IAM_SSO.md`](/opt/simplehostman/src/docs/IAM_SSO.md)

## Deferred Unless Explicitly Requested

- Pyrosa Accounts `saml` support. It remains disabled unless a concrete
  requirement appears.
- Automatic IAM failover. Keep manual promotion until a controlled secondary
  promotion test proves the data and file behavior.
- SSH changes. SSH remains outside Authentik/IAM scope.
- Capacity upgrades and broad database retuning. Current inspection guidance
  does not recommend an urgent VPS size change.
