# Shared Packages

This directory contains the canonical shared libraries for the unified SimpleHost source workspace.

Path:

- `/opt/simplehostman/src/packages`

## Runtime package groups

Control runtime packages:

- `control-config`
- `control-contracts`
- `control-database`
- `control-testing`
- `ui`

Agent runtime packages:

- `agent-contracts`
- `agent-control-plane-client`
- `agent-drivers`
- `agent-runtime-config`
- `agent-renderers`
- `agent-testing`

These names are now the canonical monorepo boundaries for shared runtime code.

## Ownership rules

- keep shared logic here, not in `apps/*`
- prefer explicit product-neutral boundaries where possible
- do not reintroduce dependencies on legacy source roots or retired repo-era paths
- keep UI primitives, contracts, persistence, renderers, drivers, config, and testing helpers buildable from this workspace alone
