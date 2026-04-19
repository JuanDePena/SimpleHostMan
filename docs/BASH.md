# Bash Runbook

Date applied: 2026-03-11
Host OS: AlmaLinux 10.1

## Scope

This runbook documents the shared Bash helper setup stored in [`/home/shell/bashrc`](/home/shell/bashrc), how it is loaded for users, and the helper functions and aliases implemented by that script.

## Status on 2026-03-14

- This runbook is auxiliary host-operations documentation and is not a primary `SimpleHost Control` or `SimpleHost Agent` product backlog driver.
- Open product and platform work is tracked in [`/opt/simplehostman/src/docs/TODO.md`](/opt/simplehostman/src/docs/TODO.md).

## Shared shell profile

Shared helper file:

- [`/home/shell/bashrc`](/home/shell/bashrc)

Current users loading it:

- [`/root/.bashrc`](/root/.bashrc#L24)
- [`/home/almalinux/.bashrc`](/home/almalinux/.bashrc#L27)

Load behavior:

- Each user keeps their local `.bashrc`.
- At the end of the local `.bashrc`, the shell conditionally sources `/home/shell/bashrc`.
- New interactive Bash sessions pick up the shared helpers automatically.
- Existing sessions can reload them with `source ~/.bashrc` or `br`.

Helper notes:

- `br` reloads the shared helper file.
- `qqa` opens the shared helper file in `vim`.
- Existing utility aliases and helper functions remain in the shared file.

## Implemented helpers

The script currently provides these functional groups:

- Profile management: `br`, `qqa`
- Copy and search helpers: `cpr`, `fa`, `wh`
- File listing helpers: `l`, `l1`, `la`, `lc`, `lk`, `lt`, `lw`, `lz`
- Aliases: `df`, `du`, `vi`, `fcs`, `wphp`, `npmrb`
- Safe trash workflow: `rr`, `rrls`, `rrrs`, `rrempty`
- History helpers: `h`, `hq`
- Password and SSH helpers: `genpasswd`, `mksshkey`
- Navigation helpers: `gb`, `gndir`, `go`

## Utility helpers

### Profile management

Functions:

- `br`: reloads the shared helper file from `/home/shell/bashrc`
- `qqa`: opens the shared helper file in `vim`

### Copy and search

Functions:

- `cpr`: runs `cp -pr`
- `fa`: runs `find / -name ...`
- `wh`: runs `whereis`

### File listing

Functions:

- `l`: `ls -hl` with paging
- `l1`: one-entry-per-line listing with paging
- `la`: long listing, sorted by time, including dotfiles
- `lc`: counts files below a path with `find ... -type f | wc -l`
- `lk`: long listing sorted by size
- `lt`: long listing sorted by modification time
- `lw`: prints only file names from `ls -hl`
- `lz`: runs `ls -Z` with paging for SELinux contexts

### Aliases

Aliases currently implemented by the script:

- `df`: `df -h`
- `du`: human-readable sorted size summary for entries in the current directory
- `vi`: `vim`
- `fcs`: iterates active fail2ban jails and prints each jail status
- `wphp`: runs the cPanel PHP 8.3 binary as user `wmpyrosa`
- `npmrb`: shorthand for `npm run build`

### History helpers

Functions:

- `h`: prints the current shell history
- `hq`: filters shell history through `grep`

### Password and SSH helpers

Functions:

- `genpasswd`: generates an ad-hoc password-like string of the requested length
- `mksshkey`: runs `ssh-keygen -t ed25519`

### Navigation helpers

Functions:

- `gb`: returns to the previous path recorded by `go`
- `gndir`: changes into a directory only if it exists
- `go`: jumps to predefined server paths

Current `go` keys implemented in the script:

- `b`: `/backup`
- `i`: `/bin`
- `e`: `/etc`
- `h`: `/home`
- `he`: `/opt/simplehostman/src/docs`
- `hs`: `/home/shell`
- `s`: `/.ssh`
- `ulb`: `/usr/local/bin`

## Safe remove workflow

The old `rr` hard-delete behavior was replaced with a per-user trash workflow.

Functions implemented in [`/home/shell/bashrc`](/home/shell/bashrc#L40):

- `rr`
- `rrls`
- `rrrs`
- `rrempty`

### `rr`

Purpose:

- Moves files or directories to the current user's trash instead of deleting them immediately.

Trash paths:

- Files: `~/.local/share/Trash/files`
- Metadata: `~/.local/share/Trash/info`

Behavior:

- Creates the trash directories on demand.
- Moves the target with `/bin/mv`.
- Renames the trashed item as `original-name.YYYYmmdd-HHMMSS`.
- Creates a matching `.trashinfo` file with the original absolute path and deletion timestamp.
- Uses `touch` on the trashed entry so retention is based on deletion time, not original file age.

Example:

```bash
rr archivo.txt
rr carpeta logs
```

### `rrls`

Purpose:

- Lists the current user's trash contents.

Output columns:

- Trash item name
- Deletion timestamp
- Original path

Example:

```bash
rrls
```

### `rrrs`

Purpose:

- Restores one or more items from the current user's trash using the trash item name shown by `rrls`.

Behavior:

- Reads the original path from the matching `.trashinfo` file.
- Recreates the destination parent directory if needed.
- Restores with `/bin/mv`.
- Removes the `.trashinfo` metadata after a successful restore.
- If the original path is already occupied, restores as `original-path.restored-YYYYmmdd-HHMMSS`.

Example:

```bash
rrls
rrrs archivo.txt.20260311-170146
```

### `rrempty`

Purpose:

- Empties the current user's trash immediately.

Behavior:

- Removes all items under `~/.local/share/Trash/files`.
- Removes all matching metadata under `~/.local/share/Trash/info`.
- Does not affect any other user's trash.

Example:

```bash
rrempty
```

## Trash cleanup

Source-controlled cleanup files:

- [`/home/shell/rr-trash-cleanup.sh`](/home/shell/rr-trash-cleanup.sh)
- [`/home/shell/cron.daily/rr-trash-cleanup`](/home/shell/cron.daily/rr-trash-cleanup)

Deployed files:

- [`/usr/local/sbin/rr-trash-cleanup`](/usr/local/sbin/rr-trash-cleanup)
- [`/etc/cron.daily/rr-trash-cleanup`](/etc/cron.daily/rr-trash-cleanup)

Behavior:

- Runs daily through `cron.daily`.
- Cleans trash for `/root/.local/share/Trash`.
- Cleans trash for each user home under `/home/*/.local/share/Trash`.
- Removes trashed files and metadata older than 30 days.

Retention setting:

- Default retention is 30 days through `RETENTION_DAYS=30`.
- The cleanup script can be run manually with another value:

```bash
RETENTION_DAYS=7 /usr/local/sbin/rr-trash-cleanup
```

## Validation

Shared helper load:

```bash
bash --noprofile --rcfile /root/.bashrc -ic 'type br; type rr; type rrls; type rrrs; type rrempty'
bash --noprofile --rcfile /home/almalinux/.bashrc -ic 'type br; type rr; type rrls; type rrrs; type rrempty'
```

Utility helper load:

```bash
bash --noprofile --rcfile /root/.bashrc -ic 'type cpr; type fa; type l; alias df; alias du; alias fcs; type genpasswd; type mksshkey; type go'
```

Trash workflow:

```bash
tmpfile=/tmp/bash-runbook-test
echo test > "$tmpfile"
rr "$tmpfile"
rrls
rrrs "$(rrls | awk '/bash-runbook-test\\./ {print $1; exit}')"
test -f "$tmpfile"
```

Empty trash workflow:

```bash
tmpfile=/tmp/bash-runbook-empty-test
echo test > "$tmpfile"
rr "$tmpfile"
rrempty
rrls
```

Cleanup workflow:

```bash
/usr/local/sbin/rr-trash-cleanup
run-parts /etc/cron.daily
```

## Operational notes

- Trash contents are per-user; one user does not see another user's trash unless running with broader privileges.
- `rr`, `rrls`, and `rrrs` avoid shell aliases such as `mv -i` and `rm -i` by calling `/bin/mv` and `/bin/rm` directly.
- `rrempty` empties only the current user's trash.
- Restoring a file does not preserve the trash filename; it restores to the original path or to the collision-safe `.restored-*` variant.
- Hard deletes are still possible with `/bin/rm` if intentionally used directly.
- `go` is host-specific; its jump table reflects the paths and users present on this server.

## Rollback

To remove the safe trash workflow from user shells:

1. Edit [`/home/shell/bashrc`](/home/shell/bashrc) and remove the `rr`, `rrls`, `rrrs`, `rrempty`, and helper functions.
2. Remove the deployed cleanup artifacts:

```bash
rm -f /usr/local/sbin/rr-trash-cleanup
rm -f /etc/cron.daily/rr-trash-cleanup
```

3. Optionally remove the shared shell include from:

- [`/root/.bashrc`](/root/.bashrc#L24)
- [`/home/almalinux/.bashrc`](/home/almalinux/.bashrc#L27)

## Access control

The `/opt/simplehostman/src/docs` tree is intended to be root-only. Documentation and source-controlled operational artifacts under this path are not meant for non-root user access.
