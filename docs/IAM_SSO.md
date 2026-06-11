# IAM And SSO Runbook

Updated on `2026-06-11`.

## Scope

This runbook documents the planned Identity and Access Management layer for
SimpleHostMan administrative and selected application web surfaces.

Selected IAM product:

- Authentik

Primary hostname:

- `auth.pyrosa.com.do`

First protected application:

- `https://code.pyrosa.com.do/`

Explicitly out of scope:

- SSH login and SSH key policy
- direct RustDesk `hbbs` and `hbbr` transport ports
- public customer websites that must remain anonymously reachable

SSH remains governed by [`HARDENING.md`](/opt/simplehostman/src/docs/HARDENING.md).

## Current Status

The initial IAM/SSO rollout is stable and closed as of `2026-05-02`.

Protected primary surfaces:

- `https://auth.pyrosa.com.do/`
- `https://code.pyrosa.com.do/`
- `https://vps-prd.pyrosa.com.do:3200/`

Final validation confirmed:

- public primary requests to the protected surfaces redirect to Authentik
- `webmaster@pyrosa.com.do` is active and has `1` confirmed TOTP device
- successful Authentik trusted-proxy handoff creates a local `shp_session` for
  existing active SimpleHostMan operators
- SimpleHostMan logout for SSO sessions clears the local cookie and redirects
  through the Authentik outpost sign-out path
- unprovisioned SSO identities receive a SimpleHostMan `403` page, do not get
  `shp_session`, and receive an Authentik sign-out action
- Authentik backup policy `iam-authentik-primary-daily` has a successful latest
  primary run and the backup runner automatically replicates the complete run
  directory to the secondary
- secondary Authentik remains intentionally inactive behind the
  `SECONDARY_PROMOTED` hold marker

## Current Decision

The platform should run Authentik as a dedicated IAM/SSO service, not as a
generic `control_plane_apps` web application.

Reasoning:

- Authentik is a multi-service stack, not a single HTTP container.
- It needs a server component, a worker component, PostgreSQL, persistent file
  storage, and at least one proxy outpost path for protected applications.
- The current generic app reconciler assumes one app container published to a
  local HTTP backend port with application file volumes; that is the wrong
  shape for an IAM stack.
- Treating IAM as a special platform resource keeps rollback and break-glass
  procedures clearer.

Official Authentik references checked during this planning pass:

- https://docs.goauthentik.io/core/architecture/
- https://docs.goauthentik.io/install-config/install/docker-compose/
- https://docs.goauthentik.io/install-config/configuration/
- https://docs.goauthentik.io/add-secure-apps/outposts/
- https://docs.goauthentik.io/add-secure-apps/providers/proxy/

## Architectural Decision: IAM Provider Selection

Status: accepted for phases 1-7 on `2026-06-07`.

SimpleHostMan should model IAM as a selectable control-plane resource instead
of hard-coding every SSO integration to a single product. The current supported
provider catalog is:

- `authentik`: active/default for administrative and infrastructure browser
  surfaces. It currently provides proxy protection, trusted-proxy headers, MFA,
  and can later expose OIDC/SAML for apps that support those protocols.
- `pyrosa-iam`: Pyrosa-owned candidate/provider for app-native `ui_auth`,
  OAuth login, OIDC, future gateway/forward-auth and, only if required later,
  SAML.

Provider selection was metadata-only during phases 1-4. Phases 5-7 add render
state and richer capability metadata, but they still do not rewrite Apache
vhosts, Authentik provider objects, outposts, DNS, or live app traffic unless a
binding is explicitly promoted from `metadata_only` to `apache_managed`.

The control plane stores:

- IAM providers and their capabilities.
- Protected-surface bindings that select provider, mode, MFA policy and status.
- trusted-proxy login metadata on local `shp_session`/`control_plane_sessions`
  records so audit and logout behavior can identify the originating provider.

Initial integration modes:

- `proxy`: provider performs the HTTP reverse-proxy enforcement before the app.
- `trusted_proxy_headers`: SimpleHostMan consumes trusted identity headers after
  upstream provider enforcement and creates a local `shp_session`.
- `ui_auth`: Pyrosa apps delegate UI session exchange to Pyrosa IAM.
- `oauth_login`: SimpleHostMan performs browser Authorization Code + PKCE
  login with Pyrosa IAM and creates a local `shp_session` only after
  token introspection and active-operator checks.
- `oidc` and `saml`: reserved for providers that actually implement those
  protocols for the selected application.

Operational defaults:

- Authentik remains selected for `code-server`, SimpleHostMan operator access,
  and `pgadmin` metadata.
- Pyrosa IAM is selectable for Pyrosa-native `ui_auth` apps and metadata-only
  candidate `oauth_login`/OIDC/gateway work.
- `pyrosa-directory`, `pyrosa-newsync` and `pyrosa-demoerp` delegate `ui_auth`
  directly to Pyrosa IAM; SimpleHostMan models these bindings as app-handled
  authentication without taking ownership of their client secrets.
- Non-HTTP services such as SSH and RustDesk transport remain outside IAM.

Implementation phases:

1. Document this architectural decision in this runbook.
2. Add PostgreSQL provider/binding metadata and shared contracts.
3. Generalize SimpleHostMan trusted-proxy SSO without changing current
   Authentik behavior.
4. Add an initial Control Plane IAM view for providers and protected bindings.
5. Render protected Apache/provider state from PostgreSQL metadata.
6. Integrate Pyrosa IAM with compatible Pyrosa-native apps through `ui_auth`.
7. Add or reject Pyrosa IAM gateway/OIDC/SAML support based on concrete app
   requirements.

Phase 5-7 implementation decisions:

- IAM bindings now carry `render_mode`:
  - `metadata_only`: SimpleHostMan records and displays the binding, but does
    not dispatch Apache changes.
  - `apache_managed`: reserved for bindings whose generated Apache output has
    passed parity checks and is safe to apply.
- IAM bindings also carry `provider_provisioning_status` so an operator can see
  whether the upstream provider object is already manually ready, not required,
  pending, future-only, or unknown.
- Authentik capabilities remain available for `proxy`, `trusted_proxy_headers`,
  `oidc`, and `saml`.
- Pyrosa IAM capability status is explicit:
  - `ui_auth`: available for compatible Pyrosa-native apps.
  - `oauth`: pilot validated for SimpleHostMan browser Authorization Code with
    PKCE, human principal, `aal2`, `profile:read`, and `mfa:read`; it remains
    candidate-only until promoted for a selected surface.
  - `oidc`: pilot validated for public discovery and JWKS on
    `https://iam.pyrosa.com.do`; it remains candidate-only until a consumer
    pilot explicitly selects OIDC.
  - `gateway_proxy`: pilot validated as a fail-closed runtime check endpoint;
    Apache forward-auth rendering and traffic changes remain future work until
    a non-critical surface pilot passes rollback.
  - `saml`: disabled unless a concrete requirement appears.
- `pyrosa-directory` is recorded as:
  - provider: `pyrosa-iam`
  - mode: `ui_auth`
  - client: `directory`
  - callback: `https://directory.pyrosa.com.do/auth/callback`
  - secret storage: app runtime env, outside SimpleHostMan.
- `pyrosa-newsync` is recorded as:
  - provider: `pyrosa-iam`
  - mode: `ui_auth`
  - client: `sync`
  - callback: `https://newsync.pyrosa.com.do/auth/callback`
  - secret storage: app runtime env, outside SimpleHostMan.
  - inventory boundary: the binding can exist even while full app inventory
    ownership remains outside PostgreSQL.

Pyrosa Accounts decommission decision:

- As of 2026-06-10, `pyrosa-accounts` is removed from the SimpleHostMan IAM
  provider-selection catalog. It must not be offered as `ui_auth`, OAuth/OIDC,
  gateway or SAML provider.
- Authentication-owned features move to `pyrosa-iam`: login sessions, MFA/AAL,
  OAuth/OIDC, gateway/forward-auth, app-native `ui-auth` tickets and
  access-decision audit.
- `pyrosa-accounts` remains a user-facing Account Center where people can view
  and edit profile, contact, preference, session and account security data. It
  delegates authentication to `pyrosa-iam` and is not an IAM provider.
- SimpleHostMan migration `0035_restore_pyrosa_accounts_account_center_catalog.sql`
  restores Accounts as an app/site/database/backup resource in the control-plane
  catalog while keeping it absent from IAM provider selection.

Pyrosa Accounts / Pyrosa IAM split:

- `pyrosa-accounts` owns non-authentication account portal concerns such as
  profile, contact data, preferences and user self-service views.
- `pyrosa-iam` owns IAM provider capabilities: OAuth/OIDC authorization server,
  gateway/forward-auth, SAML if required, clients, scopes, audiences, MFA/AAL
  policies, claims, app-native `ui-auth` and access-decision audit.
- Runtime naming for IAM provider work is canonicalized on `PYROSA_IAM_*`,
  `iam.pyrosa.com.do`, `app_pyrosa_iam` and provider slug `pyrosa-iam`.
- SimpleHostMan must not promote Accounts-as-portal as an IAM replacement for
  Authentik. Any future promotion should explicitly target `pyrosa-iam`.
- Authentik remains the active/default administrative provider until
  `pyrosa-iam` has a real runtime, backup/restore posture, client provisioning,
  MFA/AAL validation, logout/revocation validation, and rollback evidence.

Pyrosa app login routing as of `2026-06-10`:

- `pyrosa-iam` is now the `ui_auth` ticket issuer for Pyrosa-native apps.
  Apps redirect directly to `https://iam.pyrosa.com.do/ui-auth/authorize` and
  use IAM internal `ui-auth` exchange/introspection endpoints.
- `pyrosa-directory` uses `client=directory` and callback
  `https://directory.pyrosa.com.do/auth/callback`.
- `pyrosa-newsync` uses `client=sync` and callback
  `https://newsync.pyrosa.com.do/auth/callback`.
- `pyrosa-demoerp` uses `client=erp` and callback
  `https://demoerp.pyrosa.com.do/auth/callback`.
- `pyrosa-demosync` and legacy `pyrosa-sync` are explicitly excluded from this
  transition because they retain local/application-owned login for now.
- SimpleHostMan migration `0033_decommission_pyrosa_accounts_iam.sql`
  decommissions `pyrosa-accounts` from IAM provider selection and moves the
  Directory, NewSync and DemoERP `ui_auth` bindings to `pyrosa-iam`.
- SimpleHostMan migration `0035_restore_pyrosa_accounts_account_center_catalog.sql`
  restores Accounts as an Account Center app at `accounts.pyrosa.com.do`, using
  backend port `10124`, database `app_pyrosa_accounts` and app/database backup
  policy metadata. It intentionally does not recreate an IAM provider row.
- SimpleHostMan migration `0030_iam_pyrosa_iam_provider.sql` registers
  `pyrosa-iam` as a parallel provider row with provider kind `pyrosa_iam`,
  base URL `https://iam.pyrosa.com.do`, and metadata-only candidate bindings
  for `control:simplehost-control` using `oauth_login`, `oidc`, and gateway
  `proxy`.
- Those `pyrosa-iam` bindings are intentionally `metadata_only` with provider
  provisioning state `future`: they document the target posture but do not
  render Apache, change vhosts, or move public traffic away from Authentik.
- SimpleHostMan migration `0031_pyrosa_iam_runtime_resources.sql` registers
  the `pyrosa-iam` loopback pilot in the app/database/backup catalogs:
  app slug `pyrosa-iam`, canonical domain `iam.pyrosa.com.do`, backend port
  `10134`, database `app_pyrosa_iam`, and daily backup policies
  `pyrosa-iam-database-daily` plus `pyrosa-iam-files-daily`.
- The `pyrosa-iam` app catalog row is intentionally `metadata-only`. The
  reconciler skips proxy/container/database jobs for that mode so catalog
  visibility does not publish Apache, overwrite the hand-provisioned Quadlet,
  or try to manage the runtime-owned database credential.
- The pilot now has a public HTTPS proxy at `iam.pyrosa.com.do` on the primary.
  Apache terminates TLS with the `*.pyrosa.com.do` certificate and proxies to
  the loopback runtime at `127.0.0.1:10134`. Authentik remains the active outer
  gate for SimpleHostMan, code-server and pgAdmin; this change only publishes
  the IAM provider endpoint needed by OAuth/OIDC pilots.
- Current backup coverage for `pyrosa-iam` includes the PostgreSQL database
  dump, app storage root, and root-only runtime configuration through
  `pyrosa-iam-root-config-daily`. The root-only archive covers
  `/etc/containers/systemd/env/app-pyrosa-iam.env`, `/etc/pyrosa-iam`, and
  `/etc/httpd/conf.d/pyrosa-iam.conf`.
- On 2026-06-09 UTC, SimpleHostMan release `2606.09.23` added the dedicated
  `iam:pyrosa-iam` backup handler and forced run
  `backup-run-a0fda97b-c2b6-4c5e-b23e-0864dc73e76b` succeeded. Primary
  artifact directory:
  `/srv/backups/iam/pyrosa-iam/root-config/pyrosa-iam-root-config-daily-2026-06-09T23-53-10-780Z`.
  Replicated secondary directory:
  `/srv/backups/iam/pyrosa-iam/root-config/primary-replicated/pyrosa-iam-root-config-daily-2026-06-09T23-53-10-780Z`.
- On 2026-06-10 UTC, after the pilot operator password/TOTP files and
  `/etc/pyrosa-iam` permission posture were finalized, forced run
  `backup-run-ddddafdc-ad2b-43f5-8d2b-5081e8fc3739` succeeded. Primary
  artifact directory:
  `/srv/backups/iam/pyrosa-iam/root-config/pyrosa-iam-root-config-daily-2026-06-10T00-27-42-819Z`.
  Replicated secondary directory:
  `/srv/backups/iam/pyrosa-iam/root-config/primary-replicated/pyrosa-iam-root-config-daily-2026-06-10T00-27-42-819Z`.
  Both primary and secondary artifacts were verified as `0600 root:root`.
- `pyrosa-iam` migration `0008_simplehostman_oauth_oidc_pilot.sql` seeds the
  `simplehost-control-oauth-pilot` OAuth/OIDC client for SimpleHostMan:
  public PKCE, `authorization_code`, `refresh_token`, OIDC enabled, gateway
  disabled, and callback URLs for the existing pilot and future native
  `pyrosa-iam` callback.
- On 2026-06-09 UTC the `pyrosa-iam` loopback pilot validated health, OAuth
  authorization-server metadata, OIDC discovery, JWKS Ed25519 signing metadata,
  authorize-to-login redirect preservation, gateway fail-closed behavior, SAML
  disabled posture, and invalid token exchange fail-closed behavior.
- On 2026-06-10 UTC, a real pilot identity was provisioned in `app_pyrosa_iam`
  for the existing active SimpleHostMan operator `webmaster@pyrosa.com.do`.
  The IAM user is active, has a primary verified email, requires MFA and has
  one active TOTP factor. The temporary password and TOTP seed remain root-only
  runtime files under `/etc/pyrosa-iam`.
- `/etc/pyrosa-iam` was corrected to `0750 root:almalinux` so the container
  `node` user can traverse the mounted secret directory. The OIDC signing key
  remains restricted to the runtime process and JWKS now returns the
  `pyrosa-iam-oidc-1` Ed25519 public key.
- Full human Authorization Code + PKCE login against `pyrosa-iam` was
  validated on loopback with `aud=simplehost-control`, `principal_type=human`,
  `assurance_level=aal2`, email/username `webmaster@pyrosa.com.do`, and scopes
  `openid profile email profile:read mfa:read`. Token revocation succeeded and
  post-revocation introspection returned inactive.
- The gateway forward-auth pilot endpoint `/oauth/gateway/check` was validated
  fail-closed with HTTP 401 without a session and HTTP 204 for the
  authenticated AAL2 pilot session, including `X-Pyrosa-IAM-*` trusted headers
  plus legacy compatibility headers.
- `pyrosa-iam` is still not promoted as the only SimpleHostMan gate. Authentik
  remains in front of the public SimpleHostMan administrative surface, while the
  native SimpleHostMan OAuth login path can now be exercised against
  `pyrosa-iam` behind that outer gate.
- On 2026-06-10 UTC, the controlled runtime switch was rehearsed on the
  primary:
  - rollback snapshot:
    `/etc/simplehost/rollback/pyrosa-iam-oauth-20260610T014436Z`;
  - `/etc/httpd/conf.d/pyrosa-iam.conf` moved from the HTTP 503 hold to a
    proxy for `http://127.0.0.1:10134`;
  - `/etc/simplehost/control.env` now selects
    `SIMPLEHOST_OAUTH_LOGIN_PROVIDER_SLUG=pyrosa-iam`, issuer
    `https://iam.pyrosa.com.do`, public authorize/logout URLs, and loopback
    token/introspection/revocation URLs;
  - `apachectl configtest`, `httpd` reload and `simplehost-control.service`
    restart succeeded;
  - `https://iam.pyrosa.com.do/.well-known/openid-configuration` returned the
    expected issuer and OAuth/OIDC endpoints;
  - `/auth/pyrosa-iam/start` generated Authorization Code + PKCE with callback
    `https://vps-prd.pyrosa.com.do:3200/auth/pyrosa-iam/callback`.
- The same rehearsal completed an end-to-end browser-like validation without
  exposing secrets:
  - login and TOTP MFA for `webmaster@pyrosa.com.do` completed at
    `iam.pyrosa.com.do`;
  - the SimpleHostMan callback exchanged the code with loopback token and
    introspection endpoints, created `shp_session`, persisted provider metadata
    and redirected to `/`;
  - `/auth/logout` revoked the OAuth access token, revoked the local session,
    cleared local cookies and redirected to `https://iam.pyrosa.com.do/logout`
    with `return_to`;
  - temporarily marking the local operator inactive made the callback fail
    closed with no `shp_session`, then the operator was restored to `active`;
  - audit events include `auth.oauth_login`, `auth.oauth_token_revoked`,
    `auth.logout` and `auth.oauth_callback_rejected` with
    `local_operator_not_active`.
- Forced run `backup-run-7c91dd58-bcdb-4e78-91e0-cbdf19931830` then captured
  the updated root-only IAM config and replicated it to the secondary:
  `/srv/backups/iam/pyrosa-iam/root-config/primary-replicated/pyrosa-iam-root-config-daily-2026-06-10T02-06-37-278Z`.
- Remaining promotion work is now an explicit policy decision: keep Authentik
  as the outer administrative gate, decide whether the
  `control:simplehost-control` `pyrosa-iam/oauth_login` binding should become
  active metadata, and choose the next administrative surface, expected to be
  pgAdmin, for a separate IAM pilot.
- SimpleHostMan source now supports `pyrosa-iam` as the native OAuth login
  provider without changing Authentik or public vhosts:
  - `SIMPLEHOST_OAUTH_LOGIN_PROVIDER_SLUG=pyrosa-iam` selects the
    `/auth/pyrosa-iam/start` and `/auth/pyrosa-iam/callback` web paths plus
    `/v1/auth/pyrosa-iam/oauth-login` and `/v1/auth/pyrosa-iam/oauth-revoke`
    internal API paths.
  - `SIMPLEHOST_OAUTH_PROVIDER_SLUG=pyrosa-iam` is also accepted as a
    compatibility selector when the login-specific variable is not set.
  - Public PKCE clients are supported: `client_secret` is omitted when no
    `SIMPLEHOST_OAUTH_CLIENT_SECRET` or `SIMPLEHOST_OAUTH_CLIENT_SECRET_FILE`
    is configured.
  - The adapter accepts the current IAM fields `aud`, `principal_type` and
    `assurance_level`, and compatibility aliases `audience`,
    `principalType`, `assuranceLevel`, `subject`, `clientId` and `tokenType`.
  - The source-level tests validate the `pyrosa-iam` path and explicitly reject
    the retired `/auth/pyrosa-accounts/*` login path.
- SimpleHostMan release `2606.10.01` was deployed on the primary on
  2026-06-10 UTC with this source support. Health returned version
  `2606.10.01`, and `simplehost-control.service`, `simplehost-worker.service`
  and `simplehost-backup-runner.timer` were active. The live OAuth runtime env
  was later switched to `pyrosa-iam` for the controlled pilot described above;
  Authentik still guards the public SimpleHostMan surface.
- `pyrosa-iam` release `v2606.101205` was published on 2026-06-10 UTC after
  `npm run typecheck`, `npm run test:run` and `npm run build` passed in the
  IAM repository. Runtime smoke checks after the release confirmed:
  - `app-pyrosa-iam.service` active;
  - loopback health returned `{"ok":true,"service":"pyrosa-iam"}`;
  - `/login` served the IAM UI and set the new `PYROSA_IAM_SESSION` cookie
    while still keeping the then-active legacy `PYROSA_ACCOUNTS_SESSION`
    compatibility cookie, before the 2026-06-11 alias-retirement decision;
  - public OIDC discovery returned issuer `https://iam.pyrosa.com.do` with the
    expected authorization, token and JWKS endpoints;
  - the gateway endpoint stayed fail-closed where no valid session was present.
- SimpleHostMan migration `0036_pyrosa_iam_release_candidate_metadata.sql`
  records that release evidence in the IAM provider catalog. The provider and
  SimpleHostMan `oauth_login`, OIDC and gateway bindings stay
  `candidate`/`metadata_only`; Authentik remains the active outer
  administrative gate.
- `pyrosa-iam` release `v2606.102227` was published and deployed on
  2026-06-10 UTC after the IAM console API client moved to the canonical
  `/api/iam/*` namespace. Validation passed `npm run test:run`,
  `npm run build`, `app-pyrosa-iam.service` health, public OIDC discovery,
  public gateway fail-closed behavior, and a browser-like SimpleHostMan
  loopback OAuth login:
  `SimpleHostMan /auth/pyrosa-iam/start -> IAM login -> MFA -> callback`.
  The callback issued `shp_session` and cleared `shp_oauth_login` while
  Authentik remained the public outer gate.
- SimpleHostMan migration `0037_pyrosa_iam_pgadmin_candidate.sql` records
  the `v2606.102227` evidence, keeps SimpleHostMan `pyrosa-iam` bindings
  `candidate`/`metadata_only`, and adds
  `iam-binding-pyrosa-pgadmin-pyrosa-iam-gateway` as the next administrative
  pilot candidate. The pgAdmin binding is metadata-only and does not render
  Apache or change public traffic.
- On 2026-06-11 UTC, the pgAdmin IAM pilot was rehearsed in dry-run only:
  - current direct vhost copied to
    `/etc/simplehost/rollback/pgadmin-iam-dry-run-20260611T072225Z/pyrosa-pgadmin.conf.current`;
  - candidate vhost rendered to
    `/etc/simplehost/rollback/pgadmin-iam-dry-run-20260611T072225Z/pyrosa-pgadmin.pyrosa-iam-gateway.candidate.conf`;
  - the live `pgadmin.pyrosa.com.do` vhost continued proxying directly to
    `http://127.0.0.1:10143/`;
  - `httpd -t` with the candidate include returned `Syntax OK`;
  - the candidate explicitly unsets incoming `X-Pyrosa-IAM-*` and legacy
    `X-Pyrosa-Account(s)-*` headers before proxying;
  - Apache has `proxy`, `headers`, `rewrite`, `ssl` and `lua` modules, but no
    native nginx-style subrequest auth module, so real gateway enforcement
    still needs an Apache bridge/outpost implementation before traffic can be
    cut over.
- The same 2026-06-11 validation confirmed the current public SimpleHostMan
  posture:
  - `https://vps-prd.pyrosa.com.do:3200/` redirects unauthenticated clients to
    the Authentik outpost start URL;
  - `https://vps-prd.pyrosa.com.do:3200/auth/pyrosa-iam/start` is also guarded
    by Authentik at the public edge;
  - loopback `/healthz` returned SimpleHostMan `2606.10.06`;
  - loopback `/auth/pyrosa-iam/start -> IAM login -> MFA -> callback` still
    creates `shp_session` and clears the temporary OAuth cookie, preserving the
    inner Pyrosa IAM pilot behind the Authentik outer gate.
- Decision on 2026-06-11 UTC: because Pyrosa IAM is still in development and
  the dependent apps are being adjusted in the same window, legacy technical
  aliases do not need a telemetry-release grace period. Pyrosa IAM source now
  targets only canonical names:
  - no read/write fallback for `PYROSA_ACCOUNTS_SESSION`;
  - no runtime/script fallback to `PYROSA_ACCOUNTS_*` env names;
  - no browser storage fallback to `pyrosa-accounts-*`;
  - no emitted `X-Pyrosa-Account-*` or `X-Pyrosa-Accounts-*` headers.
  Historical Account Center names, database/API paths still owned by the
  account portal, and archived migration documents remain outside this alias
  retirement.
- `pyrosa-iam` release `v2606.110826` was published and deployed on
  2026-06-11 UTC with the alias retirement. Validation passed:
  - `app-pyrosa-iam.service` active after restart;
  - loopback health returned `{"ok":true,"service":"pyrosa-iam"}`;
  - loopback and public `/login` set only `PYROSA_IAM_SESSION`;
  - loopback `/oauth/gateway/check` failed closed with `401` and only
    `X-Pyrosa-IAM-*` headers;
  - public `/oauth/gateway/check` remained protected by the internal endpoint
    allowlist with `403 oauth_internal_ip_forbidden` and only
    `X-Pyrosa-IAM-*` headers;
  - `https://accounts.pyrosa.com.do/` redirected to `/login`, and
    `/login` redirected to `/auth/iam/start?return_to=%2Fui`; the Account
    Center decommission message was not present.
- On 2026-06-11 UTC, an IAM/DR scratch restore drill validated current
  recoverability without changing live services:
  - Pyrosa IAM root-config archive:
    `/srv/backups/iam/pyrosa-iam/root-config/pyrosa-iam-root-config-daily-2026-06-11T02-05-03-877Z/pyrosa-iam-root-config.tar.gz`;
  - Pyrosa IAM database dump:
    `/srv/backups/databases/pyrosa-iam/pyrosa-iam-database-daily-2026-06-10T02-54-05-604Z/app_pyrosa_iam.dump`;
  - Authentik database/files archive:
    `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-06-11T04-35-04-830Z`;
  - restore scratch:
    `/tmp/simplehostman-iam-dr-drill-20260611T073653Z`;
  - PostgreSQL custom dumps require `/usr/pgsql-18/bin/pg_restore`; the host
    `/usr/bin/pg_restore` from PostgreSQL `16.13` cannot read dump format
    `1.16`;
  - temporary restore databases were created, validated and dropped;
  - Pyrosa IAM restored counts: `account_users=2`, `auth_clients=2`,
    `mfa_methods=6`, `oauth_scopes=9`;
  - Authentik restored counts: `authentik_core_user=3`,
    `authentik_core_application=2`, `authentik_core_provider=2`,
    `authentik_flows_flow=15`;
  - no `drill_*` PostgreSQL databases remained after cleanup.

Historical Accounts OAuth pilot:

- The 2026-06-08 and 2026-06-09 Accounts OAuth pilots validated the original
  service-token, browser Authorization Code, MFA/AAL and fail-closed behavior.
  Those results are preserved only as implementation history.
- As of 2026-06-10, Accounts is not an operational IAM provider. The active
  candidate path is `pyrosa-iam`, using `/auth/pyrosa-iam/*` and
  `/v1/auth/pyrosa-iam/*`; `/auth/pyrosa-accounts/*` is intentionally rejected.
  Accounts remains available as the Account Center portal and delegates user
  login to IAM.
- The historical migrations `0021` through `0029` remain in the schema history
  because they describe the path that led to the split. Migration `0033`
  removes Accounts from the IAM provider catalog. Migration `0034` removed the
  app metadata during the split, and migration `0035` restores that metadata for
  the non-IAM Account Center role.
- OAuth login sessions still store only non-sensitive provider metadata on
  `control_plane_sessions`: provider slug, external subject, assurance level,
  client id, scopes, issuer, and a SHA-256 access-token hash. The raw access
  token is not persisted in PostgreSQL.
- Authentik remains the default provider for administrative proxy surfaces until
  there is an explicit replacement decision.

## Target Architecture

Initial topology:

- Apache remains the public TLS terminator.
- Authentik listens only on local backend ports.
- `auth.pyrosa.com.do` proxies to the Authentik server.
- Protected applications are placed behind an Authentik Proxy Provider and
  outpost flow.
- `code-server` keeps its own password enabled as a second layer during the
  first rollout.
- Root key SSH and the local `code-server` tunnel remain the break-glass path.

Primary runtime components:

- `authentik-server`
- `authentik-worker`
- Authentik embedded outpost or a standalone local-only proxy outpost
- PostgreSQL database `app_authentik`

The official `2026.2.2` Compose file no longer includes Redis. Do not add a
Redis or Valkey dependency unless the reviewed Authentik release explicitly
requires it again.

The preferred database is the platform PostgreSQL app cluster, not a bundled
throwaway database container. If a bundled database is used temporarily during
the first lab run, it must not become the production source of truth.

Recommended host paths:

- storage root: `/srv/containers/iam/authentik`
- secrets: `/etc/simplehost/iam/authentik/`
- Apache vhost: `/etc/httpd/conf.d/pyrosa-authentik.conf`
- systemd/Quadlet units: `/etc/containers/systemd/authentik-*.container`

Secret files must be root-owned and mode `0600`. No generated secret, token,
initial password, recovery code, or database password should be committed.

## Port Plan

Reserve the `10170-10179` range for IAM/SSO surfaces in the Pyrosa family.

Initial reservations:

- `10170`: Authentik server HTTP backend
- `10171`: Authentik proxy outpost for the first protected app, if a standalone
  outpost is used
- `10172`: optional internal health or future outpost backend

These ports should stay bound to `127.0.0.1` only.

## DNS Plan

Planned record:

- `auth.pyrosa.com.do A 51.222.204.86`
- TTL: `300` during rollout

No `www.auth.pyrosa.com.do` alias is required.

Do not publish the record or reconcile the vhost until the local Authentik
health checks pass on the primary node.

## Application Protection Order

Protect applications in this order:

1. `code.pyrosa.com.do`
2. SimpleHostMan operator web surfaces such as `vps-prd.pyrosa.com.do:3200`
   after the `code-server` rollout is stable
3. internal admin apps such as `pgadmin.pyrosa.com.do` and
   `ldap.pyrosa.com.do`
4. selected customer or project apps that need user identity and policy

Do not put WordPress public sites or public marketing pages behind IAM unless
there is an explicit business requirement.

RustDesk note:

- Authentik can protect a future web management surface around RustDesk.
- Authentik should not be placed in the direct `hbbs` or `hbbr` transport path.
- RustDesk server key material and exposed ports remain governed by
  [`RUSTDESK.md`](/opt/simplehostman/src/docs/RUSTDESK.md).

## MFA Policy

Initial Authentik policy:

- local operator users or an operator group only
- username and password
- TOTP MFA required for administrator access
- recovery codes generated and stored outside the browser session
- lockout and rate-limiting enabled before protecting `code-server`

Later options:

- WebAuthn/passkeys for routine operators
- per-app policies for admin tools versus customer apps
- LDAP/OIDC integration if a stable upstream identity provider is selected

## Backup And Restore

Required backup coverage before protecting `code.pyrosa.com.do`:

- PostgreSQL logical backup for `app_authentik`
- Authentik media, blueprints, custom templates and local storage under
  `/srv/containers/iam/authentik`
- root-only secret material under `/etc/simplehost/iam/authentik`
- Apache vhost fragments for `auth.pyrosa.com.do` and protected apps
- Authentik outpost token or deployment secret if a standalone outpost is used

Restore validation before enforcement:

- restore `app_authentik` into a scratch database
- restore Authentik files into a scratch path
- confirm the restored configuration identifies at least the admin flow,
  provider, application and outpost objects
- document the backup run id and restore-test id in
  [`BACKUPS.md`](/opt/simplehostman/src/docs/BACKUPS.md)

## Rollout Phases

### Phase 0: Design And Guardrails

Status: completed in source documentation on `2026-05-02`.

Actions:

- select Authentik as the IAM/SSO product
- exclude SSH from the Authentik scope
- define hostname, port reservations, backup expectations and rollback posture
- document that Authentik is a special IAM stack, not a generic app resource

Validation:

- documentation links from architecture, proxy, hardening and active TODOs
- no live DNS, vhost or `code-server` proxy change yet

### Phase 1: Stage Primary IAM Runtime

Status: completed on primary on `2026-05-02`.

Goal: start Authentik on the primary without protecting any existing app.

Actions:

- create `app_authentik` in the PostgreSQL app cluster
- generate root-only Authentik secret material
- create `/srv/containers/iam/authentik`
- create local-only Quadlet-managed containers for server and worker
- pin the Authentik image version reviewed at implementation time
- keep all services bound to `127.0.0.1`

Validation:

- server and worker containers are healthy
- Authentik can reach PostgreSQL
- local initial setup URL responds through `127.0.0.1:10170`
- `systemctl --failed` remains clean

Rollback:

- stop and disable Authentik units
- leave `code.pyrosa.com.do` unchanged
- preserve secrets and database until explicit cleanup approval

Completion evidence:

- Authentik image pinned to `ghcr.io/goauthentik/server:2026.2.2`, matching the
  current official Compose file reviewed during rollout.
- Source-controlled Quadlet artifacts were added:
  - [`platform/containers/quadlet/authentik-server.container`](/opt/simplehostman/src/platform/containers/quadlet/authentik-server.container)
  - [`platform/containers/quadlet/authentik-worker.container`](/opt/simplehostman/src/platform/containers/quadlet/authentik-worker.container)
  - [`platform/containers/env/authentik.env.example`](/opt/simplehostman/src/platform/containers/env/authentik.env.example)
- Live Quadlet units were installed under `/etc/containers/systemd/`.
- Root-only runtime environment is stored at
  `/etc/simplehost/iam/authentik/authentik.env` with mode `0600`.
- Persistent runtime paths were created under `/srv/containers/iam/authentik`.
- PostgreSQL app database `app_authentik` and role `app_authentik` were created
  on the app cluster.
- `authentik-server.service` and `authentik-worker.service` are active.
- `app_authentik` has Authentik schema state after initial migrations.
- `http://127.0.0.1:10170/` returns `302`.
- `http://127.0.0.1:10170/if/flow/initial-setup/` returns `200`.
- `10170/tcp` listens only on `127.0.0.1`.
- `https://code.pyrosa.com.do/login` continued to return `200` through the
  existing direct vhost.
- No live DNS, Apache vhost, public `auth.pyrosa.com.do`, or
  `code.pyrosa.com.do` proxy change was applied in this phase.

### Phase 2: Publish `auth.pyrosa.com.do`

Status: published on `2026-05-02`; admin TOTP MFA and recovery codes are
enrolled.

Goal: expose only the Authentik login/admin surface.

Actions:

- add the `auth.pyrosa.com.do` DNS record
- create the Apache TLS vhost for `auth.pyrosa.com.do`
- complete initial admin setup
- enable the initial MFA policy
- document the recovery and break-glass procedure

Validation:

- `https://auth.pyrosa.com.do/` reaches Authentik
- `webmaster@pyrosa.com.do` exists as an active superuser with a usable password
- `/if/flow/initial-setup/` is blocked at Apache after bootstrap
- admin TOTP MFA is enrolled
- recovery codes are registered before the first protected app is enforced
- logout and session expiry work
- no existing app vhost is changed

Rollback:

- remove or disable the `auth.pyrosa.com.do` vhost
- stop Authentik units if needed
- keep existing app vhosts untouched

Completion evidence:

- DNS desired state now includes `auth.pyrosa.com.do A 51.222.204.86` with
  TTL `300`.
- DNS sync completed on the primary and secondary authoritative nodes.
- Both authoritative nodes answer `auth.pyrosa.com.do` as `51.222.204.86`.
- Source-controlled Apache vhost:
  [`platform/httpd/vhosts/pyrosa-authentik.conf`](/opt/simplehostman/src/platform/httpd/vhosts/pyrosa-authentik.conf)
- Live Apache vhost:
  `/etc/httpd/conf.d/pyrosa-authentik.conf`
- `apachectl -t` returned `Syntax OK`; Apache was reloaded.
- `https://auth.pyrosa.com.do/` returns `302` to the default Authentik
  authentication flow with a valid wildcard `pyrosa.com.do` certificate.
- `https://auth.pyrosa.com.do/if/flow/initial-setup/` returns `403`.
- `authentik-server.service`, `authentik-worker.service`, and `httpd` are
  active.
- `10170/tcp` remains bound only to `127.0.0.1`.
- After operator password rotation, the temporary initial-password file
  `/etc/simplehost/iam/authentik/akadmin-initial-password` was removed.
- Live bootstrap password/email values were removed from
  `/etc/simplehost/iam/authentik/authentik.env`, which remains mode `0600`.
- `webmaster@pyrosa.com.do` has one confirmed TOTP authenticator.
- `webmaster@pyrosa.com.do` has one confirmed static/recovery-code
  authenticator with ten one-time tokens.
- The recovery codes are stored in the root-only file
  `/etc/simplehost/iam/authentik/recovery-codes-webmaster-pyrosa-20260502.txt`
  with mode `0600`.
- `code.pyrosa.com.do` was not changed in this phase.

### Phase 3: Backup Policy And Restore Test

Status: completed on `2026-05-02` through SimpleHostMan backup policy
`iam-authentik-primary-daily`.

Goal: make IAM recoverable before enforcing it.

Actions:

- add a SimpleHostMan backup policy for Authentik files and secrets
- add logical backup coverage for `app_authentik`
- run a scratch restore test
- document artifacts and cleanup evidence

Validation:

- backup runs complete with `succeeded`
- scratch restore can read Authentik state
- no secret values are printed or committed

Rollback:

- disable the Authentik backup policy only if it is noisy or excessive
- keep service runtime unchanged

Completion evidence:

- SimpleHostMan worker supports the dedicated selectors `iam:authentik` and
  `host-service:authentik`.
- Backup policy:
  - slug: `iam-authentik-primary-daily`
  - target node: `primary`
  - schedule: `35 4 * * *`
  - retention: `14` days
  - storage: `/srv/backups/iam/authentik/primary`
  - selectors: `iam:authentik`, `host-service:authentik`
- Forced backup run:
  `backup-run-f1cd328b-92db-4959-8721-d15565922056`
- Artifacts:
  - `authentik-files.tar.gz`
  - `app_authentik.dump`
  - `postgresql-apps-globals.sql`
  - `manifest.json`
- Artifact mode: `0600`.
- Restore test `20260502T062345Z` restored `app_authentik` into scratch
  database `restoretest_authentik_20260502t062345z` and validated:
  - `212` public tables
  - `3` users
  - `1` confirmed TOTP device
  - `1` confirmed static/recovery-code device
  - `10` static/recovery-code tokens
- The file archive restored expected Authentik config, recovery-code, data,
  certificate, and template paths into a scratch directory.
- Scratch database, staging directory, and scratch file target were removed.
- No secret values were printed or committed.

### Phase 4: Protect `code.pyrosa.com.do`

Status: completed on the primary on `2026-05-02`.

Goal: require Authentik MFA before Apache reaches the local `code-server`
backend.

Actions:

- create Authentik application and Proxy Provider for `code.pyrosa.com.do`
- configure the embedded or standalone outpost
- update the `code.pyrosa.com.do` Apache vhost to route through the Authentik
  proxy path
- keep `code-server` own password enabled

Validation:

- unauthenticated browser requests are redirected to Authentik
- authenticated operator with MFA reaches `code-server`
- `/outpost.goauthentik.io/ping` behaves as expected for the chosen outpost
- root SSH tunnel break-glass still reaches local `code-server`
- direct node-name `:8080` public access remains closed

Rollback:

- restore the previous `code.pyrosa.com.do` vhost that proxies directly to
  `127.0.0.1:8080`
- reload Apache
- leave Authentik running for investigation unless it is the outage source

Completion evidence:

- Authentik group `PYROSA Operators` was created and
  `webmaster@pyrosa.com.do` was added.
- Authentik authentication flow `pyrosa-authentication-mfa-required` was
  created with MFA validation set to deny users that have no MFA device.
- Authentik Brand `pyrosa.com.do` was created for Pyrosa-owned subdomains:
  - title: `PYROSA`
  - logo media: `pyrosa/logo-transp-white.png`
  - favicon media: `pyrosa/favicon.ico`
  - authentication flow: `pyrosa-authentication-mfa-required`
  - brand CSS hides the flow footer links, including `Powered by authentik`,
    centers the login title/header, and tightens the logo-to-title spacing
- The `pyrosa-authentication-mfa-required` flow title was updated to
  locale-neutral `PYROSA`.
- Authentik Proxy Provider `code.pyrosa.com.do` was created in `proxy` mode:
  - external host: `https://code.pyrosa.com.do`
  - internal host: `http://host.containers.internal:18080`
  - authorization flow: `default-provider-authorization-implicit-consent`
- The provider internal host uses the Podman host alias because the embedded
  outpost runs inside the Authentik container; `127.0.0.1` there is the
  container itself, not the SimpleHostMan host.
- Source-controlled internal Apache bridge:
  [`platform/httpd/vhosts/pyrosa-code-internal-bridge.conf`](/opt/simplehostman/src/platform/httpd/vhosts/pyrosa-code-internal-bridge.conf)
- Live internal Apache bridge:
  `/etc/httpd/conf.d/pyrosa-code-internal-bridge.conf`
- The bridge listens on `10.88.0.1:18080`, allows only the Podman subnet, and
  proxies to the local `code-server` backend on `127.0.0.1:8080`.
- SELinux port label: `18080/tcp` is registered as `http_port_t` for the
  internal Apache listener.
- Authentik application `code-pyrosa` was created and restricted to
  `PYROSA Operators`.
- The embedded outpost now includes provider `code.pyrosa.com.do`.
- Source-controlled Apache vhost:
  [`platform/httpd/vhosts/pyrosa-code.conf`](/opt/simplehostman/src/platform/httpd/vhosts/pyrosa-code.conf)
- Live Apache vhost:
  `/etc/httpd/conf.d/pyrosa-code.conf`
- Rollback vhost copy:
  `/root/simplehost-rollbacks/pyrosa-code-direct-20260502T063848Z.conf`
- `apachectl -t` returned `Syntax OK`; Apache was reloaded.
- Validation from the primary public address:
  - `https://code.pyrosa.com.do/` returns `302` to the Authentik outpost start
    path.
  - `https://code.pyrosa.com.do/login` returns `302` to the Authentik outpost
    start path.
  - `https://code.pyrosa.com.do/outpost.goauthentik.io/start?...` returns
    `302` to `https://auth.pyrosa.com.do/application/o/authorize/...`.
  - `https://code.pyrosa.com.do/outpost.goauthentik.io/ping` returns `204`.
- `https://auth.pyrosa.com.do/` still returns `302`.
- `https://auth.pyrosa.com.do/flows/-/default/authentication/?next=/`
  redirects to `/if/flow/pyrosa-authentication-mfa-required/?next=%2F`.
- `https://auth.pyrosa.com.do/if/flow/initial-setup/` still returns `403`.
- `https://auth.pyrosa.com.do/if/flow/pyrosa-authentication-mfa-required/`
  renders with `<title>PYROSA</title>`, Pyrosa media-backed logo/favicon, and
  no static `Welcome to authentik!` or `Powered by authentik` text.
- The login title/header is centered by the Brand custom CSS.
- The Brand custom CSS reduces logo-to-title spacing by lowering the logo
  header bottom padding and the title header top padding.
- The flow executor API reports title `PYROSA`.
- The flow executor API returned the same locale-neutral title with
  `Accept-Language` set to `en`, `es`, and `fr`.
- Break-glass local backend check:
  `http://127.0.0.1:8080/login` still returns `200`.
- Internal bridge checks:
  - `http://10.88.0.1:18080/login` returns `200`.
  - `http://host.containers.internal:18080/login` returns `200` from inside
    the Authentik container.
- Authenticated browser traffic after the bridge correction returned `200` for
  code-server pages and `101` for WebSocket upgrade requests through the bridge.
- `authentik-server.service`, `authentik-worker.service`,
  `simplehost-worker.service`, and `httpd` remained active.
- A post-enforcement forced backup succeeded:
  `backup-run-3db0fd3e-7651-402a-b7d4-deb894c7195e`.
- A post-bridge-correction forced backup succeeded:
  `backup-run-846c771e-a73b-48ea-9153-babc69eccbf6`.
- Post-bridge-correction backup directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T06-58-38-417Z`
- A post-branding forced backup succeeded:
  `backup-run-0cb8786b-47f7-4a80-bc56-bfa1e7de299f`.
- Post-branding backup directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T07-13-23-428Z`
- A post-title-adjustment forced backup succeeded:
  `backup-run-02e1fc98-1798-4be7-8504-f9a8c3c42430`.
- Post-title-adjustment backup directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T07-17-03-754Z`
- A post-centered-title forced backup succeeded:
  `backup-run-b3f8ac07-9a0e-4131-96ee-79a3e4f0e678`.
- Post-centered-title backup directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T07-26-10-550Z`
- A post-login-spacing forced backup succeeded:
  `backup-run-1d00efaa-e832-41db-82a5-22b8ce75c57b`.
- Post-login-spacing backup directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T07-29-56-575Z`
- The post-enforcement backup restored into scratch database
  `restoretest_authentik_phase4_20260502t0643z` and validated:
  - `1` `code-pyrosa` application
  - `1` `https://code.pyrosa.com.do` proxy provider
  - `1` embedded-outpost/provider link
  - `1` MFA-required validation stage
- Scratch database and temporary dump copy were removed.
- No secret values were printed or committed.

### Phase 5: Protect SimpleHostMan Operator UI

Status: primary operator UI and trusted proxy session handoff completed on
`2026-05-02`; secondary node-name UI remains direct while Authentik is held
inactive on the standby.

Goal: reuse IAM only where it improves administrative safety.

Actions:

- create Authentik application and Proxy Provider for
  `https://vps-prd.pyrosa.com.do:3200/`
- restrict the application to `PYROSA Operators`
- add a host-internal Apache bridge for the embedded Authentik outpost
- update the primary `:3200` Apache vhost to route through Authentik
- add a SimpleHostMan trusted-proxy session handoff so successful Authentik
  MFA creates the local `shp_session` cookie for existing active operators
- keep `http://127.0.0.1:3200/` as the local break-glass route

Validation:

- unauthenticated public requests redirect to the Authentik outpost
- `/outpost.goauthentik.io/ping` returns healthy status
- the embedded outpost can reach the host-internal bridge
- Authentik-forwarded web `GET` requests from the loopback bridge create a
  SimpleHostMan session for an existing active user matching
  `x-authentik-email`
- API requests and unsafe web methods do not create sessions from trusted
  proxy headers
- the local control-panel backend remains available on `127.0.0.1:3200`
- secondary Authentik stays in hold mode and the secondary direct UI is
  unchanged

Rollback:

- restore the previous direct `simplehost-control.conf` vhost from
  `/root/simplehost-rollbacks/simplehost-control-direct-20260502T081000Z.conf`
- reload Apache
- leave the Authentik provider/application in place unless it is causing
  follow-on issues

Completion evidence:

- Authentik Proxy Provider `simplehost-control` was created in `proxy` mode:
  - external host: `https://vps-prd.pyrosa.com.do:3200`
  - internal host: `http://host.containers.internal:13200`
  - authorization flow: `default-provider-authorization-implicit-consent`
- Authentik application `simplehost-control` was created and restricted to
  `PYROSA Operators`.
- The embedded outpost now includes provider `simplehost-control`.
- Source-controlled Apache vhost:
  [`platform/httpd/vhosts/simplehost-control.conf`](/opt/simplehostman/src/platform/httpd/vhosts/simplehost-control.conf)
- Source-controlled internal Apache bridge:
  [`platform/httpd/vhosts/simplehost-control-internal-bridge.conf`](/opt/simplehostman/src/platform/httpd/vhosts/simplehost-control-internal-bridge.conf)
- Live Apache vhost:
  `/etc/httpd/conf.d/simplehost-control.conf`
- Live internal Apache bridge:
  `/etc/httpd/conf.d/simplehost-control-internal-bridge.conf`
- The bridge listens on `10.88.0.1:13200`, allows only the Podman subnet, and
  proxies to the local SimpleHostMan backend on `127.0.0.1:3200`.
- SELinux port label: `13200/tcp` is registered as `http_port_t` for the
  internal Apache listener.
- Rollback vhost copy:
  `/root/simplehost-rollbacks/simplehost-control-direct-20260502T081000Z.conf`
- `apachectl -t` returned `Syntax OK`; Apache was reloaded.
- Primary validation:
  - `http://127.0.0.1:3200/` returned `200`
  - `http://10.88.0.1:13200/` returned `200`
  - `http://host.containers.internal:13200/` returned `200` from inside the
    Authentik container
  - `https://vps-prd.pyrosa.com.do:3200/` returned `302` to
    `/outpost.goauthentik.io/start?...`
  - `https://vps-prd.pyrosa.com.do:3200/outpost.goauthentik.io/ping` returned
    `204`
  - `httpd`, `authentik-server`, `authentik-worker`, and
    `simplehost-control` remained active
- SimpleHostMan release `2605.02.05` supports Authentik trusted-proxy SSO:
  - Authentik identity headers are accepted only from loopback/internal bridge
    traffic
  - only existing active SimpleHostMan users can receive a local session; there
    is no automatic user creation
  - unprovisioned or inactive SSO identities receive a SimpleHostMan-owned
    `403` page without the dashboard sidebar, with the SSO email shown and a
    `Cerrar sesion SSO` action that points at the Authentik outpost sign-out
    path
  - successful trusted logins are audited as `auth.trusted_proxy_login`
  - local simulation of an Authentik-forwarded `GET /login` returned `303`,
    redirected to `/`, and set a redacted `shp_session` cookie
  - the same trusted request through `host.containers.internal:13200` from
    inside the Authentik container returned `303` and set a redacted session
    cookie
  - following the redacted cookie to `/` returned `200` and did not render the
    internal operator login form
  - `GET /v1/auth/me` with the same Authentik headers, but without a bearer
    session, still returned `401`
  - the latest trusted login audit event recorded
    `auth.trusted_proxy_login` for `webmaster@pyrosa.com.do`
  - local and Authentik-container simulations for an unprovisioned SSO email
    returned `403`, rendered `Acceso no provisionado`, did not set
    `shp_session`, and included the Authentik outpost sign-out link
  - SimpleHostMan logout now clears `shp_session` and, when the request carries
    Authentik SSO headers, redirects to
    `/outpost.goauthentik.io/sign_out?rd=%2Flogin` so the Authentik outpost can
    invalidate the external SSO session before the next login attempt
- Secondary validation:
  - `http://127.0.0.1:3200/` returned `200`
  - `https://vps-des.pyrosa.com.do:3200/` returned `200`
  - `authentik-server` and `authentik-worker` remained inactive
  - `/etc/simplehost/iam/authentik/SECONDARY_PROMOTED` remained absent
- A post-SimpleHostMan-protection forced backup succeeded:
  `backup-run-a04e1e3d-1b7b-400e-98a2-0ce7a8658931`.
- Post-SimpleHostMan-protection backup directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T08-16-02-907Z`
- Automatic replication closeout backup directory:
  `/srv/backups/iam/authentik/primary/iam-authentik-primary-daily-2026-05-02T15-23-41-791Z`
- No secret values were printed or committed.

Future candidates:

- `pgadmin.pyrosa.com.do`
- `ldap.pyrosa.com.do`
- selected internal Pyrosa apps

Non-candidates by default:

- SSH
- RustDesk transport ports
- public WordPress sites
- public package repository traffic on `repos.pyrosa.com.do`

### Phase 6: Secondary And Disaster Recovery

Status: completed in conservative standby mode on `2026-05-02`.

Goal: define the passive-node IAM posture after the primary rollout is stable.

Selected posture:

- Authentik runs on the primary only during normal operation.
- The secondary node-name SimpleHostMan UI remains a direct standby/operator
  route during normal operation. It does not need a separate IAM design unless
  a future requirement asks for secondary-node IAM after a promoted DR test.
- The secondary carries restored Authentik files, secrets, media, vhosts,
  Quadlet units and the pinned container image, but the services remain
  inactive.
- Secondary Authentik units have a systemd hold:
  [`platform/host/systemd/authentik-secondary-standby-hold.conf`](/opt/simplehostman/src/platform/host/systemd/authentik-secondary-standby-hold.conf).
  They will not start unless
  `/etc/simplehost/iam/authentik/SECONDARY_PROMOTED` exists.
- The secondary `app_authentik` database is supplied by the PostgreSQL apps
  physical standby. The logical `app_authentik.dump` backup remains the
  fallback if a fresh restore is required instead of standby promotion.

Promotion outline:

1. Confirm the primary is intentionally out of service or stopped for IAM.
2. Promote the secondary PostgreSQL apps cluster and confirm
   `pg_is_in_recovery()` returns `f` on port `5432`.
3. Confirm `/etc/simplehost/iam/authentik/authentik.env` points to
   `AUTHENTIK_POSTGRESQL__HOST=10.89.0.2`.
4. Release the hold:

   ```bash
   touch /etc/simplehost/iam/authentik/SECONDARY_PROMOTED
   systemctl start authentik-server authentik-worker
   ```

5. Repoint `auth.pyrosa.com.do` and protected app hostnames such as
   `code.pyrosa.com.do` to the secondary public address.
6. Validate the Authentik login flow, the embedded outpost ping and the
   protected app.

Rollback before promotion:

- leave the hold marker absent
- keep `authentik-server` and `authentik-worker` inactive
- restore the previous secondary direct `code.pyrosa.com.do` vhost from
  `/root/simplehost-rollbacks/pyrosa-code-secondary-direct-20260502T074400Z.conf`
  if direct secondary code-server exposure is needed again

Do not enable automatic IAM failover before database and persistent file
behavior is explicitly tested.

Completion evidence:

- Latest Authentik backup seed replicated to the secondary during the initial
  standby staging:
  `/srv/backups/iam/authentik/primary-replicated/iam-authentik-primary-daily-2026-05-02T15-23-41-791Z`
- Secondary restored root-only Authentik config/runtime paths:
  - `/etc/simplehost/iam/authentik`
  - `/srv/containers/iam/authentik`
- Secondary `authentik.env` was adjusted for the local standby node with
  `AUTHENTIK_POSTGRESQL__HOST=10.89.0.2`.
- Secondary Pyrosa logo and favicon media were present after restore.
- Secondary Quadlet units were installed but left inactive:
  - `/etc/containers/systemd/authentik-server.container`
  - `/etc/containers/systemd/authentik-worker.container`
- Secondary hold drop-ins were installed:
  - `/etc/systemd/system/authentik-server.service.d/10-secondary-standby-hold.conf`
  - `/etc/systemd/system/authentik-worker.service.d/10-secondary-standby-hold.conf`
- Secondary Authentik image `ghcr.io/goauthentik/server:2026.2.2` was pulled.
- Secondary vhosts were aligned to primary standby shape:
  - `/etc/httpd/conf.d/pyrosa-authentik.conf`
  - `/etc/httpd/conf.d/pyrosa-code.conf`
  - `/etc/httpd/conf.d/pyrosa-code-internal-bridge.conf`
- Secondary SELinux `http_port_t` includes `18080/tcp` for the internal
  code-server bridge.
- Secondary Apache returned `Syntax OK`, `httpd` is active and there are no
  failed systemd units.
- Secondary `postgresql@apps` remains in recovery and contains
  `app_authentik`.
- Secondary `auth.pyrosa.com.do` and `code.pyrosa.com.do` return `503` with
  `--resolve` while Authentik is intentionally held inactive.
- Primary `auth.pyrosa.com.do` and `code.pyrosa.com.do` still return `302`,
  and primary Authentik services remain active.

Secondary dry-run validation on `2026-05-02`:

- DNS posture:
  - `auth.pyrosa.com.do` and `code.pyrosa.com.do` point to primary
    `51.222.204.86`.
  - secondary is reachable as `vps-des.pyrosa.com.do`
    (`51.222.206.196`).
- Service posture:
  - `/etc/simplehost/iam/authentik/SECONDARY_PROMOTED` is absent.
  - `authentik-server` and `authentik-worker` are inactive on the secondary.
  - `httpd`, `simplehost-control` and `simplehost-agent` are active on the
    secondary.
  - `simplehost-worker` remains intentionally inactive on the secondary.
  - `systemctl --failed` reported `0` failed units.
- Artifact posture:
  - Authentik Quadlet units, hold drop-ins, root-only env, runtime directory,
    vhosts and pinned image are present on the secondary.
  - `/etc/simplehost/iam/authentik/authentik.env` remains mode `600` and points
    to `AUTHENTIK_POSTGRESQL__HOST=10.89.0.2`.
  - `/srv/containers/iam/authentik` remains mode `700`.
  - `apachectl -t` returned `Syntax OK`.
- Data and backup posture:
  - secondary `postgresql@apps` reports `pg_is_in_recovery() = true`.
  - secondary `app_authentik` database exists.
  - latest replicated Authentik backup seed is present under
    `/srv/backups/iam/authentik/primary-replicated/iam-authentik-primary-daily-2026-05-02T15-23-41-791Z`.
  - replicated backup artifacts are present with root-only `600` permissions:
    `app_authentik.dump`, `authentik-files.tar.gz`, `manifest.json` and
    `postgresql-apps-globals.sql`.
- HTTP posture:
  - `auth.pyrosa.com.do` resolved to secondary with `--resolve` returns `503`.
  - `code.pyrosa.com.do` resolved to secondary with `--resolve` returns `503`.
  - `https://vps-des.pyrosa.com.do:3200/` returns `200` as the direct standby
    operator route.
  - primary `auth.pyrosa.com.do` and `code.pyrosa.com.do` return `302`.

## Operational Hold Points

These hold points were satisfied before the `2026-05-02` phase 4 enforcement.
Do not protect any later app until the equivalent rollback and recovery
conditions are true for that app:

- Authentik admin login requires MFA.
- A root-key SSH break-glass path is tested.
- The previous direct `code.pyrosa.com.do` vhost is saved for rollback.
- Authentik backup and restore have been validated.
- The operator can recover or reset MFA without using the browser path being
  protected.
