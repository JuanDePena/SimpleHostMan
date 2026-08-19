# Governed Storage Maintenance

Date introduced: 2026-07-21
Last updated: 2026-08-19

## Scope

SimpleHostMan owns the host-level inventory and bounded cleanup of reconstructible
storage. The maintenance cycle is intentionally narrower than `podman system
prune` and does not replace application retention, backup policies, pgBackRest,
`systemd-tmpfiles`, logrotate, or Platform recovery governance.

Canonical implementation:

- worker library: `apps/worker/src/storage-maintenance.ts`
- CLI entrypoint: `apps/worker/src/storage-maintenance-cycle.ts`
- service: `packaging/systemd/simplehost-storage-maintenance.service`
- timer: `packaging/systemd/simplehost-storage-maintenance.timer`
- configuration example: `packaging/env/simplehost-storage-maintenance.env.example`
- latest report: `/var/lib/simplehost/storage-maintenance/latest.json`

## Safety Contract

The command is read-only unless `--apply` is explicitly supplied. Even in apply
mode it skips cleanup unless all of these conditions are true:

1. the root filesystem is at or above the configured high watermark;
2. no Genesis, release installation, deployment, or backup cycle is active;
3. the systemd `flock` lock is available.

Apply order:

1. remove eligible old SimpleHostMan releases;
2. remeasure the root filesystem;
3. prune only Podman images unused by every container and older than the
   configured minimum age, and only if usage remains above the target watermark.

The cycle never prunes containers or volumes. It never deletes backups or
Platform Genesis recovery evidence.

Default thresholds:

- high watermark: `85%`;
- target watermark: `80%`;
- protected latest releases: `5`;
- minimum release age: `7` days;
- minimum unused-image age: `168` hours.

The active release, explicitly pinned releases, releases referenced by shared
release metadata, and the latest-N releases are always protected.

## Overlay And Shared-Memory Mounts

`df` lists one Podman `overlay` mount for every running container. Each row
reports the capacity and consumption of the backing filesystem; the rows are
not independent allocations and must not be added together.

Container `shm` mounts are memory-backed `tmpfs` filesystems. Their displayed
64 MB size is a limit, not preallocated disk consumption. Neither active
`overlay` nor `shm` mountpoints should be manually unmounted or removed.

Use this view for physical capacity:

```bash
df -hT -x overlay -x tmpfs -x devtmpfs
```

Use Podman's own accounting for reclaimable container storage:

```bash
podman system df
podman system check --quick
```

Run `podman system check --repair` only in a separate maintenance window after
reviewing a failed consistency report.

## Backup Ownership And Pyrosa Sync

Backup deletion remains owned by the SimpleHostMan backup runner and pgBackRest:

- policy artifacts: `simplehost-backup-runner.timer`;
- PostgreSQL physical backups and WAL: pgBackRest timers and expiry;
- the storage-maintenance cycle: inventory and capacity reporting only.

Since 2026-08-19, `simplehost-backup-retention.timer` applies desired-state
logical-backup retention every day independently of whether a new backup was
created. The newest local and replica generation is always protected. This
closes the accumulation gap caused by a failed or skipped scheduled backup.
pgBackRest expiry remains internal to pgBackRest and is monitored separately by
`simplehost-pgbackrest-health.timer`.

Policies support separate local and replica retention. A null replica value
inherits the local retention for compatibility. The `db-pyrosa-sync-daily`
policy uses:

- local retention: `7` days;
- replicated retention: `7` days.

This bounds the current full logical dumps on both capacity-constrained nodes.
The backup runner applies each retention window only after a successful run and
completed replication.

## Platform Genesis Recovery

`/var/lib/pyrosa-platform/genesis-recovery` is a separate encrypted filesystem
owned by Platform recovery policy. SimpleHostMan reports its utilization and
snapshot count but does not delete from it.

Any rotation must be made by Platform with knowledge of the sealed preview,
authorization receipt, active execution, recovery expiry, and most recent
complete snapshot. A SimpleHostMan cycle detects active Genesis process names
and skips all apply work.

On 2026-07-21 repeated failed Genesis attempts filled this filesystem while the
root filesystem still had about 20 GB available. After confirming no Genesis
process was active, duplicate failed-attempt snapshots and one partial snapshot
were removed. The preview-linked snapshot from `09:33 UTC` and the last complete
snapshot from `11:29 UTC` were preserved; utilization fell from `100%` to `35%`.

The private Genesis wrapper also performs a capacity preflight before stopping
NewSync. It requires enough free space for the latest complete C8 snapshot plus
the larger of 128 MiB or 20% of the dedicated recovery filesystem. A failed
capacity gate exits before backup capture or the AAL2 authorization ceremony.

## Initial rollout evidence

Release `2607.21.12` introduced independent local and replica retention on both
nodes on 2026-07-21. Release `2607.21.13` incorporated migration `0049`, which
homologated `db-pyrosa-sync-daily` to 7 days on both nodes.

The first governed apply produced these results:

- primary: one old release removed (about 648 MB); Podman storage check and
  image prune completed successfully; root remained near 94% because backup
  retention deliberately stayed under the backup runner;
- secondary: 11 old releases removed (about 4.89 GB) plus unused image layers;
  available root capacity increased from about 6.7 GB to 13.4 GB;
- primary: 38 running containers, 38 overlay mounts and 38 `shm` mounts;
- secondary: 27 running containers, 27 overlay mounts and 27 `shm` mounts;
- neither node attempted backup or Genesis recovery deletion.

The 7-day local Pyrosa Sync retention takes effect after the next successful
scheduled or forced backup and completed replication. Until then, the existing
14 local generations remain visible and the primary root filesystem can remain
above the maintenance high watermark.

## Operation

Read-only inspection from the active release:

```bash
node /opt/simplehostman/release/current/apps/worker/dist/storage-maintenance-cycle.js \
  --dry-run --json
```

Governed manual apply:

```bash
systemctl start simplehost-storage-maintenance.service
systemctl status simplehost-storage-maintenance.service
journalctl -u simplehost-storage-maintenance.service --since today
```

Timer inspection:

```bash
systemctl list-timers simplehost-storage-maintenance.timer
systemctl cat simplehost-storage-maintenance.service
systemctl cat simplehost-storage-maintenance.timer
```

The timer runs daily at `07:15 UTC`, after logical-backup retention and outside
the normal full pgBackRest start times, with up to 20 minutes of randomized
delay. `Persistent=true` allows a missed run to be evaluated after boot. It is
enabled on both nodes, including the passive node where the control and backup
worker timers remain disabled.

Capacity, backup retention, pgBackRest, and log-health controls are documented
in [`STORAGE_RESILIENCE.md`](/opt/simplehostman/src/docs/STORAGE_RESILIENCE.md).

## Validation

Before enabling the timer on a node:

1. run `--dry-run --json`;
2. verify the active release is protected;
3. verify candidate releases are outside the latest and pinned sets;
4. compare running container and overlay counts;
5. verify `backups.deletionAttempted` and `recovery.deletionAttempted` are
   `false`;
6. test apply mode below the high watermark and confirm it reports `skipped`;
7. enable and start only the timer, not the oneshot service, unless an immediate
   governed cleanup is intended.

## Rollback

Disable scheduling without changing stored data:

```bash
systemctl disable --now simplehost-storage-maintenance.timer
```

The service is stateless apart from its latest JSON report. Existing releases,
images, backups, and recovery snapshots are not modified merely by disabling or
removing the unit.
