# Bootstrap Material

This directory is reserved for bootstrap and recovery material for the unified
source workspace.

Path:

- `/opt/simplehostman/src/bootstrap`

There is no longer a source-controlled application inventory in this directory.
The former bootstrap catalog was retired on `2026-05-02` after the control-plane
desired state moved fully into PostgreSQL tables named `control_plane_*`.

Day-to-day desired state is authoritative in PostgreSQL through `SimpleHostMan`.
Operators should change resources through the control-plane UI/API or explicit
database migrations.

When a YAML artifact is needed for audit, review, or disaster recovery, export
the current PostgreSQL catalog from the control plane instead of treating a repo
file as a source of truth:

- `GET /v1/resources/spec`
- `GET /v1/inventory/export`

Historical bootstrap/import details are preserved in the migration documents
under `/opt/simplehostman/src/docs/MIGRATIONS` and in
`/opt/simplehostman/src/docs/CONTROL_PLANE_DESIRED_STATE.md`.
