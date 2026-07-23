#!/usr/bin/env bash
set -euo pipefail

list_domains_only="false"
if [[ "${1:-}" == "--list-domains" ]]; then
  list_domains_only="true"
  shift
fi

if [[ "${#}" -ne 0 ]]; then
  echo "usage: configure-pyrosa-apps-certificate.sh [--list-domains]" >&2
  exit 2
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "configure-pyrosa-apps-certificate.sh must run as root" >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/../lib/workspace-paths.sh"
repo_root="$(simplehost_workspace_root)"

lineage_name="${SIMPLEHOST_PYROSA_CERT_LINEAGE:-pyrosa-apps}"
legacy_certificate_path="/etc/ssl/simplehostman/pyrosa.com.do"
webroot="${SIMPLEHOST_ACME_WEBROOT:-/var/www/letsencrypt}"
vhost_root="${SIMPLEHOST_HTTPD_VHOST_ROOT:-/etc/httpd/conf.d}"
hook_source="${repo_root}/platform/host/letsencrypt/renewal-hooks/deploy/simplehost-pyrosa-apps-sync.sh"
hook_target="/etc/letsencrypt/renewal-hooks/deploy/simplehost-pyrosa-apps-sync.sh"

for command_name in certbot openssl httpd rsync ssh; do
  command -v "${command_name}" >/dev/null 2>&1 || {
    echo "required command is unavailable: ${command_name}" >&2
    exit 1
  }
done

[[ -x "${hook_source}" ]] || {
  echo "source renewal hook is missing or not executable: ${hook_source}" >&2
  exit 1
}

mapfile -t domains < <(
  find "${vhost_root}" -maxdepth 1 -type f -name '*.conf' -print0 |
    while IFS= read -r -d '' vhost; do
      grep -qF "${legacy_certificate_path}/fullchain.pem" "${vhost}" || continue
      awk '/^[[:space:]]*Server(Name|Alias)[[:space:]]+/ { print $2 }' "${vhost}"
    done |
    awk '$0 == "pyrosa.com.do" || $0 ~ /^[A-Za-z0-9-]+\.pyrosa\.com\.do$/' |
    sort -u
)

if [[ "${#domains[@]}" -eq 0 ]]; then
  echo "no Pyrosa vhosts reference the managed certificate path" >&2
  exit 1
fi

if [[ "${list_domains_only}" == "true" ]]; then
  printf '%s\n' "${domains[@]}"
  exit 0
fi

install -d -m 0755 "${webroot}/.well-known/acme-challenge"
install -D -m 0755 "${hook_source}" "${hook_target}"

certbot_args=(
  certonly
  --webroot
  --webroot-path "${webroot}"
  --non-interactive
  --agree-tos
  --key-type ecdsa
  --cert-name "${lineage_name}"
)

if [[ -d "/etc/letsencrypt/live/${lineage_name}" ]]; then
  certbot_args+=(--expand)
fi

if [[ -n "${CERTBOT_EMAIL:-}" ]]; then
  certbot_args+=(--email "${CERTBOT_EMAIL}")
fi

for domain in "${domains[@]}"; do
  certbot_args+=(-d "${domain}")
done

certbot "${certbot_args[@]}"

for domain in "${domains[@]}"; do
  openssl x509 \
    -in "/etc/letsencrypt/live/${lineage_name}/fullchain.pem" \
    -checkhost "${domain}" \
    -noout >/dev/null
done

RENEWED_LINEAGE="/etc/letsencrypt/live/${lineage_name}" \
  SIMPLEHOST_PYROSA_CERT_LINEAGE="${lineage_name}" \
  "${hook_target}"

printf 'Configured Certbot lineage %s for %d exact Pyrosa names.\n' \
  "${lineage_name}" "${#domains[@]}"
