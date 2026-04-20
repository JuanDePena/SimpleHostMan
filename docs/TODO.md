# SimpleHost TODO

Updated on `2026-04-20`.

This file tracks work that is still open after the current monorepo, naming, and runtime cutover work.
Closed work should stay documented as implemented state elsewhere, not linger here.

Current baseline:

- canonical source tree: `/opt/simplehostman/src`
- canonical runtime root: `/opt/simplehostman/release`
- active release: `2604.20.03`
- active services: `simplehost-control`, `simplehost-worker`, `simplehost-agent`

## 1. Deepen diagnostics, jobs, audit, and backups

- Keep improving cross-links between resources, jobs, drift, audit, nodes, and backup runs.
- Make backup policies and failures more operational from the UI, not only visible.
- Keep pushing resource detail views toward one-place operational diagnosis.
- Continue deepening mail deliverability, queue visibility, and post-cutover operator tracing now that the phase-1 mail execution backend is in place.

## 2. Keep shrinking transitional bootstrap state

- Continue reducing the daily operational role of YAML bootstrap and import paths.
- The bootstrap inventory lives in [`/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml`](/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml).
- Keep reducing its day-to-day role in favor of PostgreSQL desired state plus controlled import and export flows.
