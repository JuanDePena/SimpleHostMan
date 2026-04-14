import { renderBaseStyleBlock } from "./base-styles.js";
import { escapeHtml, renderNotice } from "./html.js";
import { renderPanelShellStyleBlock } from "./panel-shell-styles.js";
import type { PanelShellProps } from "./ui-types.js";

export function renderPanelShell(props: PanelShellProps): string {
  const noticeHtml = renderNotice(props.notice);
  const actionsHtml = props.actions ? `<div class="hero-actions">${props.actions}</div>` : "";

  return `<!doctype html>
<html lang="${escapeHtml(props.lang ?? "en")}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(props.title)}</title>
    <style>
${renderBaseStyleBlock()}
${renderPanelShellStyleBlock()}
    </style>
  </head>
  <body>
    <main class="page">
      <header class="hero">
        <div class="hero-row">
          <div class="hero-copy">
            <p class="hero-eyebrow">${escapeHtml(props.eyebrow ?? "SimpleHost control plane")}</p>
            <h1>${escapeHtml(props.heading)}</h1>
          </div>
          ${actionsHtml}
        </div>
        ${noticeHtml}
      </header>
      ${props.body}
    </main>
  </body>
</html>`;
}
