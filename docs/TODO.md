# SimpleHost TODO

Updated on `2026-06-08`.

This file tracks only work that is still open. Closed implementation evidence
belongs in the feature runbook that owns the behavior, not in this tracker.

## Baseline

- canonical source tree: `/opt/simplehostman/src`
- canonical runtime root: `/opt/simplehostman/release`
- active control-plane release: `2606.08.03`
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

### 4. Implement Pyrosa Accounts OAuth/OIDC/Gateway Provider Support

Current state:

- SimpleHostMan models `pyrosa-accounts` as a candidate IAM provider.
- `ui_auth` is the only available Pyrosa Accounts integration mode today.
- `oauth` has a first runtime cut in `pyrosa-accounts` and is deployed on the
  primary runtime.
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
- SimpleHostMan still keeps `pyrosa-accounts` OAuth scaffold-disabled for
  protected browser surfaces until the browser pilot is completed interactively
  by a human operator through Pyrosa Accounts login and MFA.
- `oidc` and `gateway_proxy` remain future/scaffold-disabled in SimpleHostMan.

Pending work:

- complete the interactive browser pilot with a real operator session and MFA
  to confirm `human`, `aal2`, scopes, audience, token revocation and rollback
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
