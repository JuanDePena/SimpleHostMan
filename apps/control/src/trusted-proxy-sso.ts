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

  const login = await args.auth.loginTrustedProxy(buildTrustedProxyLoginRequest(identity));

  args.context.response.writeHead(303, {
    location: buildRedirectLocation(args.context),
    "set-cookie": serializeSessionCookie(login)
  });
  args.context.response.end();
  return true;
}
