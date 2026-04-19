# Agent Scripts

This subtree contains the legacy agent operational scripts that still back the
unified release workflow.

Path:

- `/opt/simplehostman/src/scripts/manager`

Typical responsibilities:

- bootstrap
- release build and install
- deploy and rollback
- bundle assembly
- runtime image helpers

These scripts now build from the unified source workspace and target `/opt/simplehostman/release` as the normalized runtime root.
