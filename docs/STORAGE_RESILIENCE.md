# Storage Resilience

Date introduced: 2026-08-19

## Objective

SimpleHostMan prevents host saturation with independent, bounded controls. No
single cleanup job owns every byte and no generic recursive purge is allowed.
The design separates capacity detection, reconstructible host cleanup, backup
retention, pgBackRest health, and log lifecycle so an error in one domain cannot
delete data owned by another.

## Automated controls

| Control | Nodes | Cadence | Ownership |
| --- | --- | --- | --- |
| `simplehost-capacity-guard` | primary and secondary | every 15 minutes | measures each unique filesystem behind `/` and `/srv/backups`; warning at 70%, critical at 85% or 5 GiB free |
| `simplehost-storage-maintenance` | primary and secondary | daily at 07:15 UTC | removes only eligible old releases and unused Podman images when the high watermark is crossed |
| `simplehost-backup-retention` | active primary | daily at 06:30 UTC | applies each desired-state policy retention to local and replicated logical backup generations, preserving the newest generation |
| `simplehost-pgbackrest-health` | active primary | hourly | validates `info`, `check`, full-backup age, WAL queue, metadata ownership, and repository capacity |
| `simplehost-log-health` | primary and secondary | hourly | verifies that rsyslog owns the active `/var/log/messages`; recreates and reopens the file when rotation left a stale descriptor |
| `logrotate.timer` | primary and secondary | every 6 hours | evaluates daily/max-size log rotation, compression, and a 14-day maximum age |

The backup-retention cycle is intentionally independent of backup creation. A
failed or skipped backup therefore cannot leave every old logical generation
unbounded. The newest generation is always protected, including when every
generation is older than policy retention. pgBackRest remains owned by
pgBackRest itself; SimpleHostMan observes its repository and reports failures
but never manually deletes WAL, `backup.info`, or backup sets.

## Failure evidence

Critical capacity or health checks fail their oneshot unit. Protected jobs use
`OnFailure=simplehost-unit-failure@%n.service`, which records safe systemd
properties as JSON under `/var/lib/simplehost-unit-failures` and emits a
critical journal entry. Evidence older than 14 days is pruned only from that
dedicated evidence directory.

Latest machine-readable reports:

- `/var/lib/simplehost-capacity-guard/latest.json`
- `/var/lib/simplehost-backup-retention/latest.json`
- `/var/lib/simplehost-pgbackrest-health/latest.json`
- `/var/lib/simplehost-log-health/latest.json`

Thresholds and report paths are configured in
`/etc/simplehost/storage-resilience.env`. The release always installs a fresh
`.env.example` but does not overwrite a local operator configuration.

## Log policy

Host logs are evaluated every six hours and rotate daily or after crossing
256 MiB. The policy retains at most 28 rotations and 14 days, compresses old
files, creates the replacement as `0600 root:root`, and asks rsyslog to reopen
its descriptors. `simplehost-log-health` repairs the known failure mode where
`/var/log/messages` is absent while rsyslog continues writing to a renamed
file.

## Operations

Inspect schedules and recent outcomes:

```bash
systemctl list-timers 'simplehost-*' logrotate.timer
systemctl status simplehost-capacity-guard.service
systemctl status simplehost-backup-retention.service
systemctl status simplehost-pgbackrest-health.service
systemctl status simplehost-log-health.service
journalctl -p warning --since today
```

Run immediate checks:

```bash
systemctl start simplehost-capacity-guard.service
systemctl start simplehost-log-health.service
systemctl start simplehost-pgbackrest-health.service
```

Run policy retention only after confirming no backup runner is active. A shared
`flock` makes overlapping retention cycles a successful no-op:

```bash
systemctl start simplehost-backup-retention.service
```

The passive secondary enables only capacity, log, logrotate, and bounded host
maintenance timers. Backup creation, backup retention, control/worker, and
pgBackRest health timers remain disabled there until promotion.

## Rollback

Disable only the new schedules without changing stored data:

```bash
systemctl disable --now \
  simplehost-capacity-guard.timer \
  simplehost-backup-retention.timer \
  simplehost-pgbackrest-health.timer \
  simplehost-log-health.timer
rm -f /etc/systemd/system/logrotate.timer.d/20-simplehost-frequency.conf
systemctl daemon-reload
```

Restore the distribution logrotate policy if the SimpleHostMan policy is
removed. Disabling a timer does not restore backup generations, releases, or
logs already expired under their documented retention.
