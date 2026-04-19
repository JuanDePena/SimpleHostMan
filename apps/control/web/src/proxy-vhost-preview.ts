import { type ProxyRenderPayload } from "@simplehost/control-contracts";
import { escapeHtml, renderPanelShell } from "@simplehost/ui";

import { type WebLocale } from "./request.js";

export interface ProxyVhostPreview {
  serverName: string;
  httpVhost: string;
  httpsVhost: string;
}

function renderNumberedCodeBlock(content: string): string {
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  return `<div class="code-block code-block-light code-block-numbered">
    <div class="code-block-lines">
      ${lines
        .map(
          (line, index) => `<div class="code-block-line">
            <span class="code-block-line-number">${String(index + 1)}</span>
            <span class="code-block-line-text">${escapeHtml(line || " ")}</span>
          </div>`
        )
        .join("")}
    </div>
  </div>`;
}

function renderApacheHttpVhost(payload: ProxyRenderPayload): string {
  const aliases = payload.serverAliases ?? [];

  return [
    "<VirtualHost *:80>",
    `  ServerName ${payload.serverName}`,
    ...aliases.map((alias) => `  ServerAlias ${alias}`),
    "",
    "  RewriteEngine On",
    "  RewriteCond %{REQUEST_URI} !^/\\.well-known/acme-challenge/",
    `  RewriteRule ^/(.*)$ https://${payload.serverName}/$1 [R=301,L]`,
    "</VirtualHost>"
  ].join("\n");
}

function renderApacheHttpsVhost(payload: ProxyRenderPayload): string {
  const aliases = payload.serverAliases ?? [];
  const proxyPassUrl = payload.proxyPassUrl
    ? `${payload.proxyPassUrl.replace(/\/+$/, "")}/`
    : "http://127.0.0.1/";

  return [
    "<VirtualHost *:443>",
    `  ServerName ${payload.serverName}`,
    ...aliases.map((alias) => `  ServerAlias ${alias}`),
    "",
    "  SSLEngine on",
    `  SSLCertificateFile /etc/letsencrypt/live/${payload.serverName}/fullchain.pem`,
    `  SSLCertificateKeyFile /etc/letsencrypt/live/${payload.serverName}/privkey.pem`,
    "",
    `  ErrorLog logs/${payload.vhostName}_error.log`,
    `  CustomLog logs/${payload.vhostName}_access.log combined`,
    "",
    `  ProxyPreserveHost ${payload.proxyPreserveHost === false ? "Off" : "On"}`,
    "  ProxyRequests Off",
    `  ProxyPass / ${proxyPassUrl} retry=0 timeout=120`,
    `  ProxyPassReverse / ${proxyPassUrl}`,
    "",
    '  <Location "/healthz">',
    `    ProxyPass ${proxyPassUrl}healthz`,
    `    ProxyPassReverse ${proxyPassUrl}healthz`,
    "  </Location>",
    "</VirtualHost>"
  ].join("\n");
}

export function buildProxyVhostPreview(payload: ProxyRenderPayload): ProxyVhostPreview {
  return {
    serverName: payload.serverName,
    httpVhost: renderApacheHttpVhost(payload),
    httpsVhost: renderApacheHttpsVhost(payload)
  };
}

export function renderProxyVhostPage(args: {
  backHref: string;
  locale: WebLocale;
  payload: ProxyRenderPayload;
}): string {
  const { backHref, locale, payload } = args;
  const preview = buildProxyVhostPreview(payload);
  const heading = "Apache vhost";
  const eyebrow =
    locale === "es" ? "Vista previa del dominio seleccionado" : "Preview for the selected domain";
  const backLabel = locale === "es" ? "Volver a proxies" : "Back to proxies";
  const summary =
    locale === "es"
      ? "Configuracion generada a partir del payload actual de proxy.render para HTTP y HTTPS."
      : "Configuration generated from the current proxy.render payload for HTTP and HTTPS.";
  const httpLabel = "HTTP";
  const httpsLabel = locale === "es" ? "HTTPS / SSL" : "HTTPS / SSL";

  return renderPanelShell({
    lang: locale,
    title: `${heading} · ${payload.serverName}`,
    heading,
    eyebrow,
    actions: `<a class="button-link secondary" href="${escapeHtml(backHref)}">${escapeHtml(
      backLabel
    )}</a>`,
    body: `<section class="panel stack">
      <p class="muted">${escapeHtml(summary)}</p>
      <div class="proxy-vhost-preview-grid">
        <article class="panel panel-muted proxy-vhost-preview-panel stack">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(httpLabel)}</h3>
            </div>
          </div>
          ${renderNumberedCodeBlock(preview.httpVhost)}
        </article>
        <article class="panel panel-muted proxy-vhost-preview-panel stack">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(httpsLabel)}</h3>
            </div>
          </div>
          ${renderNumberedCodeBlock(preview.httpsVhost)}
        </article>
      </div>
    </section>`
  });
}
