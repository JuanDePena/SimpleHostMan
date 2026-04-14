#!/usr/bin/env bash

simplehost_workspace_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  printf '%s\n' "${script_dir}"
}

simplehost_default_release_root() {
  printf '%s\n' "/opt/simplehostman/release"
}

simplehost_read_workspace_version() {
  local workspace_root="$1"
  node -e 'const fs=require("node:fs"); const path=require("node:path"); const root=process.argv[1]; const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8")); console.log(pkg.version);' "${workspace_root}"
}

simplehost_resolve_runtime_root() {
  local env_name="$1"
  local fallback_root="${2:-$(simplehost_default_release_root)}"
  local env_value="${!env_name:-}"
  if [[ -n "${env_value}" ]]; then
    printf '%s\n' "${env_value}"
    return
  fi
  printf '%s\n' "${fallback_root}"
}

readonly SIMPLEHOST_CONTROL_API_ENTRYPOINT="apps/control/api/dist/index.js"
readonly SIMPLEHOST_CONTROL_WEB_ENTRYPOINT="apps/control/web/dist/index.js"
readonly SIMPLEHOST_WORKER_ENTRYPOINT="apps/worker/dist/index.js"
readonly SIMPLEHOST_AGENT_ENTRYPOINT="apps/agent/dist/index.js"
