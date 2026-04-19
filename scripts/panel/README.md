# Control Scripts

This subtree contains the legacy control-plane operational scripts that still
back the unified release workflow.

Path:

- `/opt/simplehostman/src/scripts/panel`

Typical responsibilities:

- bootstrap
- release build and install
- deploy and rollback
- public web configuration
- migration helpers

These scripts now build from the unified source workspace and target `/opt/simplehostman/release` as the normalized runtime root.
