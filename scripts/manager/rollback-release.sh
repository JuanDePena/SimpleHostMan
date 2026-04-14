#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/../lib/workspace-paths.sh"

version="${1:?usage: rollback-release.sh <version>}"
runtime_root="$(simplehost_resolve_runtime_root SHM_RUNTIME_ROOT)"
release_dir="${runtime_root}/releases/${version}"

if [[ ! -d "${release_dir}" ]]; then
  echo "Release ${release_dir} does not exist." >&2
  exit 1
fi

ln -sfn "${release_dir}" "${runtime_root}/current"
systemctl try-restart shm-agent.service || true

echo "Rolled SHM current symlink back to ${release_dir}"
