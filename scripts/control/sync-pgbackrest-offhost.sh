#!/usr/bin/env bash
set -euo pipefail

env_path="/etc/simplehost/pgbackrest-offhost.env"

if [[ -f "${env_path}" ]]; then
  # shellcheck source=/dev/null
  source "${env_path}"
fi

source_dir="${SIMPLEHOST_PGBACKREST_REPO:-/srv/backups/pgbackrest}"
target="${SIMPLEHOST_PGBACKREST_OFFHOST_TARGET:-}"
ssh_opts="${SIMPLEHOST_PGBACKREST_OFFHOST_SSH_OPTS:--o BatchMode=yes -o StrictHostKeyChecking=accept-new}"

if [[ -z "${target}" ]]; then
  echo "pgBackRest off-host sync is disabled: SIMPLEHOST_PGBACKREST_OFFHOST_TARGET is empty."
  exit 0
fi

if [[ ! -d "${source_dir}" ]]; then
  echo "pgBackRest repository does not exist: ${source_dir}" >&2
  exit 1
fi

if [[ "${target}" == *:* ]]; then
  remote_host="${target%%:*}"
  remote_path="${target#*:}"
  ssh ${ssh_opts} "${remote_host}" "install -d -m 0700 '${remote_path}'"
fi

rsync -a --delete --numeric-ids --chmod=Du=rwx,Dgo=,Fu=rw,Fgo= \
  -e "ssh ${ssh_opts}" \
  "${source_dir%/}/" \
  "${target%/}/"
