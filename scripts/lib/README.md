# Scripts Library

Shared helpers for the unified source workspace live here.

Current helpers:

- `workspace-paths.sh`: resolves the canonical workspace root, normalized release root, workspace version, and transitional runtime entrypoint paths.

Panel and manager release/bootstrap scripts should source this library instead of re-deriving `/opt/simplehostman/src` or `/opt/simplehostman/release` independently.
