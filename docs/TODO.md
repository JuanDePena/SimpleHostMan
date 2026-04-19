# SimpleHost TODO

Updated on `2026-04-19`.

This file tracks work that is still open after the current monorepo, naming, and runtime cutover work.
Closed work should stay documented as implemented state elsewhere, not linger here.

Current baseline:

- canonical source tree: `/opt/simplehostman/src`
- canonical runtime root: `/opt/simplehostman/release`
- active release: `2604.19.12`
- active services: `simplehost-control`, `simplehost-worker`, `simplehost-agent`

## 1. Finish promoting the combined control runtime from “candidate” to canonical runtime

- The live control plane already runs as one combined runtime on `127.0.0.1:3200`.
- `healthz`, parts of the docs, and parts of the source tree still describe that runtime as `combined-candidate` or as a transitional candidate.
- Remove that ambiguity so the deployed runtime, documentation, health metadata, and release language all agree on what is actually in production-like use.

## 2. Plan the PostgreSQL upgrade path

- The deployed PostgreSQL runtime is currently `16.13`.
- The documented target policy is PostgreSQL `18.x`.
- Plan and document a safe upgrade path for both `postgresql-apps` and `postgresql@control`, including backup, rollback, failover, and validation steps.

## 3. Finish real per-action diffs in `SimpleHost Control`

- Move from comparison summaries to field-accurate diffs before `dns.sync`, `proxy.render`, `database reconcile`, and destructive operations.
- Keep those previews tied to the actual last applied or effective runtime state, not only to desired state.

## 4. Deepen diagnostics, jobs, audit, and backups

- Keep improving cross-links between resources, jobs, drift, audit, nodes, and backup runs.
- Make backup policies and failures more operational from the UI, not only visible.
- Keep pushing resource detail views toward one-place operational diagnosis.

## 5. Keep shrinking transitional bootstrap state

- Continue reducing the daily operational role of YAML bootstrap and import paths.
- The bootstrap inventory lives in [`/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml`](/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml).
- Keep reducing its day-to-day role in favor of PostgreSQL desired state plus controlled import and export flows.

## 6. Finish the mail execution backend from the documented design

- The target mail architecture is documented in [`/opt/simplehostman/src/docs/MAIL.md`](/opt/simplehostman/src/docs/MAIL.md).
- `SimpleHost Control` desired-state objects, operator CRUD, `mail.sync` dispatching, baseline DNS derivation, and `webmail.<domain>` proxy scaffolding are already in place.
- `SimpleHost Agent` already renders node-local `Postfix`, `Dovecot`, and `Rspamd` artifacts, prepares mailbox and webmail roots, generates DKIM material, and `adudoc.com` is seeded as the first pilot mail domain.
- Remaining work is now operational productization: install and enable `Postfix`, `Dovecot`, `Rspamd`, and `Redis` through the platform, replace the `Roundcube` placeholder with a real deployment, add firewall policy, add credential reset and set flows, add mailbox migration runbooks, improve deliverability diagnostics, and deepen operator-facing tracing.
