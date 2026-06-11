import type { IamBindingSummary } from "@simplehost/control-contracts";

export interface RenderedIamApacheVhost {
  serverName: string;
  upstreamUrl: string;
  certificateName: string;
  content: string;
}

const pyrosaIamHeaderNames = [
  "X-Pyrosa-IAM-Gateway",
  "X-Pyrosa-IAM-User-Id",
  "X-Pyrosa-IAM-Email",
  "X-Pyrosa-IAM-Username",
  "X-Pyrosa-IAM-Role",
  "X-Pyrosa-IAM-Groups",
  "X-Pyrosa-IAM-Assurance-Level",
  "X-Pyrosa-IAM-Mfa",
  "X-Pyrosa-Account-User-Id",
  "X-Pyrosa-Accounts-User-Id"
];

function readObject(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function resolveServerName(binding: IamBindingSummary): string {
  const externalUrl = readString(binding.externalUrl);

  if (!externalUrl) {
    throw new Error(`IAM binding ${binding.bindingId} does not define externalUrl.`);
  }

  return new URL(externalUrl).hostname;
}

function resolveGatewayBridgeUrl(binding: IamBindingSummary): string {
  const gatewayProxy = readObject(binding.config.gatewayProxy);
  const bridgeListenUrl = readString(gatewayProxy?.bridgeListenUrl);

  if (bridgeListenUrl) {
    return ensureTrailingSlash(bridgeListenUrl);
  }

  const render = readObject(binding.config.render);
  const renderBridgeListenUrl = readString(render?.bridgeListenUrl);

  if (renderBridgeListenUrl) {
    return ensureTrailingSlash(renderBridgeListenUrl);
  }

  throw new Error(
    `IAM binding ${binding.bindingId} does not define gatewayProxy.bridgeListenUrl.`
  );
}

function resolveCertificateName(binding: IamBindingSummary, serverName: string): string {
  const render = readObject(binding.config.render);
  const configured = readString(render?.certificateName) ?? readString(render?.certificateDomain);

  if (configured) {
    return configured;
  }

  if (serverName.endsWith(".pyrosa.com.do")) {
    return "pyrosa.com.do";
  }

  return serverName;
}

function resolveLogName(binding: IamBindingSummary): string {
  const render = readObject(binding.config.render);
  const configured = readString(render?.logName);

  if (configured) {
    return configured;
  }

  return `${binding.targetSlug.replace(/[^a-zA-Z0-9_-]/g, "-")}_iam_bridge`;
}

export function renderPyrosaIamGatewayApacheVhost(
  binding: IamBindingSummary
): RenderedIamApacheVhost {
  if (binding.providerSlug !== "pyrosa-iam" || binding.authMode !== "proxy") {
    throw new Error(
      `IAM binding ${binding.bindingId} is not a pyrosa-iam proxy gateway binding.`
    );
  }

  const serverName = resolveServerName(binding);
  const upstreamUrl = resolveGatewayBridgeUrl(binding);
  const certificateName = resolveCertificateName(binding, serverName);
  const logName = resolveLogName(binding);
  const unsetHeaders = pyrosaIamHeaderNames
    .map((headerName) => `  RequestHeader unset ${headerName} early`)
    .join("\n");

  return {
    serverName,
    upstreamUrl,
    certificateName,
    content: `<VirtualHost *:80>
  ServerName ${serverName}

  RewriteEngine On
  RewriteCond %{REQUEST_URI} !^/\\.well-known/acme-challenge/
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L,NE]
</VirtualHost>

<IfModule mod_ssl.c>
<VirtualHost *:443>
  ServerName ${serverName}

  SSLEngine on
  SSLCertificateFile /etc/ssl/simplehostman/${certificateName}/fullchain.pem
  SSLCertificateKeyFile /etc/ssl/simplehostman/${certificateName}/privkey.pem

  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"

${unsetHeaders}

  RequestHeader set X-Forwarded-Proto "https"
  RequestHeader set X-Forwarded-Port "443"
  ProxyPreserveHost On
  ProxyRequests Off
  ProxyPass / ${upstreamUrl} retry=0 timeout=120
  ProxyPassReverse / ${upstreamUrl}

  ErrorLog /var/log/httpd/${logName}_ssl_error.log
  CustomLog /var/log/httpd/${logName}_ssl_access.log combined
</VirtualHost>
</IfModule>
`
  };
}

export function normalizeApacheVhostForParity(content: string): string {
  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .join("\n");
}
