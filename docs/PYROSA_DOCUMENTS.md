# Pyrosa Documents: managed catalog and backups

Verified: 2026-09-17. Owner: SimpleHostMan for catalog and backup execution;
Documents/Platform retain application runtime and physical-schema ownership.

Update at 12:36 UTC: [primary-local backup policy](BACKUP_LOCAL_ONLY_POLICY.md)
disables secondary artifact copies by user decision. Both new Documents runs
succeeded locally without replication. Earlier failures below remain historical;
local success does not establish off-host recovery or encrypted-blob restore.

## Catalog adoption

Native migration `0051_pyrosa_documents_managed_catalog.sql` registers:

- app `pyrosa-documents`, tenant `pyrosa`, node `primary`, no standby;
- site `documents.pyrosa.com.do`, backend `10180`;
- storage root `/srv/containers/apps/pyrosa-documents`;
- PostgreSQL database `app_pyrosa_documents`, service role
  `app_pyrosa_documents_service`, without copying a desired password;
- mode `metadata-only`, following the existing IAM/Accounts contract.

This is explicit catalog DML, not a generic container, proxy or database
reconcile. Do not dispatch database reconcile, add a desired password, or switch
mode to active-passive to complete this enrollment. The private Node Quadlet,
image digest, ingress, credentials and application schemas are unchanged.
Automatic proxy/container plans skip metadata-only apps. Physical application
DDL remains owned by Platform.

The migration is transactional, checks conflicts rather than overwriting
existing resources, and records `app.catalog.adopted` in the audit ledger.
Replay preserves timestamps and audit cardinality. Reversal requires a new
reviewed catalog migration: preserve backup artifacts, run history and audit;
do not erase the migration ledger or rerun an edited historical migration.

## Backup policies

| Policy | Schedule UTC | Selector | Storage |
| --- | --- | --- | --- |
| `pyrosa-documents-database-daily` | 03:10 daily | `database:app_pyrosa_documents` | `/srv/backups/databases/pyrosa-documents` |
| `pyrosa-documents-files-daily` | 03:20 daily | `app-files:pyrosa-documents` | `/srv/backups/apps/pyrosa-documents` |

Both inherit the current Pyrosa posture: 14 local days and 1 replica day,
always protecting the newest generation. Minutes match the five-minute runner.
The existing runner discovers these policies from PostgreSQL; no release or
service restart is necessary. See [backup contracts](BACKUPS.md).

The file selector archives the managed root, excluding runtime logs according
to the runner. It does not archive `/etc` credentials or establish independent
key recovery. Future encrypted blobs must live within the covered root, or the
policy must explicitly cover their actual root before ingestion is enabled.
Two separate scheduled jobs do not establish transactional metadata/blob
consistency: a governed quiesce/capture/restore drill remains required.

## Applied evidence

- Native migration applied at `2026-09-17T12:03:04Z`; all 50 previous migration
  checksums matched. Real-schema rehearsal rolled back before apply.
- 60 control-database tests passed; isolated PostgreSQL test verifies adoption,
  unchanged replay and seven conflicting-state rollbacks:
  `node scripts/control/test-documents-catalog.mjs`.
- App/site/database and two policies present; no desired database credential.
- Forced runs at `2026-09-17T12:03:36Z` generated a 459,917-byte custom database
  dump and a 20,648,027-byte file archive, with manifests and mode 0600.
  PG18 TOC readability and gzip integrity passed; this is not a restore drill.
- Both runs remain **failed** because remote directory creation returned
  `No space left on device`. Do not relabel them successful or disable
  replication to conceal the error. Local artifacts remain available.
- Documents health remains 200, build `fc636dbb59fb.8b70f64f3a17`, ingestion/OCR
  disabled. No runtime promotion, restart, key enrollment or application DDL.

## Secondary capacity review — no cleanup performed

The secondary root filesystem is 199 GiB at 100%, with about 28 KiB free;
inodes are 98% used. A retention preview found 25 backup sets with only one
protected newest run each and no expired older candidates. Never delete those
last copies or manually prune pgBackRest chains.

Read-only size inventory identified:

- MariaDB root: about 87 GiB, including 72 binary logs (71.09 GiB) and their
  72 index files; these are not disposable without replication/PITR checks.
- PostgreSQL: about 38 GiB; apps data 32 GiB (31 GiB relation data, only
  129 MiB WAL). Old `data.stale-*` and pre-upgrade roots total about 4.6 GiB;
  labels alone do not authorize their deletion.
- Backups: about 42 GiB; app roots about 11 GiB.
- SimpleHostMan releases: about 397,000 inodes in five installed releases;
  active secondary release is `2608.19.15`. Review rollback requirements before
  considering removal of inactive releases.

No deliberate purge, log rotation, restart or backup deletion was executed.
Podman's read-only inventory command reported its own cleanup of an incomplete
image layer; no image-prune command was invoked. MariaDB replication positions
were not established: native purge eligibility and reclaimable space are not
yet proven. Next step is an explicitly approved bounded maintenance operation,
or storage expansion; keep backups marked degraded until replica and restore
verification succeed.
