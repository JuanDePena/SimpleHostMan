# Control Scripts

This subtree contains the legacy control-plane operational scripts that still
back the unified release workflow.

Path:

- `/opt/simplehostman/src/scripts/control`

Typical responsibilities:

- bootstrap
- release build and install
- deploy and rollback
- public web configuration
- migration helpers

`configure-pyrosa-iam-gateway-trust.sh` provisions the dedicated forward-auth
v2 trust material under `/etc/pyrosa-iam/secrets`, wires the IAM Quadlet and
all installed gateway bridges to the same root-only EnvironmentFile, preserves
the previous runtime configuration under `/etc/pyrosa-iam/backups`, and is
idempotent. It never prints the generated secret and does not restart services;
the controlled promotion performs those restarts after source validation.

These scripts now build from the unified source workspace and target `/opt/simplehostman/release` as the normalized runtime root.
