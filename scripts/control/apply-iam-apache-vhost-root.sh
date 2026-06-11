#!/usr/bin/env bash
set -euo pipefail

source_path="${1:?usage: apply-iam-apache-vhost-root.sh <source> <live-vhost> <rollback-dir>}"
live_vhost_path="${2:?usage: apply-iam-apache-vhost-root.sh <source> <live-vhost> <rollback-dir>}"
rollback_dir="${3:?usage: apply-iam-apache-vhost-root.sh <source> <live-vhost> <rollback-dir>}"

spool_root="/var/lib/simplehost/iam-apache"
httpd_conf_dir="/etc/httpd/conf.d"
rollback_root="/etc/simplehost/rollback"

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

resolve_parent() {
  local target="$1"
  local parent

  parent="$(dirname "${target}")"
  if [[ ! -d "${parent}" ]]; then
    fail "Parent directory does not exist: ${parent}"
  fi

  (cd "${parent}" && pwd -P)
}

source_parent="$(resolve_parent "${source_path}")"
live_parent="$(resolve_parent "${live_vhost_path}")"
rollback_parent="$(dirname "${rollback_dir}")"

[[ "${source_parent}" == "${spool_root}" ]] ||
  fail "Refusing source outside ${spool_root}: ${source_path}"
[[ -f "${source_path}" ]] ||
  fail "Source vhost does not exist: ${source_path}"
[[ "$(basename "${source_path}")" == *.conf ]] ||
  fail "Source vhost must be a .conf file: ${source_path}"
[[ "${live_parent}" == "${httpd_conf_dir}" ]] ||
  fail "Refusing live vhost outside ${httpd_conf_dir}: ${live_vhost_path}"
[[ "$(basename "${live_vhost_path}")" == *.conf ]] ||
  fail "Live vhost must be a .conf file: ${live_vhost_path}"
[[ "${rollback_parent}" == "${rollback_root}" ]] ||
  fail "Refusing rollback outside ${rollback_root}: ${rollback_dir}"
[[ "$(basename "${rollback_dir}")" == iam-apache-* ]] ||
  fail "Rollback directory must start with iam-apache-: ${rollback_dir}"

install -d -m 0755 "${rollback_dir}"

backup_path="${rollback_dir}/$(basename "${live_vhost_path}")"
pending_path="${live_vhost_path}.pending.$$"
had_existing=0

if [[ -f "${live_vhost_path}" ]]; then
  cp -a "${live_vhost_path}" "${backup_path}"
  had_existing=1
fi

restore_live_vhost() {
  if [[ "${had_existing}" == "1" && -f "${backup_path}" ]]; then
    cp -a "${backup_path}" "${live_vhost_path}"
  else
    rm -f "${live_vhost_path}"
  fi

  rm -f "${pending_path}"
  httpd -t >/dev/null 2>&1 && systemctl reload httpd >/dev/null 2>&1 || true
}

install -m 0644 "${source_path}" "${pending_path}"
mv -f "${pending_path}" "${live_vhost_path}"

if ! syntax_output="$(httpd -t 2>&1)"; then
  restore_live_vhost
  printf '%s\n' "${syntax_output}" >&2
  exit 1
fi

if ! reload_output="$(systemctl reload httpd 2>&1)"; then
  restore_live_vhost
  printf '%s\n' "${reload_output}" >&2
  exit 1
fi

printf '{"ok":true,"liveVhostPath":"%s","backupPath":"%s","rollbackDirectory":"%s"}\n' \
  "${live_vhost_path}" \
  "${backup_path}" \
  "${rollback_dir}"
