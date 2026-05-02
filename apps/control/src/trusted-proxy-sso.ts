import type { IncomingMessage } from "node:http";

import type { AuthLoginResponse, TrustedProxyLoginRequest } from "@simplehost/control-contracts";

import type { ControlBootstrapSurface } from "./bootstrap-surface.js";
import type { CombinedControlRequestContext } from "./request-context.js";

const sessionCookieName = "shp_session";

export interface TrustedProxyIdentity {
  email: string;
  username?: string;
  displayName?: string;
  groups: string[];
  remoteAddress?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readHeader(request: IncomingMessage, name: string): string | null {
  const value = request.headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value.find((entry) => entry.trim().length > 0)?.trim() ?? null;
  }

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isLoopbackRemoteAddress(remoteAddress: string | undefined): boolean {
  return (
    remoteAddress === "127.0.0.1" ||
    remoteAddress === "::1" ||
    remoteAddress === "::ffff:127.0.0.1"
  );
}

function normalizeEmail(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const email = value.trim().toLowerCase();

  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

function parseGroups(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[|,;]/)
    .map((group) => group.trim())
    .filter(Boolean);
}

export function readAuthentikTrustedProxyIdentity(
  request: IncomingMessage
): TrustedProxyIdentity | null {
  const remoteAddress = request.socket?.remoteAddress;

  if (!isLoopbackRemoteAddress(remoteAddress)) {
    return null;
  }

  const username = readHeader(request, "x-authentik-username") ?? undefined;
  const email =
    normalizeEmail(readHeader(request, "x-authentik-email")) ??
    normalizeEmail(username ?? null);

  if (!email) {
    return null;
  }

  return {
    email,
    username,
    displayName: readHeader(request, "x-authentik-name") ?? undefined,
    groups: parseGroups(readHeader(request, "x-authentik-groups")),
    remoteAddress
  };
}

function serializeSessionCookie(login: AuthLoginResponse): string {
  const maxAgeSeconds = Math.max(
    0,
    Math.floor((new Date(login.expiresAt).getTime() - Date.now()) / 1000)
  );

  return `${sessionCookieName}=${encodeURIComponent(login.sessionToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function buildTrustedProxyLoginRequest(
  identity: TrustedProxyIdentity
): TrustedProxyLoginRequest {
  return {
    email: identity.email,
    provider: "authentik",
    username: identity.username,
    displayName: identity.displayName,
    groups: identity.groups,
    remoteAddress: identity.remoteAddress
  };
}

function buildRedirectLocation(context: CombinedControlRequestContext): string {
  if (context.pathname === "/login") {
    return "/";
  }

  return `${context.pathname}${context.url.search}`;
}

function buildSsoSignOutLocation(): string {
  return `/outpost.goauthentik.io/sign_out?rd=${encodeURIComponent("/login")}`;
}

function isTrustedProxyAccessDeniedError(error: unknown): boolean {
  return error instanceof Error && error.name === "UserAuthorizationError";
}

function renderTrustedProxyAccessDeniedPage(identity: TrustedProxyIdentity): string {
  const email = escapeHtml(identity.email);
  const signOutHref = escapeHtml(buildSsoSignOutLocation());

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Acceso no provisionado | SimpleHostMan</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #eaf6ff;
        --panel: #ffffff;
        --text: #0d2038;
        --muted: #5e6b84;
        --accent: #0f7ae5;
        --border: rgba(13, 32, 56, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        min-height: 100vh;
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text);
        background: linear-gradient(135deg, #eef7ff 0%, var(--bg) 48%, #eefcf5 100%);
      }

      main {
        width: min(42rem, calc(100vw - 2rem));
        margin: 0 auto;
        padding: 7vh 0 2rem;
      }

      header {
        margin-bottom: 1rem;
        padding: 1.1rem 1.25rem;
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        background: rgba(255, 255, 255, 0.88);
        text-align: center;
      }

      h1,
      h2,
      p {
        margin: 0;
      }

      h1 {
        font-size: 2.1rem;
        line-height: 1.05;
      }

      header p {
        margin-top: 0.45rem;
        color: var(--muted);
        line-height: 1.45;
      }

      section {
        display: grid;
        gap: 1rem;
        padding: 1.25rem;
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        background: var(--panel);
        box-shadow: 0 1.4rem 3.4rem rgba(16, 39, 68, 0.16);
      }

      .summary {
        display: grid;
        gap: 0.4rem;
      }

      .summary h2 {
        font-size: 1.18rem;
      }

      .summary p {
        color: var(--muted);
        line-height: 1.55;
      }

      .identity {
        display: grid;
        gap: 0.2rem;
        padding: 0.78rem 0.85rem;
        border: 1px solid rgba(15, 122, 229, 0.15);
        border-radius: 0.5rem;
        background: rgba(15, 122, 229, 0.06);
        overflow-wrap: anywhere;
      }

      .identity span {
        color: var(--muted);
        font-size: 0.82rem;
        text-transform: uppercase;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
      }

      a {
        color: inherit;
      }

      .button {
        display: inline-flex;
        min-height: 2.65rem;
        align-items: center;
        justify-content: center;
        padding: 0.68rem 0.95rem;
        border-radius: 0.45rem;
        background: var(--accent);
        color: #fff;
        font-weight: 700;
        text-decoration: none;
      }

      .button.secondary {
        border: 1px solid var(--border);
        background: #fff;
        color: var(--text);
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>SimpleHostMan</h1>
        <p>Control de acceso SSO</p>
      </header>
      <section>
        <div class="summary">
          <h2>Acceso no provisionado</h2>
          <p>Authentik validó la identidad, pero no hay una cuenta activa de SimpleHostMan asociada a este correo.</p>
        </div>
        <div class="identity">
          <span>Correo recibido por SSO</span>
          <strong>${email}</strong>
        </div>
        <p>Un administrador de SimpleHostMan debe crear o activar la cuenta antes de permitir el acceso al panel.</p>
        <div class="actions">
          <a class="button" href="${signOutHref}">Cerrar sesión SSO</a>
          <a class="button secondary" href="/">Volver a intentar</a>
        </div>
      </section>
    </main>
  </body>
</html>`;
}

function writeTrustedProxyAccessDeniedPage(
  context: CombinedControlRequestContext,
  identity: TrustedProxyIdentity
): void {
  context.response.writeHead(403, {
    "cache-control": "no-store",
    "content-type": "text/html; charset=utf-8"
  });
  context.response.end(renderTrustedProxyAccessDeniedPage(identity));
}

export async function maybeCreateTrustedProxySession(args: {
  context: CombinedControlRequestContext;
  auth: ControlBootstrapSurface["auth"];
}): Promise<boolean> {
  if (args.context.sessionToken || args.context.method !== "GET") {
    return false;
  }

  if (!args.auth.loginTrustedProxy) {
    return false;
  }

  const identity = readAuthentikTrustedProxyIdentity(args.context.request);

  if (!identity) {
    return false;
  }

  let login: AuthLoginResponse;

  try {
    login = await args.auth.loginTrustedProxy(buildTrustedProxyLoginRequest(identity));
  } catch (error) {
    if (!isTrustedProxyAccessDeniedError(error)) {
      throw error;
    }

    writeTrustedProxyAccessDeniedPage(args.context, identity);
    return true;
  }

  args.context.response.writeHead(303, {
    location: buildRedirectLocation(args.context),
    "set-cookie": serializeSessionCookie(login)
  });
  args.context.response.end();
  return true;
}
