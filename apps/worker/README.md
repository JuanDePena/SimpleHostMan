# Worker App

`apps/worker` is the canonical source location for SimpleHost background job execution.

Current root:

- `/opt/simplehostman/src/apps/worker`

Responsibilities:

- asynchronous control-plane jobs
- reconciliation and planner execution
- background operational work that should not run in the request path
- compiled backup-cycle entrypoint used by the root-owned backup timer/runtime

This app remains operationally separate from `apps/control` even after the source migration.
