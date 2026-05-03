# Worker App

`apps/worker` is the canonical source location for SimpleHost background job execution.

Current root:

- `/opt/simplehostman/src/apps/worker`

Responsibilities:

- asynchronous control-plane jobs
- reconciliation and planner execution
- automatic operational history cleanup
- background operational work that should not run in the request path
- compiled backup-cycle entrypoint used by the root-owned backup timer/runtime

The worker keeps agent job polling separate from reconciliation cadence:
`SIMPLEHOST_WORKER_POLL_INTERVAL_MS` still controls node poll hints, while
`SIMPLEHOST_WORKER_RECONCILE_INTERVAL_MS` controls the periodic background
reconciliation loop and defaults to five minutes. Operators can still run an
immediate reconciliation from the Control plane Reconciliation view.

History cleanup is also worker-owned. `SIMPLEHOST_HISTORY_RETENTION_DAYS`
controls how many days of audit, reconciliation and completed job rows are kept,
while `SIMPLEHOST_HISTORY_PURGE_INTERVAL_DAYS` controls how often the worker
runs the automatic purge. Both values are UI-managed parameters in the
Parameters view by default.

This app remains operationally separate from `apps/control` even after the source migration.
