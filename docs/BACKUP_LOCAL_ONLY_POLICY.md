# Primary-local backups; database replication remains configured

Decision and verification: 2026-09-17.

This operator decision supersedes the earlier primary-to-secondary backup-copy
posture in [BACKUPS.md](BACKUPS.md). It does not change database replication,
delete backup generations, or treat a database replica as a backup.

## Effective settings

- Primary `/etc/simplehost/worker.env`:
  `SIMPLEHOST_BACKUP_REPLICATION_ENABLED=false`. This disables generic artifact
  transfer and remote retention, even while the old destination remains named.
- Primary `/etc/simplehost/pgbackrest-offhost.env`:
  `SIMPLEHOST_PGBACKREST_OFFHOST_TARGET=`. The sync script now exits disabled,
  including direct/manual invocation with the usual environment file.
- Primary `simplehost-pgbackrest-offhost-sync.timer`: disabled and inactive.
- Secondary `simplehost-backup-runner.timer`, both apps/control pgBackRest
  full/incremental timers, and offhost-sync timer: disabled and inactive.
  These were already disabled and were explicitly reconfirmed/persisted.
- Primary backup-runner and apps/control full/incremental pgBackRest timers
  remain enabled and active; local retention is unchanged.

No policy row or run history was deleted. The secondary code-server policy
remains in the catalog for history, but its runner is not scheduled. This is
a scheduler/runtime policy, not a new per-policy `enabled` database field.
An explicit manual backup command is still possible; do not execute it on the
secondary under this posture. Installers must preserve these node-specific
timer settings rather than enabling every packaged timer.

## Verification

- The installed pgBackRest sync script's `--dry-run` returned disabled before
  opening source/target repositories.
- Forced primary-local Documents database/files backups at 12:36 UTC both
  succeeded, with two artifacts each and no replication details.
- Prior failed attempts at 12:03 UTC remain failed in the history.
- Primary environment file permissions remain root:root 0640. Private preimages
  and prior secondary timer states are retained under
  `/root/backup-policy-local-only.d25xpC`; never publish environment contents.
- No database service restart, replication credential, slot, GTID, WAL/archive
  configuration, database data, or existing backup artifact was changed.

## Replication health is a separate incident

Preserving configuration does not establish healthy replication. At inspection,
secondary PostgreSQL apps/control services had failed on 2026-09-16 at
22:45/22:49 UTC. Both primary physical slots were inactive; no WAL sender was
connected. The secondary root remains 100% full (about 28 KiB available).
MariaDB's service was running, but thread health could not be established:
Podman metadata inspection failed with ENOSPC. Do not claim healthy databases
from the active service label alone.

Stopping future backup copies does not free existing space or repair these
conditions. Recovery needs a separately scoped capacity/remediation operation.
Do not reset replicas, purge logs, remove slots, or delete old backups merely
because backup transmission was disabled.

## Protection and rollback

There are now no fresh backup copies on the secondary from these mechanisms.
Primary-local backups cannot protect against loss of the primary host/disk;
database replication also propagates logical deletions/corruption. Documents'
independent recovery gate remains open until a separate approved destination
and a real restore are verified.

To resume copy, first approve a destination and verify capacity. Restore only
the two reviewed environment settings (not entire stale env files), then enable
the primary offhost timer and validate artifact checksums/restore. To resume
secondary-local generation, explicitly approve its role and enable only the
required timers. No runtime/source deployment was needed for this change.
