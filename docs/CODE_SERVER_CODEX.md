# code-server + Codex Extension Runbook

Date drafted: 2026-06-22

## Scope

This runbook documents the known-good recovery path for the OpenAI Codex
extension when it is used inside the browser-based `code-server` instance on
the SimpleHostMan host.

It applies to:

- `https://code.pyrosa.com.do`
- `code-server@root.service`
- `/root/.local/share/code-server`
- `/root/.codex`
- the SimpleHostMan source workspace at `/opt/simplehostman/src`

## Important Outcome From The 2026-06-22 Incident

The successful fix was not a permanent `vscode-resource` DNS or webview patch.

The stable recovery path was:

1. Revert the experimental `vscode-resource` / webview-domain changes.
2. Remove the previous Codex extension install and stale auth/session material.
3. Clear stale `code-server`, Codex, VS Code IPC, and browser temp sockets.
4. Reinstall the Codex extension cleanly.
5. Authenticate again from the extension UI.

Do not start future incidents by patching `code-server` webview resource
domains, Apache `ServerAlias` entries, or PowerDNS records for
`vscode-remote--...` hostnames. Treat those as temporary diagnostic paths only.

## Known Symptoms

The broken state can look like:

- opening the Codex panel freezes `code-server`
- the Codex panel is blank
- the Codex logo does not render
- the login prompt never appears
- the browser console shows webview resource errors

Console noise that appeared during the incident:

- `vsda.js` or `vsda_bg.wasm` returning `404`
- Open VSX requests for `github/copilot-chat/latest` returning `404`
- iframe sandbox warnings

Those messages were not the final root cause. The durable fix was a clean
extension/auth/session reset followed by reinstall.

## Safe Cleanup Procedure

Stop `code-server` before removing sockets and workspace locks:

```bash
systemctl stop code-server@root.service
```

Remove the Codex extension from `code-server` if present:

```bash
code-server --uninstall-extension openai.chatgpt || true
rm -rf /root/.local/share/code-server/extensions/openai.chatgpt-*
```

Remove Codex extension logs from previous extension hosts:

```bash
find /root/.local/share/code-server/logs \
  -maxdepth 3 \
  -type d \
  -name openai.chatgpt \
  -exec rm -rf {} +
```

Remove Codex auth and temporary app/plugin cache without printing secrets:

```bash
rm -f /root/.codex/auth.json
rm -rf /root/.codex/.tmp
rm -rf /root/.codex/cache/codex_app_directory
rm -rf /root/.codex/cache/codex_apps_server_info
rm -rf /root/.codex/cache/codex_apps_tools
rm -rf /root/.codex/cache/remote_plugin_catalog
rm -f /root/.codex/log/codex-login.log
```

Remove stale sockets and locks after `code-server` is stopped:

```bash
rm -f /root/.local/share/code-server/code-server-ipc.sock
find /root/.local/share/code-server/User/workspaceStorage \
  -name vscode.lock \
  -delete
rm -f /tmp/vscode-ipc-*.sock
rm -f /tmp/vscode-git-*.sock
rm -rf /tmp/codex-ipc
rm -rf /tmp/org.chromium.Chromium.*
```

Clean cached workspace settings that reference the removed extension:

```bash
rg -l 'chatgpt\.openOnStartup|openai\.chatgpt|chatgpt|Codex|codex' \
  /root/.local/share/code-server/User/caches/CachedConfigurations \
  /root/.config/code-server 2>/dev/null \
  | xargs -r rm -f --
find /root/.local/share/code-server/User/caches/CachedConfigurations \
  -type d \
  -empty \
  -delete
```

Start `code-server` again:

```bash
systemctl start code-server@root.service
systemctl is-active code-server@root.service
```

## What Not To Remove

Do not remove these as part of a normal extension reset:

- `/root/.codex/config.toml`
- `/root/.codex/memories`
- `/root/.codex/skills`
- `/root/.codex/plugins/cache`
- `/root/.codex/sessions`
- `/root/.codex/logs_2.sqlite*`

Those are broader Codex runtime and operator-context assets, not just stale
state from the `code-server` extension.

## Reinstall Procedure

After cleanup:

1. Confirm `code-server` and Apache are active.
2. Open `https://code.pyrosa.com.do`.
3. Install the Codex extension again.
4. Open the Codex panel.
5. Complete the login flow shown by the extension.

If the panel still shows old behavior, use a private/incognito window or clear
the browser site data for `code.pyrosa.com.do`. Old service workers and cached
webview iframes can survive a normal reload.

## Validation

Expected extension list after cleanup, before reinstall:

```bash
code-server --list-extensions --show-versions
```

The output should not include:

- `openai.chatgpt`
- `chatgpt`
- `codex`

Expected file-state checks:

```bash
find /root/.local/share/code-server /root/.config/code-server \
  -maxdepth 8 \
  \( -iname '*openai.chatgpt*' -o -iname '*chatgpt*' -o -iname '*codex*' \) \
  -print

rg -n 'openai\.chatgpt|chatgpt|Codex|codex' \
  /root/.local/share/code-server/User \
  /root/.config/code-server
```

Both commands should return no relevant `code-server` extension state.

Expected service checks:

```bash
systemctl is-active code-server@root.service httpd
curl -k -sS -I \
  --resolve code.pyrosa.com.do:443:127.0.0.1 \
  https://code.pyrosa.com.do/
```

The HTTPS check should return `302 ./login` when `code-server` authentication is
enabled and no browser session is attached.

Expected socket state:

```bash
ss -xlp | grep -E 'code-server|vscode|codex|ipc|git'
```

The normal post-cleanup state should include the active
`/root/.local/share/code-server/code-server-ipc.sock` socket owned by the
running `code-server` process. Stale `/tmp/vscode-ipc-*`, `/tmp/vscode-git-*`,
and `/tmp/codex-ipc` sockets should not remain.

## DNS And Webview Caution

During the incident, temporary DNS and Apache experiments were tested for
`vscode-remote--...` webview resource hostnames. They were reverted.

If a future diagnostic change touches DNS, remember:

- SimpleHostMan DNS desired state is persisted in PostgreSQL.
- Updating only live PowerDNS state is not durable.
- Removing only live PowerDNS state is not enough if PostgreSQL still contains
  the record.
- Both authoritative hosts should be checked after cleanup.

Use the PowerDNS runbook for the general DNS persistence model:

- [`/opt/simplehostman/src/docs/DNS.md`](/opt/simplehostman/src/docs/DNS.md)

## Current Recommendation

Keep `code-server` as close to stock webview behavior as possible. For Codex
extension failures, prefer:

1. extension uninstall
2. auth/session cleanup
3. stale socket/cache cleanup
4. browser site-data refresh
5. clean extension reinstall

Only patch `code-server` internals after a reproducible failure proves the
stock webview path is the problem.
