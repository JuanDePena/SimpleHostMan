# Mail Service Architecture

Date drafted: 2026-04-11
Target OS: AlmaLinux 10.1

## Scope

This runbook documents the target mail architecture for the two-node SimpleHost platform.

It defines the intended split of responsibilities for:

- SMTP ingress and submission
- IMAP mailbox access
- mailbox storage and quota handling
- per-tenant webmail through `Roundcube`
- spam filtering and DKIM signing
- mailbox failover boundaries
- the future control-plane split between `SHP` and `SHM`

This document is a design and operational target.
It does not imply that mail execution is already deployed in phase 1.

Related references:

- [`/opt/simplehostman/src/docs/ARQUITECTURE.md`](/opt/simplehostman/src/docs/ARQUITECTURE.md)
- [`/opt/simplehostman/src/docs/DNS.md`](/opt/simplehostman/src/docs/DNS.md)
- [`/opt/simplehostman/src/docs/HARDENING.md`](/opt/simplehostman/src/docs/HARDENING.md)
- [`/opt/simplehostman/src/docs/REPO_LAYOUT.md`](/opt/simplehostman/src/docs/REPO_LAYOUT.md)
- [`/opt/simplehostman/src/apps/control/README.md`](/opt/simplehostman/src/apps/control/README.md)

## Status on 2026-04-11

- Mail execution is not yet deployed as a complete live runtime on the nodes.
- `SHP` already implements desired-state objects and operator CRUD for mail domains, mailboxes, aliases, and quotas.
- `SHP` reconciliation now derives baseline mail DNS and `webmail.<domain>` proxy scaffolding.
- `SHM` already accepts `mail.sync`, persists node-local desired state, prepares mail storage paths, generates DKIM material, renders node-local `Postfix`, `Dovecot`, and `Rspamd` artifacts, and reports mail runtime health back to `SHP`.
- The currently implemented runtime is still incomplete operationally: mail services are not yet installed and activated by the platform, and `Roundcube` content is still a placeholder rather than a live webmail deployment.
- The chosen direction is self-hosted mail on the two VPS nodes, not a third-party hosted mail backend.
- The selected persistence model is filesystem-backed mailbox storage, not message storage inside `PostgreSQL`.
- `adudoc.com` is seeded as the first pilot mail domain, with `webmaster@adudoc.com` and `notificaciones@adudoc.com` rendered on both nodes in `reset_required` credential state until passwords are set manually.

## Design goals

- Keep `SHP` as the authoritative source of truth for mail domains, mailboxes, aliases, quotas, policies, and audit intent.
- Keep runtime mail delivery on the nodes simple, explicit, and recoverable.
- Support initial low-volume migrations such as `adudoc.com` without painting the platform into a corner for larger domains later.
- Avoid storing message bodies in `PostgreSQL`.
- Keep mailbox storage compatible with standard `IMAP` tooling and standard migration tools.
- Fit the platform's existing active/passive failover model.
- Keep webmail separate from mailbox storage so it can be replaced later without moving messages.

## Selected platform

Target mail stack:

- `Postfix` for inbound and outbound SMTP
- `Dovecot` for `IMAP`, `LMTP`, auth, quota, and mailbox access
- `Maildir` on the filesystem for mailbox persistence
- `Rspamd` for spam filtering, reputation, and DKIM signing
- `Redis` as supporting state for `Rspamd` when filtering features require it
- `Roundcube` as a per-tenant webmail surface published on `webmail.<domain>`

Why this stack was selected:

- It uses standard, well-understood mail components.
- It keeps message persistence in files instead of inventing a custom SQL mail store.
- It scales better operationally than a `PostgreSQL`-backed message design for large message volume.
- It preserves compatibility with `IMAP` migration tools and standard mailbox inspection workflows.
- It lets `SHP` own the desired-state model without forcing mail daemons to query `SHP` directly at runtime.

## Persistence model

### Source of truth

`SHP PostgreSQL` should store the desired-state model for mail:

- `MailDomain`
- `Mailbox`
- `MailAlias`
- `MailboxQuota`
- credential references or managed password-hash metadata
- policy toggles such as suspend or unsuspend, catch-all policy, and deliverability posture
- audit events for mailbox lifecycle changes

`SHP PostgreSQL` should not store:

- message bodies
- MIME attachments
- live `IMAP` indexes
- live SMTP spool state

### Mailbox storage

Mailbox persistence should use `Maildir` under host-managed storage.

Recommended host path:

- `/srv/mail/vmail/<domain>/<mailbox>/Maildir`

Recommended companion paths:

- `/srv/mail/indexes/` only if a later index separation is justified
- `/srv/mail/sieve/<domain>/<mailbox>/` for future user rules if `Pigeonhole` is enabled

Why `Maildir` is the selected baseline:

- Standard format for `Dovecot`
- Easy to inspect and back up
- Safe for concurrent delivery and read workloads
- Good fit for targeted mailbox restore
- Compatible with `doveadm backup`, `dsync`, and common migration tooling

Accepted `Maildir` tradeoffs:

- Many small files
- Higher inode pressure than a packed single-file store
- Metadata-heavy behavior on very large folders

These tradeoffs are acceptable for the current platform.
If future very large tenants show pathological `Maildir` behavior, evaluate `mdbox` explicitly as a later architecture revision.
Do not switch to a SQL message store to solve that problem.

### Roundcube persistence

`Roundcube` should use its own application database, separate from `SHP`.

Recommended engine:

- `PostgreSQL` on the `postgresql-apps` cluster

Recommended database:

- `platform_roundcube`

That database stores only webmail metadata such as:

- preferences
- address books
- identities
- session-like or cache-like webmail state as required by the application

It must not be treated as the authoritative message store.

## Runtime split between `SHP` and `SHM`

### `SHP`

`SHP` owns:

- mail-domain and mailbox desired-state objects
- mailbox aliases and quota policy
- credential lifecycle workflows
- operator API and UI
- audit trail
- delivery and trace visibility when that feature is added

`SHP` should not be queried directly by `Postfix` or `Dovecot` for each live auth or lookup.

### `SHM`

`SHM` owns:

- rendering runtime config files for `Postfix`, `Dovecot`, `Rspamd`, and related helpers
- placing local keys, maps, and passwd files on the node
- installing or restarting mail services
- collecting local runtime health and exposing it back to `SHP`

Preferred runtime pattern:

- `SHP` desired state
- `SHM` renders node-local artifacts
- mail daemons read local generated files

Avoid:

- direct runtime coupling from mail daemons to `SHP PostgreSQL`

## Runtime service placement

### Host-native services

Keep these host-native:

- `Postfix`
- `Dovecot`
- `Rspamd`
- `Redis` when required by `Rspamd`

Reasons:

- simpler boot ordering
- simpler privileged port handling
- simpler queue and mailbox path ownership
- less complexity around TLS and host identity

### Containerized webmail

`Roundcube` should be deployed behind host-native Apache, but published per tenant domain.

Recommended placement:

- one logical `Roundcube` deployment per active node, with separate per-tenant document roots
- proxied by Apache like other platform web workloads
- backed by its own `PostgreSQL` database

Recommended host path:

- `/srv/www/roundcube/<tenant>/<domain>/public`

Recommended public hostname model:

- `webmail.<domain>`

Current scaffolding direction:

- `SHP` derives `proxy.render` jobs for `webmail.<domain>`
- `SHM` prepares the corresponding document roots under `/srv/www/roundcube`
- until real `Roundcube` content is deployed, those roots may contain a placeholder page proving that the vhost path exists

Current rendered runtime artifacts:

- `/srv/mail/config/postfix/vmail_domains`
- `/srv/mail/config/postfix/vmail_mailboxes`
- `/srv/mail/config/postfix/vmail_aliases`
- `/srv/mail/config/postfix/main.cf.generated`
- `/srv/mail/config/dovecot/passwd`
- `/srv/mail/config/dovecot/conf.d/90-simplehost-mail.conf`
- `/srv/mail/config/rspamd/dkim_selectors.map`
- `/srv/mail/config/rspamd/local.d/redis.conf`
- `/srv/mail/config/rspamd/local.d/dkim_signing.conf`
- `/srv/mail/dkim/<domain>/<selector>.key`
- `/srv/mail/dkim/<domain>/<selector>.dns.txt`

Current credential behavior:

- when a mailbox is created without a desired password, `SHM` renders it locally in locked/reset-required form
- the current pilot intentionally uses that mode so the first credential establishment remains manual

## Mail routing model

### Inbound mail

Recommended flow:

1. public SMTP on `25/tcp` hits `Postfix`
2. `Postfix` hands mail through `Rspamd`
3. accepted mail is delivered to `Dovecot LMTP`
4. `Dovecot` writes to `Maildir`

### Outbound mail

Recommended flow:

1. authenticated client or `Roundcube` submits through `587/tcp`
2. `Postfix` authenticates through `Dovecot`
3. `Rspamd` signs mail with DKIM and applies outbound policy
4. `Postfix` delivers outward

### Mailbox access

Recommended access:

- `IMAPS` on `993/tcp`
- submission on `587/tcp`
- optional `ManageSieve` on `4190/tcp` only after sieve support is added

Do not prioritize:

- plaintext `IMAP` on `143/tcp`
- `POP3`
- legacy unauthenticated submission patterns

## Credential model

Mailbox credentials should be managed by `SHP`, but runtime auth should use rendered local artifacts.

Recommended pattern:

- `SHP` stores password-hash metadata or secret references
- `SHM` renders a local `Dovecot` passwd file or equivalent auth map
- `Postfix` uses local lookup tables for domains, aliases, and mailbox routing

Hard rules:

- do not keep plaintext mailbox passwords in git
- do not expose mailbox passwords back through the UI after creation or reset
- avoid making `Dovecot` depend on live database queries to `SHP`

## Recommended generated runtime artifacts

Examples of node-local generated artifacts:

- `/etc/postfix/vmail_domains`
- `/etc/postfix/vmail_mailboxes`
- `/etc/postfix/vmail_aliases`
- `/etc/dovecot/passwd`
- `/etc/dovecot/conf.d/`
- `/etc/rspamd/local.d/`

These files are machine-generated, node-local, and recoverable from desired state.
They are not authoritative data stores.

## DNS model

### Service identity

Do not keep mail tied to the apex record.

Preferred mail identity per customer domain:

- `mail.<domain>` as the stable mail host
- `MX` records point to `mail.<domain>`

Example:

```dns
adudoc.com.      300 MX   10 mail.adudoc.com.
mail.adudoc.com. 300 A    <active-node-ip>
```

This avoids coupling web cutovers and mail cutovers to the same apex `A` record.

### Minimum DNS records

Per domain, the baseline should include:

- `MX`
- `A` or `AAAA` for `mail.<domain>`
- `A` or `AAAA` for `webmail.<domain>`
- `TXT` SPF
- `TXT` `_dmarc`

Optional later:

- `autoconfig.<domain>`
- `autodiscover.<domain>`
- `TXT` DKIM selector records once key generation is wired end-to-end
- SRV records if a chosen client profile needs them
- `MTA-STS`, `TLS-RPT`, or `DANE` once the rest of the stack is mature enough

Current scaffolding state:

- `SHP` now derives `MX`, `mail.<domain>`, `webmail.<domain>`, SPF, and `_dmarc` for the active mail node
- operator-managed explicit zone records remain authoritative when they intentionally override those derived records
- `SHM` now generates DKIM private/public material and a DNS TXT payload per domain selector under `/srv/mail/dkim/<domain>/`

### DKIM

DKIM signing should be handled by `Rspamd`.

Recommended key path model:

- `/etc/rspamd/dkim/<domain>/<selector>.key`

The public key must be surfaced into the zone through desired state and DNS sync.

## Firewall and exposure policy

Recommended public ports on the active mail node:

- `25/tcp` inbound SMTP
- `587/tcp` submission
- `993/tcp` IMAPS

Optional later:

- `465/tcp` for implicit TLS submission if required
- `4190/tcp` for `ManageSieve`

Do not expose publicly unless there is a clear reason:

- `143/tcp`
- `110/tcp`
- `995/tcp`
- admin protocols on public addresses

Webmail remains on the existing Apache public plane:

- `443/tcp` via `webmail.<domain>`

## Availability model

Mail should follow the same baseline as the rest of the platform:

- active on the primary node
- warm standby on the secondary node
- manual failover only

Do not run both nodes as equal-priority public `MX` targets during the initial design.

Reasons:

- the platform is active/passive by design
- split delivery and partial mailbox replication are risky
- a passive node should not silently become an active mailbox writer without explicit promotion

### Replication

Mailbox replication should use `Dovecot dsync`, not raw file sync as the primary strategy.

Recommended direction:

- primary node as the writable source
- secondary node as the passive replica
- scheduled replication plus an explicit final sync before promotion

What should replicate:

- mailbox contents
- mailbox metadata relevant to `Dovecot`
- sieve files once enabled

What should not be treated as authoritative replicated state:

- active `Postfix` queue
- `Rspamd` reputation cache
- transient `Redis` state

### Failover boundary

In a promotion event:

1. stop inbound delivery on the failed or retiring primary if possible
2. run a final mailbox sync if the source is still reachable
3. promote the secondary mail services
4. repoint `mail.<domain>` to the promoted node
5. keep `MX` pointing to `mail.<domain>` so clients do not need a record change
6. confirm `IMAP`, submission, and SMTP ingress on the promoted node

## Backups

Minimum backup scope:

- `/srv/mail/vmail/`
- `/etc/postfix/`
- `/etc/dovecot/`
- `/etc/rspamd/`
- DKIM keys
- `Roundcube` database
- `Roundcube` app configuration

Backups must allow:

- full-domain restore
- single-mailbox restore
- point-in-time restore of webmail metadata when feasible

The passive node is not a backup substitute.

## Logging, traceability, and future `SHP` visibility

Future `SHP` mail operations should expose:

- queue visibility
- recent delivery attempts
- authentication failures
- mailbox suspension state
- DKIM, SPF, and DMARC posture
- audit events for account lifecycle changes

Recommended raw sources:

- `Postfix` logs
- `Dovecot` logs
- `Rspamd` history and metrics
- mailbox quota usage data

`SHP` should ingest summarized operational state.
It should not become the primary raw message-log store.

## Security boundaries

- Keep mail credentials scoped per mailbox.
- Keep DKIM private keys only on the nodes that sign mail.
- Require TLS for client auth paths.
- Keep webmail isolated from direct mailbox storage except through `IMAP` and submission.
- Treat outbound relay reputation as a platform concern, not a tenant concern.

## Migration policy from cPanel mail

Preferred migration sequence per domain:

1. create the mail domain and mailboxes in `SHP`
2. render and deploy runtime config on the active node
3. create `mail.<domain>` and move `MX` away from the apex if needed
4. copy mailbox contents from the legacy host
5. verify `IMAP` login and message visibility
6. cut SMTP delivery to the new node
7. keep the old host available until late-arriving mail risk is acceptable

For low-volume domains this can be a short maintenance window.
For larger-volume domains, keep the overlap window longer and validate queue behavior before decommissioning the old host.

## Implementation order

Recommended rollout order:

1. finalize this architecture and desired-state model
2. add `MailDomain`, `Mailbox`, `MailAlias`, and quota objects to `SHP`
3. add `mail.sync`, node runtime reporting, baseline DNS derivation, and `webmail.<domain>` proxy scaffolding
4. add `SHM` renderers and drivers for `Postfix`, `Dovecot`, `Rspamd`, `Redis`, and mail firewall policy
5. deploy per-tenant `Roundcube` content on the prepared `webmail.<domain>` roots
6. validate one low-volume domain migration end-to-end
7. add richer deliverability, traceability, and audit views in `SHP`

## Non-goals for the first mail execution phase

- storing email messages in `PostgreSQL`
- active/active shared-write mailbox delivery across both nodes
- automatic two-node mail failover
- public `POP3` support
