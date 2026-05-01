# Bootstrap Inventory

This directory contains bootstrap and seed material for the unified source workspace.

Path:

- `/opt/simplehostman/src/bootstrap`

Primary file:

- `/opt/simplehostman/src/bootstrap/apps.bootstrap.yaml`

This tree remains useful as seed material for controlled import and disaster recovery.

Day-to-day desired state is now authoritative in PostgreSQL through `SimpleHostMan`.
When operators need a YAML artifact, they should prefer exporting the current resource catalog from the control plane instead of treating this file as the live source of truth.

Application database inventory may use either the legacy singular `database`
field or the plural `databases` field. Use `databases` whenever an application
owns more than one managed database, and keep the first entry as the runtime
primary database consumed by generic container rendering. Secondary databases
must carry explicit stable ids such as `database-pyrosa-sync-qbo` so bootstrap
replay does not collide with the primary `database-<app>` resource id.
