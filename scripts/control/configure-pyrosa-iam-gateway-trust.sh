#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "This command must run as root." >&2
  exit 1
fi

secret_dir="/etc/pyrosa-iam/secrets"
secret_env="${secret_dir}/gateway-trusted-proxy.env"
backup_root="/etc/pyrosa-iam/backups"
iam_quadlet="/etc/containers/systemd/app-pyrosa-iam.container"
iam_environment_file="/etc/containers/systemd/env/app-pyrosa-iam.env"
bridge_units=(
  pyrosa-iam-pgadmin-gateway-bridge.service
  pyrosa-iam-ldap-gateway-bridge.service
  pyrosa-iam-helpers-gateway-bridge.service
  pyrosa-iam-helpers-dfr-gateway-bridge.service
)

install -d -o root -g root -m 0700 "${secret_dir}" "${backup_root}"

if [[ ! -f "${secret_env}" ]]; then
  secret="$(openssl rand -hex 32)"
  temp_secret="$(mktemp "${secret_dir}/.gateway-trusted-proxy.env.XXXXXX")"
  trap 'rm -f "${temp_secret:-}"' EXIT
  {
    printf 'PYROSA_IAM_OAUTH_GATEWAY_TRUSTED_PROXY_SECRET=%s\n' "${secret}"
    printf 'PYROSA_IAM_GATEWAY_TRUSTED_PROXY_SECRET=%s\n' "${secret}"
  } >"${temp_secret}"
  chmod 0600 "${temp_secret}"
  chown root:root "${temp_secret}"
  mv "${temp_secret}" "${secret_env}"
  trap - EXIT
fi

chmod 0600 "${secret_env}"
chown root:root "${secret_env}"

iam_secret="$(
  sed -n 's/^PYROSA_IAM_OAUTH_GATEWAY_TRUSTED_PROXY_SECRET=//p' "${secret_env}"
)"
bridge_secret="$(
  sed -n 's/^PYROSA_IAM_GATEWAY_TRUSTED_PROXY_SECRET=//p' "${secret_env}"
)"

if [[ "${#iam_secret}" -lt 32 || "${iam_secret}" != "${bridge_secret}" ]]; then
  echo "The gateway trust file is invalid or its two runtime values differ." >&2
  exit 1
fi

if [[ ! -f "${iam_quadlet}" || ! -f "${iam_environment_file}" ]]; then
  echo "The IAM Quadlet or its primary environment file is missing." >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="${backup_root}/gateway-trust-${timestamp}"
install -d -o root -g root -m 0700 "${backup_dir}"
install -m 0600 "${iam_quadlet}" "${backup_dir}/app-pyrosa-iam.container"

if ! grep -Fqx "EnvironmentFile=${secret_env}" "${iam_quadlet}"; then
  temp_quadlet="$(mktemp "${iam_quadlet}.XXXXXX")"
  awk -v secret_env="${secret_env}" '
    {
      print
      if ($0 == "EnvironmentFile=/etc/containers/systemd/env/app-pyrosa-iam.env") {
        print "EnvironmentFile=" secret_env
      }
    }
  ' "${iam_quadlet}" >"${temp_quadlet}"
  chmod 0644 "${temp_quadlet}"
  chown root:root "${temp_quadlet}"
  mv "${temp_quadlet}" "${iam_quadlet}"
fi

for unit in "${bridge_units[@]}"; do
  if [[ ! -f "/etc/systemd/system/${unit}" ]]; then
    continue
  fi
  dropin_dir="/etc/systemd/system/${unit}.d"
  install -d -o root -g root -m 0755 "${dropin_dir}"
  install -m 0644 "/etc/systemd/system/${unit}" "${backup_dir}/${unit}"
  printf '[Service]\nEnvironmentFile=%s\n' "${secret_env}" \
    >"${dropin_dir}/20-pyrosa-iam-gateway-trust.conf"
  chmod 0644 "${dropin_dir}/20-pyrosa-iam-gateway-trust.conf"
  chown root:root "${dropin_dir}/20-pyrosa-iam-gateway-trust.conf"
done

systemctl daemon-reload

echo "Pyrosa IAM gateway trust configured under ${secret_dir}."
echo "Runtime backup: ${backup_dir}"
