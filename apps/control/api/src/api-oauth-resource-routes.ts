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
  exp?: unknown;
  iat?: unknown;
}

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

export const handleOAuthResourceRoutes: ApiRouteHandler = async ({
  request,
  response,
  url,
  bearerToken,
  config
}) => {
  if (request.method !== "GET" || url.pathname !== "/v1/oauth/pilot/profile") {
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

  if (introspection.active !== true || introspection.token_type !== "access_token") {
    writeJson(response, 401, {
      error: "invalid_token",
      message: "OAuth access token is not active."
    });
    return true;
  }

  const scopes = normalizeScopes(introspection.scope);
  if (resourceConfig.requiredScope && !scopes.includes(resourceConfig.requiredScope)) {
    writeJson(response, 403, {
      error: "insufficient_scope",
      message: "OAuth access token is missing the required scope.",
      requiredScope: resourceConfig.requiredScope
    });
    return true;
  }

  if (!hasAudience(introspection.aud, resourceConfig.requiredAudience)) {
    writeJson(response, 403, {
      error: "invalid_audience",
      message: "OAuth access token audience does not match this resource server.",
      requiredAudience: resourceConfig.requiredAudience
    });
    return true;
  }

  writeJson(response, 200, {
    status: "ok",
    provider: "pyrosa-accounts",
    issuer: resourceConfig.issuer,
    resource: "simplehost-control",
    clientId: readString(introspection.client_id),
    subject: readString(introspection.sub),
    username: readString(introspection.username),
    name: readString(introspection.name),
    principalType: readString(introspection.principal_type),
    tokenType: "access_token",
    scope: scopes,
    audience: introspection.aud,
    expiresAt: typeof introspection.exp === "number"
      ? new Date(introspection.exp * 1000).toISOString()
      : null,
    issuedAt: typeof introspection.iat === "number"
      ? new Date(introspection.iat * 1000).toISOString()
      : null
  });
  return true;
};
