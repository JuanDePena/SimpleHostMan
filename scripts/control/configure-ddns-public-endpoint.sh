#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "configure-ddns-public-endpoint.sh must run as root" >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/../lib/workspace-paths.sh"
repo_root="$(simplehost_workspace_root)"

source_vhost="${repo_root}/platform/httpd/vhosts/pyrosa-ddns.conf"
live_vhost="/etc/httpd/conf.d/pyrosa-ddns.conf"
rollback_root="/etc/simplehost/rollback"
rollback_dir="${rollback_root}/ddns-endpoint-$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="${rollback_dir}/pyrosa-ddns.conf"
pending_path="${live_vhost}.pending.$$"
had_existing="false"

for required_path in \
  "${source_vhost}" \
  /etc/ssl/simplehostman/pyrosa.com.do/fullchain.pem \
  /etc/ssl/simplehostman/pyrosa.com.do/privkey.pem; do
  if [[ ! -f "${required_path}" ]]; then
    echo "required DDNS endpoint artifact is missing: ${required_path}" >&2
    exit 1
  fi
done

install -d -m 0755 "${rollback_dir}"

if [[ -f "${live_vhost}" ]]; then
  cp -a "${live_vhost}" "${backup_path}"
  had_existing="true"
fi

restore_live_vhost() {
  if [[ "${had_existing}" == "true" ]]; then
    cp -a "${backup_path}" "${live_vhost}"
  else
    rm -f "${live_vhost}"
  fi

  rm -f "${pending_path}"
  httpd -t >/dev/null 2>&1 && systemctl reload httpd >/dev/null 2>&1 || true
}

install -m 0644 "${source_vhost}" "${pending_path}"
mv -f "${pending_path}" "${live_vhost}"

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

printf '{"ok":true,"hostname":"ddns.pyrosa.com.do","liveVhostPath":"%s","rollbackDirectory":"%s"}\n' \
  "${live_vhost}" \
  "${rollback_dir}"
