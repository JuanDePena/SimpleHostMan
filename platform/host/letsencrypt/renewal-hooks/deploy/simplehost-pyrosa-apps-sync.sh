#!/usr/bin/env bash
set -euo pipefail

lineage_name="${SIMPLEHOST_PYROSA_CERT_LINEAGE:-pyrosa-apps}"
lineage_path="/etc/letsencrypt/live/${lineage_name}"
managed_path="/etc/ssl/simplehostman/pyrosa.com.do"
secondary_host="${SIMPLEHOST_TLS_SECONDARY_HOST:-vps-des.pyrosa.com.do}"
renewed_lineage="${RENEWED_LINEAGE:-${lineage_path}}"

if [[ "${renewed_lineage}" != "${lineage_path}" ]]; then
  exit 0
fi

require_file() {
  local path="$1"
  [[ -f "${path}" ]] || {
    echo "required certificate artifact is missing: ${path}" >&2
    exit 1
  }
}

certificate_public_key_digest() {
  openssl x509 -in "$1" -pubkey -noout |
    openssl pkey -pubin -outform DER 2>/dev/null |
    sha256sum |
    awk '{print $1}'
}

private_key_public_digest() {
  openssl pkey -in "$1" -pubout -outform DER 2>/dev/null |
    sha256sum |
    awk '{print $1}'
}

activate_managed_path() {
  local target_root="$1"
  local source_root="$2"
  local backup_root="$3"
  local target_fullchain="${target_root}/fullchain.pem"
  local target_privkey="${target_root}/privkey.pem"
  local backup_required="false"

  install -d -m 0700 "${target_root}"

  if [[ -e "${target_fullchain}" && ! -L "${target_fullchain}" ]]; then
    backup_required="true"
  fi
  if [[ -e "${target_privkey}" && ! -L "${target_privkey}" ]]; then
    backup_required="true"
  fi

  if [[ "${backup_required}" == "true" ]]; then
    install -d -m 0700 "${backup_root}"
    [[ ! -e "${target_fullchain}" ]] || cp -a "${target_fullchain}" "${backup_root}/fullchain.pem"
    [[ ! -e "${target_privkey}" ]] || cp -a "${target_privkey}" "${backup_root}/privkey.pem"
  fi

  rm -f \
    "${target_root}/.fullchain.pem.pending" \
    "${target_root}/.privkey.pem.pending"
  ln -s "${source_root}/fullchain.pem" "${target_root}/.fullchain.pem.pending"
  mv -Tf "${target_root}/.fullchain.pem.pending" "${target_fullchain}"
  ln -s "${source_root}/privkey.pem" "${target_root}/.privkey.pem.pending"
  mv -Tf "${target_root}/.privkey.pem.pending" "${target_privkey}"
}

require_file "${lineage_path}/fullchain.pem"
require_file "${lineage_path}/privkey.pem"

openssl x509 -in "${lineage_path}/fullchain.pem" -checkend 86400 -noout

certificate_digest="$(certificate_public_key_digest "${lineage_path}/fullchain.pem")"
private_key_digest="$(private_key_public_digest "${lineage_path}/privkey.pem")"
if [[ -z "${certificate_digest}" || "${certificate_digest}" != "${private_key_digest}" ]]; then
  echo "certificate and private key do not match for ${lineage_name}" >&2
  exit 1
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
activate_managed_path \
  "${managed_path}" \
  "${lineage_path}" \
  "/var/lib/simplehostman/tls-backups/${stamp}-${lineage_name}"

httpd -t
systemctl reload httpd.service

if [[ -n "${secondary_host}" && "${secondary_host}" != "none" ]]; then
  ssh -o BatchMode=yes "${secondary_host}" \
    "install -d -m 0700 '/etc/letsencrypt/archive/${lineage_name}' '/etc/letsencrypt/live/${lineage_name}'"
  rsync -a --delete "/etc/letsencrypt/archive/${lineage_name}/" \
    "${secondary_host}:/etc/letsencrypt/archive/${lineage_name}/"
  rsync -a --delete "/etc/letsencrypt/live/${lineage_name}/" \
    "${secondary_host}:/etc/letsencrypt/live/${lineage_name}/"

  ssh -o BatchMode=yes "${secondary_host}" bash -s -- \
    "${lineage_name}" "${stamp}" <<'REMOTE'
set -euo pipefail

lineage_name="$1"
stamp="$2"
lineage_path="/etc/letsencrypt/live/${lineage_name}"
managed_path="/etc/ssl/simplehostman/pyrosa.com.do"
backup_root="/var/lib/simplehostman/tls-backups/${stamp}-${lineage_name}"
backup_required="false"

install -d -m 0700 "${managed_path}"

if [[ -e "${managed_path}/fullchain.pem" && ! -L "${managed_path}/fullchain.pem" ]]; then
  backup_required="true"
fi
if [[ -e "${managed_path}/privkey.pem" && ! -L "${managed_path}/privkey.pem" ]]; then
  backup_required="true"
fi

if [[ "${backup_required}" == "true" ]]; then
  install -d -m 0700 "${backup_root}"
  [[ ! -e "${managed_path}/fullchain.pem" ]] ||
    cp -a "${managed_path}/fullchain.pem" "${backup_root}/fullchain.pem"
  [[ ! -e "${managed_path}/privkey.pem" ]] ||
    cp -a "${managed_path}/privkey.pem" "${backup_root}/privkey.pem"
fi

rm -f \
  "${managed_path}/.fullchain.pem.pending" \
  "${managed_path}/.privkey.pem.pending"
ln -s "${lineage_path}/fullchain.pem" "${managed_path}/.fullchain.pem.pending"
mv -Tf "${managed_path}/.fullchain.pem.pending" "${managed_path}/fullchain.pem"
ln -s "${lineage_path}/privkey.pem" "${managed_path}/.privkey.pem.pending"
mv -Tf "${managed_path}/.privkey.pem.pending" "${managed_path}/privkey.pem"

openssl x509 -in "${lineage_path}/fullchain.pem" -checkend 86400 -noout
httpd -t
systemctl reload httpd.service
REMOTE
fi

echo "Activated and reloaded managed Pyrosa certificate lineage ${lineage_name}."
