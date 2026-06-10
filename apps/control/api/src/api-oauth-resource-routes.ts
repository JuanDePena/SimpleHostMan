import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

import { writeJson } from "./api-http.js";
import type { ApiRouteHandler } from "./api-route-context.js";

interface OAuthIntrospectionResponse {
  active?: unknown;
  token_type?: unknown;
  client_id?: unknown;
  scope?: unknown;
  aud?: unknown;
  sub?: unknown;
  username?: unknown;
  name?: unknown;
  principal_type?: unknown;
  assurance_level?: unknown;
  exp?: unknown;
  iat?: unknown;
}

interface OAuthTokenResponse {
  access_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  scope?: unknown;
}

interface OAuthPilotState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}

const pilotCookieName = "shp_oauth_pilot";
const pilotCookieMaxAgeSeconds = 10 * 60;

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeScopes(scope: unknown): string[] {
  if (typeof scope === "string") {
    return scope.split(/\s+/).map((value) => value.trim()).filter(Boolean);
  }

  if (Array.isArray(scope)) {
    return scope.map(readString).filter((value): value is string => Boolean(value));
  }

  return [];
}

function hasAudience(aud: unknown, requiredAudience: string | null): boolean {
  if (!requiredAudience) {
    return true;
  }

  if (typeof aud === "string") {
    return aud === requiredAudience;
  }

  return Array.isArray(aud) && aud.includes(requiredAudience);
}

function hasScopes(scopes: string[], requiredScopes: string[]): boolean {
  return requiredScopes.every((scope) => scopes.includes(scope));
}

function normalizeScopeList(scope: string | null): string[] {
  return normalizeScopes(scope);
}

function deriveEndpoint(issuer: string | null, path: string): string | null {
  return issuer ? `${issuer.replace(/\/+$/, "")}${path}` : null;
}

function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function encodePilotState(state: OAuthPilotState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

function decodePilotState(value: string | null): OAuthPilotState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<OAuthPilotState>;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.codeVerifier !== "string" ||
      typeof parsed.redirectUri !== "string" ||
      typeof parsed.createdAt !== "number"
    ) {
      return null;
    }
    return {
      state: parsed.state,
      codeVerifier: parsed.codeVerifier,
      redirectUri: parsed.redirectUri,
      createdAt: parsed.createdAt
    };
  } catch {
    return null;
  }
}

function readCookie(header: string | string[] | undefined, name: string): string | null {
  const raw = Array.isArray(header) ? header.join(";") : header;
  if (!raw) {
    return null;
  }

  for (const part of raw.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

function serializePilotCookie(value: string): string {
  return `${pilotCookieName}=${encodeURIComponent(value)}; Path=/v1/oauth/pilot; HttpOnly; Secure; SameSite=Lax; Max-Age=${pilotCookieMaxAgeSeconds}`;
}

function clearPilotCookie(): string {
  return `${pilotCookieName}=; Path=/v1/oauth/pilot; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function redirect(response: Parameters<ApiRouteHandler>[0]["response"], location: string, cookie?: string): void {
  response.writeHead(303, {
    location,
    ...(cookie ? { "set-cookie": cookie } : {})
  });
  response.end();
}

function writeHtml(
  response: Parameters<ApiRouteHandler>[0]["response"],
  statusCode: number,
  html: string,
  cookie?: string
): void {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    ...(cookie ? { "set-cookie": cookie } : {})
  });
  response.end(html);
}

function renderPilotResultHtml(args: {
  title: string;
  status: "ok" | "error";
  message: string;
  details?: Record<string, unknown>;
}): string {
  const details = args.details
    ? `<pre>${escapeHtml(JSON.stringify(args.details, null, 2))}</pre>`
    : "";
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(args.title)}</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #061019; color: #eef4ff; }
    main { width: min(720px, calc(100vw - 32px)); border: 1px solid #244055; border-radius: 8px; padding: 28px; background: #0b1722; }
    .status { color: ${args.status === "ok" ? "#8bd17c" : "#ff9b8c"}; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
    pre { overflow: auto; padding: 16px; border-radius: 6px; background: #050b11; color: #d6e6f5; }
  </style>
</head>
<body>
  <main>
    <p class="status">${escapeHtml(args.status)}</p>
    <h1>${escapeHtml(args.title)}</h1>
    <p>${escapeHtml(args.message)}</p>
    ${details}
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

async function readClientSecret(args: {
  clientSecret: string | null;
  clientSecretFile: string | null;
}): Promise<string | null> {
  if (args.clientSecret) {
    return args.clientSecret;
  }

  if (!args.clientSecretFile) {
    return null;
  }

  const secret = (await readFile(args.clientSecretFile, "utf8")).trim();
  return secret.length > 0 ? secret : null;
}

async function introspectToken(args: {
  introspectionUrl: string;
  token: string;
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
}): Promise<OAuthIntrospectionResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    const response = await fetch(args.introspectionUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        token: args.token,
        token_type_hint: "access_token",
        client_id: args.clientId,
        client_secret: args.clientSecret
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`OAuth introspection failed with HTTP ${response.status}.`);
    }

    return await response.json() as OAuthIntrospectionResponse;
  } finally {
    clearTimeout(timeout);
  }
}

async function exchangeAuthorizationCode(args: {
  tokenUrl: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  audience: string | null;
  timeoutMs: number;
}): Promise<OAuthTokenResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.redirectUri,
    code_verifier: args.codeVerifier,
    client_id: args.clientId,
    client_secret: args.clientSecret
  });

  if (args.audience) {
    body.set("audience", args.audience);
  }

  try {
    const response = await fetch(args.tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`OAuth token exchange failed with HTTP ${response.status}.`);
    }

    return await response.json() as OAuthTokenResponse;
  } finally {
    clearTimeout(timeout);
  }
}

async function revokeToken(args: {
  revocationUrl: string;
  token: string;
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
}): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    await fetch(args.revocationUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        token: args.token,
        token_type_hint: "access_token",
        client_id: args.clientId,
        client_secret: args.clientSecret
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildProfilePayload(args: {
  resourceConfig: {
    issuer: string | null;
  };
  introspection: OAuthIntrospectionResponse;
  scopes: string[];
}): Record<string, unknown> {
  return {
    status: "ok",
    provider: "pyrosa-iam",
    issuer: args.resourceConfig.issuer,
    resource: "simplehost-control",
    clientId: readString(args.introspection.client_id),
    subject: readString(args.introspection.sub),
    username: readString(args.introspection.username),
    name: readString(args.introspection.name),
    principalType: readString(args.introspection.principal_type),
    assuranceLevel: readString(args.introspection.assurance_level),
    tokenType: "access_token",
    scope: args.scopes,
    audience: args.introspection.aud,
    expiresAt: typeof args.introspection.exp === "number"
      ? new Date(args.introspection.exp * 1000).toISOString()
      : null,
    issuedAt: typeof args.introspection.iat === "number"
      ? new Date(args.introspection.iat * 1000).toISOString()
      : null
  };
}

function validateIntrospection(args: {
  introspection: OAuthIntrospectionResponse;
  requiredScopes: string[];
  requiredAudience: string | null;
  requiredPrincipalType: string | null;
  requiredAssuranceLevel: string | null;
}): { ok: true; scopes: string[] } | { ok: false; statusCode: number; error: string; message: string; extra?: Record<string, unknown> } {
  if (args.introspection.active !== true || args.introspection.token_type !== "access_token") {
    return {
      ok: false,
      statusCode: 401,
      error: "invalid_token",
      message: "OAuth access token is not active."
    };
  }

  const scopes = normalizeScopes(args.introspection.scope);
  if (!hasScopes(scopes, args.requiredScopes)) {
    return {
      ok: false,
      statusCode: 403,
      error: "insufficient_scope",
      message: "OAuth access token is missing the required scope.",
      extra: { requiredScopes: args.requiredScopes }
    };
  }

  if (!hasAudience(args.introspection.aud, args.requiredAudience)) {
    return {
      ok: false,
      statusCode: 403,
      error: "invalid_audience",
      message: "OAuth access token audience does not match this resource server.",
      extra: { requiredAudience: args.requiredAudience }
    };
  }

  const principalType = readString(args.introspection.principal_type);
  if (args.requiredPrincipalType && principalType !== args.requiredPrincipalType) {
    return {
      ok: false,
      statusCode: 403,
      error: "invalid_principal_type",
      message: "OAuth access token principal type does not match this pilot.",
      extra: { requiredPrincipalType: args.requiredPrincipalType }
    };
  }

  const assuranceLevel = readString(args.introspection.assurance_level);
  if (args.requiredAssuranceLevel && assuranceLevel !== args.requiredAssuranceLevel) {
    return {
      ok: false,
      statusCode: 403,
      error: "insufficient_assurance",
      message: "OAuth access token assurance level does not match this pilot.",
      extra: { requiredAssuranceLevel: args.requiredAssuranceLevel }
    };
  }

  return { ok: true, scopes };
}

export const handleOAuthResourceRoutes: ApiRouteHandler = async ({
  request,
  response,
  url,
  bearerToken,
  config
}) => {
  if (request.method !== "GET" || !url.pathname.startsWith("/v1/oauth/pilot/")) {
    return false;
  }

  const resourceConfig = config.oauthResourceServer;

  if (!resourceConfig.enabled) {
    writeJson(response, 503, {
      error: "oauth_resource_server_disabled",
      message: "OAuth resource-server pilot is not enabled."
    });
    return true;
  }

  if (url.pathname === "/v1/oauth/pilot/start") {
    const authorizationUrl =
      resourceConfig.authorizationUrl ?? deriveEndpoint(resourceConfig.issuer, "/oauth/authorize");
    const redirectUri = resourceConfig.pilotRedirectUri;

    if (!authorizationUrl || !resourceConfig.clientId || !redirectUri) {
      writeJson(response, 503, {
        error: "oauth_resource_server_unavailable",
        message: "OAuth browser pilot is not fully configured."
      });
      return true;
    }

    const state = randomBytes(24).toString("base64url");
    const pkce = createPkcePair();
    const scope = resourceConfig.pilotScope ?? resourceConfig.requiredScope ?? "profile:read";
    const authorize = new URL(authorizationUrl);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", resourceConfig.clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("scope", scope);
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("code_challenge", pkce.challenge);
    authorize.searchParams.set("code_challenge_method", "S256");

    redirect(
      response,
      authorize.toString(),
      serializePilotCookie(encodePilotState({
        state,
        codeVerifier: pkce.verifier,
        redirectUri,
        createdAt: Date.now()
      }))
    );
    return true;
  }

  if (url.pathname === "/v1/oauth/pilot/callback") {
    const wantsJson = url.searchParams.get("format") === "json";
    const writeCallbackError = (
      statusCode: number,
      error: string,
      message: string,
      extra: Record<string, unknown> = {}
    ) => {
      if (wantsJson) {
        writeJson(response, statusCode, { error, message, ...extra });
      } else {
        writeHtml(
          response,
          statusCode,
          renderPilotResultHtml({
            title: "OAuth pilot failed",
            status: "error",
            message,
            details: { error, ...extra }
          }),
          clearPilotCookie()
        );
      }
    };

    const tokenUrl = resourceConfig.tokenUrl ?? deriveEndpoint(resourceConfig.issuer, "/oauth/token");
    const introspectionUrl = resourceConfig.introspectionUrl;
    const revocationUrl = resourceConfig.revocationUrl ?? deriveEndpoint(resourceConfig.issuer, "/oauth/revoke");
    if (!tokenUrl || !introspectionUrl || !resourceConfig.clientId) {
      writeCallbackError(503, "oauth_resource_server_unavailable", "OAuth browser pilot is not fully configured.");
      return true;
    }

    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const upstreamError = url.searchParams.get("error");
    if (upstreamError) {
      writeCallbackError(400, upstreamError, url.searchParams.get("error_description") ?? "OAuth provider returned an error.");
      return true;
    }
    if (!state || !code) {
      writeCallbackError(400, "invalid_request", "OAuth callback is missing state or code.");
      return true;
    }

    const pilotState = decodePilotState(readCookie(request.headers.cookie, pilotCookieName));
    if (
      !pilotState ||
      pilotState.state !== state ||
      Date.now() - pilotState.createdAt > pilotCookieMaxAgeSeconds * 1000
    ) {
      writeCallbackError(400, "invalid_state", "OAuth pilot state is missing, expired or mismatched.");
      return true;
    }

    let clientSecret: string | null;
    try {
      clientSecret = await readClientSecret(resourceConfig);
    } catch {
      clientSecret = null;
    }

    if (!clientSecret) {
      writeCallbackError(503, "oauth_resource_server_unavailable", "OAuth resource-server client secret is unavailable.");
      return true;
    }

    let token: OAuthTokenResponse;
    try {
      token = await exchangeAuthorizationCode({
        tokenUrl,
        code,
        redirectUri: pilotState.redirectUri,
        codeVerifier: pilotState.codeVerifier,
        clientId: resourceConfig.clientId,
        clientSecret,
        audience: resourceConfig.requiredAudience,
        timeoutMs: resourceConfig.introspectionTimeoutMs
      });
    } catch {
      writeCallbackError(502, "oauth_token_exchange_failed", "OAuth authorization code exchange failed closed.");
      return true;
    }

    const accessToken = readString(token.access_token);
    if (!accessToken || readString(token.token_type) !== "Bearer") {
      writeCallbackError(502, "invalid_token_response", "OAuth token endpoint returned an invalid access token response.");
      return true;
    }

    let introspection: OAuthIntrospectionResponse;
    try {
      introspection = await introspectToken({
        introspectionUrl,
        token: accessToken,
        clientId: resourceConfig.clientId,
        clientSecret,
        timeoutMs: resourceConfig.introspectionTimeoutMs
      });
    } catch {
      writeCallbackError(503, "oauth_introspection_unavailable", "OAuth introspection failed closed.");
      return true;
    } finally {
      if (resourceConfig.pilotRevokeTokens && revocationUrl) {
        await revokeToken({
          revocationUrl,
          token: accessToken,
          clientId: resourceConfig.clientId,
          clientSecret,
          timeoutMs: resourceConfig.introspectionTimeoutMs
        }).catch(() => undefined);
      }
    }

    const requiredScopes = normalizeScopeList(resourceConfig.pilotScope ?? resourceConfig.requiredScope);
    const validation = validateIntrospection({
      introspection,
      requiredScopes,
      requiredAudience: resourceConfig.requiredAudience,
      requiredPrincipalType: resourceConfig.pilotRequiredPrincipalType,
      requiredAssuranceLevel: resourceConfig.pilotRequiredAssuranceLevel
    });
    if (!validation.ok) {
      writeCallbackError(validation.statusCode, validation.error, validation.message, validation.extra);
      return true;
    }

    const payload = buildProfilePayload({
      resourceConfig,
      introspection,
      scopes: validation.scopes
    });
    if (wantsJson) {
      response.setHeader("set-cookie", clearPilotCookie());
      writeJson(response, 200, payload);
      return true;
    }

    writeHtml(
      response,
      200,
      renderPilotResultHtml({
        title: "OAuth pilot validated",
        status: "ok",
        message: "Pyrosa IAM issued and introspected a browser Authorization Code token successfully.",
        details: payload
      }),
      clearPilotCookie()
    );
    return true;
  }

  if (url.pathname !== "/v1/oauth/pilot/profile") {
    return false;
  }

  if (!bearerToken) {
    writeJson(response, 401, {
      error: "invalid_token",
      message: "Missing OAuth bearer token."
    });
    return true;
  }

  if (!resourceConfig.introspectionUrl || !resourceConfig.clientId) {
    writeJson(response, 503, {
      error: "oauth_resource_server_unavailable",
      message: "OAuth introspection is not fully configured."
    });
    return true;
  }

  let clientSecret: string | null;
  try {
    clientSecret = await readClientSecret(resourceConfig);
  } catch {
    clientSecret = null;
  }

  if (!clientSecret) {
    writeJson(response, 503, {
      error: "oauth_resource_server_unavailable",
      message: "OAuth resource-server client secret is unavailable."
    });
    return true;
  }

  let introspection: OAuthIntrospectionResponse;
  try {
    introspection = await introspectToken({
      introspectionUrl: resourceConfig.introspectionUrl,
      token: bearerToken,
      clientId: resourceConfig.clientId,
      clientSecret,
      timeoutMs: resourceConfig.introspectionTimeoutMs
    });
  } catch {
    writeJson(response, 503, {
      error: "oauth_introspection_unavailable",
      message: "OAuth introspection failed closed."
    });
    return true;
  }

  const validation = validateIntrospection({
    introspection,
    requiredScopes: normalizeScopeList(resourceConfig.requiredScope),
    requiredAudience: resourceConfig.requiredAudience,
    requiredPrincipalType: resourceConfig.requiredPrincipalType,
    requiredAssuranceLevel: resourceConfig.requiredAssuranceLevel
  });
  if (!validation.ok) {
    writeJson(response, validation.statusCode, {
      error: validation.error,
      message: validation.message,
      ...validation.extra
    });
    return true;
  }

  writeJson(response, 200, buildProfilePayload({
    resourceConfig,
    introspection,
    scopes: validation.scopes
  }));
  return true;
};
