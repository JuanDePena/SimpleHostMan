# Repository and Directory Layout

Date drafted: 2026-03-11
Updated: 2026-04-14
Target OS: AlmaLinux 10.1

## Scope

This document defines the canonical source layout for the unified SimpleHost workspace and the current boundaries around source, runtime, and packaging material.

## Canonical paths

- workspace root: `/opt/simplehostman`
- source workspace root: `/opt/simplehostman/src`
- shared docs root: `/opt/simplehostman/src/docs`
- bootstrap inventory: `/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml`
- runtime and release root: `/opt/simplehostman/release`

## Top-level layout

The current canonical top-level layout is:

```text
/opt/simplehostman
  /src
    /apps
    /packages
    /platform
    /bootstrap
    /packaging
    /scripts
    /docs
  /release
    /releases
    /shared
```

Meaning:

- `src/` is the canonical source workspace
- `release/` is the neutral runtime root reserved for the later runtime/release migration phase

## Canonical source layout

```text
/opt/simplehostman/src
  /apps
    /control
      /api
      /web
    /worker
    /agent
    /cli
  /packages
    /control-config
    /control-contracts
    /control-database
    /control-testing
    /ui
    /agent-contracts
    /agent-control-plane-client
    /agent-drivers
    /agent-runtime-config
    /agent-renderers
    /agent-testing
  /platform
  /bootstrap
  /packaging
    /env
    /systemd
    /httpd
    /postgresql
    /rpm
  /scripts
    /control
    /agent
  /docs
```

## App ownership

### `apps/control`

Path:

- `/opt/simplehostman/src/apps/control`

Responsibility:

- unified source ownership for UI and API
- transitional internal separation between `shared/`, `web/`, `api/`, and a combined entrypoint candidate under `src/`
- current combined candidate already supports one-process routing for UI and `/v1/*` at the source level
- current combined candidate is also exercised by source-level routing tests before any runtime cutover
- eventual target is one control-plane runtime and one port

### `apps/worker`

Path:

- `/opt/simplehostman/src/apps/worker`

Responsibility:

- background jobs
- planners and reconciliation loops
- asynchronous control-plane execution

### `apps/agent`

Path:

- `/opt/simplehostman/src/apps/agent`

Responsibility:

- node-local execution
- rendering and apply logic
- runtime status and health reporting

### `apps/cli`

Path:

- `/opt/simplehostman/src/apps/cli`

Responsibility:

- local operator tooling
- break-glass maintenance commands

## Package ownership

### Control runtime packages

- `control-config`
- `control-contracts`
- `control-database`
- `control-testing`
- `ui`

### Agent runtime packages

- `agent-contracts`
- `agent-control-plane-client`
- `agent-drivers`
- `agent-runtime-config`
- `agent-renderers`
- `agent-testing`

These names are now the canonical package boundaries inside `src/packages/*`.

## Non-app source trees

### `platform`

Path:

- `/opt/simplehostman/src/platform`

Contains:

- host templates
- container templates
- Apache templates
- DNS templates
- database templates
- WireGuard templates

### `bootstrap`

Path:

- `/opt/simplehostman/src/bootstrap`

Contains:

- bootstrap inventory and import/export seed material

### `packaging`

Path:

- `/opt/simplehostman/src/packaging`

Current structure:

- `/opt/simplehostman/src/packaging/env`
- `/opt/simplehostman/src/packaging/systemd`
- `/opt/simplehostman/src/packaging/httpd`
- `/opt/simplehostman/src/packaging/postgresql`
- `/opt/simplehostman/src/packaging/rpm`

Runtime-facing packaging now uses `simplehost-control`, `simplehost-worker`, `simplehost-agent`, `simplehost-control.spec`, and `simplehost-agent.spec`, while the directory layout stays unified by artifact type.

### `scripts`

Path:

- `/opt/simplehostman/src/scripts`

Current transitional split:

- `/opt/simplehostman/src/scripts/control`
- `/opt/simplehostman/src/scripts/agent`

These scripts now belong to the unified source tree even if many remain product-owned in behavior.

### `docs`

Path:

- `/opt/simplehostman/src/docs`

Contains:

- architecture guides
- operational runbooks
- migration plans
- shared UI guidance
- TODO tracking

## Former split roots

The former split control-plane and agent source trees have already been absorbed into `/opt/simplehostman/src` and removed from the live workspace.

Historical references may still appear in migration notes, but they are no longer live workspace inputs.

## Runtime and release direction

Current runtime normalization target:

```text
/opt/simplehostman/release
  /releases
    /<version>
  /shared
```

Notes:

- this root has already been reserved in the filesystem
- final release structure is a later migration phase
- imported control/agent packaging and deploy scripts may still reflect runtime-specific assumptions and should be treated as transitional until runtime migration is executed

## Rules

- Keep canonical source in `/opt/simplehostman/src`.
- Keep shared docs in `/opt/simplehostman/src/docs`.
- Do not reintroduce repo-era source roots as active inputs.
- Do not reintroduce old split runtime roots as canonical paths.
- Keep mutable runtime state outside the source tree.
- Keep runtime migration separate from source migration.

## Current transition direction

The source-unification phase is complete:

1. `/opt/simplehostman/src` is the only canonical source tree
2. the former split roots have been absorbed and removed
3. `control`, `worker`, `agent`, and shared packages now build from one workspace

Current work is no longer monorepo migration. It is runtime refinement:

1. harden `apps/control` as the single control-plane runtime boundary
2. keep `worker` and `agent` independently deployable
3. continue normalizing release and cutover flows under `/opt/simplehostman/release`

## Ownership quick references

- `/opt/simplehostman/src/apps/control/README.md`
- `/opt/simplehostman/src/apps/control/api/README.md`
- `/opt/simplehostman/src/apps/control/web/README.md`
- `/opt/simplehostman/src/apps/control/shared/README.md`
- `/opt/simplehostman/src/apps/control/src/README.md`
- `/opt/simplehostman/src/apps/worker/README.md`
- `/opt/simplehostman/src/apps/agent/README.md`
- `/opt/simplehostman/src/apps/cli/README.md`
- `/opt/simplehostman/src/packages/README.md`
- `/opt/simplehostman/src/platform/README.md`
- `/opt/simplehostman/src/bootstrap/README.md`
- `/opt/simplehostman/src/packaging/README.md`
- `/opt/simplehostman/src/scripts/README.md`
