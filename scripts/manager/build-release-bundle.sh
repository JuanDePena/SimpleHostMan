#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${script_dir}/../lib/workspace-paths.sh"
repo_root="$(simplehost_workspace_root)"
version="${1:-$(simplehost_read_workspace_version "${repo_root}")}"
work_dir="$(mktemp -d)"
staging_dir="${work_dir}/simplehost-manager-${version}"
bundle_dir="${repo_root}/dist/releases"
bundle_path="${bundle_dir}/simplehost-manager-${version}.tar.gz"

cleanup() {
  rm -rf "${work_dir}"
}
trap cleanup EXIT

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required. Install Node.js, npm, and pnpm first." >&2
  exit 1
fi

install -d "${bundle_dir}"
cp -a "${repo_root}/." "${staging_dir}"
rm -rf "${staging_dir}/.git" "${staging_dir}/node_modules" "${staging_dir}/dist"

(
  cd "${staging_dir}"
  pnpm install --frozen-lockfile
  pnpm build:manager-runtime
)

tar -C "${work_dir}" -czf "${bundle_path}" "simplehost-manager-${version}"
echo "Created ${bundle_path}"
