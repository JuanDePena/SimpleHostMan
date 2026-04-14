# Agent App

`apps/agent` is the canonical source location for the node-local execution agent.

Current root:

- `/opt/simplehostman/src/apps/agent`

Responsibilities:

- claiming jobs from the control plane
- rendering local artifacts
- applying node-local changes
- reporting execution status and health back to the control plane

This app is intentionally separate from `apps/control` and remains node-local.
