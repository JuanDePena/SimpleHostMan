#!/usr/bin/env bash
set -euo pipefail

version="${1:?usage: deploy-release.sh <version> [target-host|local] [active|disabled]}"
target_host="${2:-local}"
mode="${3:-active}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/../lib/workspace-paths.sh"
repo_root="$(simplehost_workspace_root)"
runtime_root="$(simplehost_resolve_runtime_root SIMPLEHOST_RUNTIME_ROOT)"
release_dir="${runtime_root}/releases/${version}"

if [[ "${mode}" != "active" && "${mode}" != "disabled" ]]; then
  echo "mode must be active or disabled" >&2
  exit 1
fi

if [[ "${target_host}" == "local" || ! -d "${release_dir}" ]]; then
  bash "${repo_root}/scripts/agent/install-release.sh" "${version}"
fi

ensure_env_version() {
  local target_path="$1"
  local example_path="$2"

  if [[ ! -f "${target_path}" ]]; then
    install -m 0640 "${example_path}" "${target_path}"
  fi

  if grep -q '^SIMPLEHOST_VERSION=' "${target_path}"; then
    sed -i "s/^SIMPLEHOST_VERSION=.*/SIMPLEHOST_VERSION=${version}/" "${target_path}"
  else
    printf '\nSIMPLEHOST_VERSION=%s\n' "${version}" >>"${target_path}"
  fi
}

activate_local() {
  ensure_env_version /etc/simplehost/agent.env "${release_dir}/packaging/env/simplehost-agent.env.example"
  systemctl daemon-reload

  if [[ "${mode}" == "disabled" ]]; then
    systemctl disable simplehost-agent.service || true
    systemctl stop simplehost-agent.service || true
    echo "Installed agent runtime ${version} locally in disabled mode"
    return
  fi

  systemctl enable simplehost-agent.service
  systemctl restart simplehost-agent.service
  systemctl is-active simplehost-agent.service
  echo "Installed agent runtime ${version} locally in active mode"
}

activate_remote() {
  local remote_release_dir="${release_dir}"

  rsync -a "${release_dir}/" "${target_host}:${remote_release_dir}/"

  ssh "${target_host}" \
    "install -d '${runtime_root}/releases' /etc/simplehost /var/log/simplehost && \
     ln -sfn '${remote_release_dir}' '${runtime_root}/current' && \
     install -m 0644 '${remote_release_dir}/packaging/systemd/simplehost-agent.service' /etc/systemd/system/simplehost-agent.service && \
     install -m 0644 '${remote_release_dir}/packaging/env/simplehost-agent.env.example' /etc/simplehost/agent.env.example && \
     if [ ! -f /etc/simplehost/agent.env ]; then install -m 0640 '${remote_release_dir}/packaging/env/simplehost-agent.env.example' /etc/simplehost/agent.env; fi && \
     if grep -q '^SIMPLEHOST_VERSION=' /etc/simplehost/agent.env; then sed -i 's/^SIMPLEHOST_VERSION=.*/SIMPLEHOST_VERSION=${version}/' /etc/simplehost/agent.env; else printf '\nSIMPLEHOST_VERSION=${version}\n' >> /etc/simplehost/agent.env; fi && \
     systemctl daemon-reload"

  if [[ "${mode}" == "disabled" ]]; then
    ssh "${target_host}" \
      "systemctl disable simplehost-agent.service || true && \
       systemctl stop simplehost-agent.service || true"
    echo "Installed agent runtime ${version} on ${target_host} in disabled mode"
    return
  fi

  ssh "${target_host}" \
    "systemctl enable simplehost-agent.service && \
     systemctl restart simplehost-agent.service && \
     systemctl is-active simplehost-agent.service"
  echo "Installed agent runtime ${version} on ${target_host} in active mode"
}

if [[ "${target_host}" == "local" ]]; then
  activate_local
else
  activate_remote
fi
