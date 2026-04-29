# Control API Entrypoint

This directory contains the current API entrypoint for the unified control-plane app.

Path:

- `/opt/simplehostman/src/apps/control/api`

Current role:

- serve `/v1/*`
- expose control-plane HTTP endpoints
- own auth, sessions, API routing, and request handling for the control plane

This entrypoint remains separate as a source boundary inside `apps/control`.
Common process and runtime helpers now live in `/opt/simplehostman/src/apps/control/shared`.
The packaged runtime default is now the combined control-plane process serving both UI and API; this API entrypoint remains useful for split-mode validation and diagnostics.
