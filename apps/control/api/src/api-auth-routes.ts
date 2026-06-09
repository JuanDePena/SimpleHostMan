import { readFile } from "node:fs/promises";

import type {
  AuthLoginRequest,
  CreateUserRequest,
  PyrosaAccountsOAuthLoginRequest
} from "@simplehost/control-contracts";

import { readJsonBody, writeJson } from "./api-http.js";
import type { ApiRouteHandler } from "./api-route-context.js";

interface OAuthIntrospectionResponse {
  active?: unknown;
  token_type?: unknown;
  client_id?: unknown;
  scope?: unknown;
  aud?: unknown;
  sub?: unknown;
  email?: unknown;
  username?: unknown;
  name?: unknown;
  principal_type?: unknown;
  assurance_level?: unknown;
}

interface OAuthTokenResponse {
  access_token?: unknown;
  token_type?: unknown;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeEmail(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const email = value.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
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

function normalizeScopeList(scope: string | null): string[] {
  return normalizeScopes(scope);
}

function hasScopes(scopes: string[], requiredScopes: string[]): boolean {
  return requiredScopes.every((scope) => scopes.includes(scope));
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

function deriveEndpoint(issuer: string | null, path: string): string | null {
  return issuer ? `${issuer.replace(/\/+$/, "")}${path}` : null;
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

function validateLoginIntrospection(args: {
  introspection: OAuthIntrospectionResponse;
  requiredScopes: string[];
  requiredAudience: string | null;
  requiredPrincipalType: string | null;
  requiredAssuranceLevel: string | null;
}):
  | { ok: true; scopes: string[] }
  | { ok: false; statusCode: number; error: string; message: string } {
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
      message: "OAuth access token is missing the required SimpleHostMan login scopes."
    };
  }

  if (!hasAudience(args.introspection.aud, args.requiredAudience)) {
    return {
      ok: false,
      statusCode: 403,
      error: "invalid_audience",
      message: "OAuth access token audience does not match SimpleHostMan."
    };
  }

  const principalType = readString(args.introspection.principal_type);
  if (args.requiredPrincipalType && principalType !== args.requiredPrincipalType) {
    return {
      ok: false,
      statusCode: 403,
      error: "invalid_principal_type",
      message: "OAuth access token principal type is not allowed for SimpleHostMan login."
    };
  }

  const assuranceLevel = readString(args.introspection.assurance_level);
  if (args.requiredAssuranceLevel && assuranceLevel !== args.requiredAssuranceLevel) {
    return {
      ok: false,
      statusCode: 403,
      error: "insufficient_assurance",
      message: "OAuth access token assurance level is below the SimpleHostMan login requirement."
    };
  }

  return { ok: true, scopes };
}

export const handleAuthRoutes: ApiRouteHandler = async ({
  request,
  response,
  url,
  bearerToken,
  controlPlaneStore,
  config
}) => {
  if (request.method === "POST" && url.pathname === "/v1/auth/login") {
    writeJson(
      response,
      200,
      await controlPlaneStore.loginUser(await readJsonBody<AuthLoginRequest>(request))
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/auth/pyrosa-accounts/oauth-login") {
    const resourceConfig = config.oauthResourceServer;

    if (!resourceConfig.loginEnabled) {
      writeJson(response, 503, {
        error: "oauth_login_disabled",
        message: "Pyrosa Accounts OAuth login is not enabled."
      });
      return true;
    }

    const tokenUrl = resourceConfig.tokenUrl ?? deriveEndpoint(resourceConfig.issuer, "/oauth/token");
    const introspectionUrl = resourceConfig.introspectionUrl;
    const requestBody = await readJsonBody<PyrosaAccountsOAuthLoginRequest>(request);

    if (
      !tokenUrl ||
      !introspectionUrl ||
      !resourceConfig.clientId ||
      !resourceConfig.loginRedirectUri
    ) {
      writeJson(response, 503, {
        error: "oauth_login_unavailable",
        message: "Pyrosa Accounts OAuth login is not fully configured."
      });
      return true;
    }

    if (
      requestBody.redirectUri !== resourceConfig.loginRedirectUri ||
      readString(requestBody.code) === null ||
      readString(requestBody.codeVerifier) === null
    ) {
      writeJson(response, 400, {
        error: "invalid_oauth_login_request",
        message: "OAuth login callback request is invalid."
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
        error: "oauth_login_unavailable",
        message: "Pyrosa Accounts OAuth client secret is unavailable."
      });
      return true;
    }

    let token: OAuthTokenResponse;
    try {
      token = await exchangeAuthorizationCode({
        tokenUrl,
        code: requestBody.code,
        redirectUri: requestBody.redirectUri,
        codeVerifier: requestBody.codeVerifier,
        clientId: resourceConfig.clientId,
        clientSecret,
        audience: resourceConfig.requiredAudience,
        timeoutMs: resourceConfig.introspectionTimeoutMs
      });
    } catch {
      writeJson(response, 502, {
        error: "oauth_token_exchange_failed",
        message: "Pyrosa Accounts OAuth authorization code exchange failed closed."
      });
      return true;
    }

    const accessToken = readString(token.access_token);
    if (!accessToken || readString(token.token_type) !== "Bearer") {
      writeJson(response, 502, {
        error: "invalid_token_response",
        message: "Pyrosa Accounts returned an invalid access token response."
      });
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
      writeJson(response, 503, {
        error: "oauth_introspection_unavailable",
        message: "Pyrosa Accounts OAuth introspection failed closed."
      });
      return true;
    }

    const validation = validateLoginIntrospection({
      introspection,
      requiredScopes: normalizeScopeList(resourceConfig.loginScope),
      requiredAudience: resourceConfig.requiredAudience,
      requiredPrincipalType: resourceConfig.loginRequiredPrincipalType,
      requiredAssuranceLevel: resourceConfig.loginRequiredAssuranceLevel
    });
    if (!validation.ok) {
      writeJson(response, validation.statusCode, {
        error: validation.error,
        message: validation.message
      });
      return true;
    }

    const email =
      normalizeEmail(readString(introspection.email)) ??
      normalizeEmail(readString(introspection.username));
    if (!email) {
      writeJson(response, 403, {
        error: "missing_email",
        message: "Pyrosa Accounts did not expose a valid email for SimpleHostMan login."
      });
      return true;
    }

    writeJson(
      response,
      200,
      await controlPlaneStore.loginOAuthUser({
        provider: "pyrosa-accounts",
        email,
        username: readString(introspection.username) ?? undefined,
        displayName: readString(introspection.name) ?? undefined,
        externalSubject: readString(introspection.sub) ?? email,
        mfaSatisfied: resourceConfig.loginRequiredAssuranceLevel
          ? readString(introspection.assurance_level) === resourceConfig.loginRequiredAssuranceLevel
          : undefined,
        assuranceLevel: readString(introspection.assurance_level) ?? undefined,
        clientId: readString(introspection.client_id) ?? undefined,
        scopes: validation.scopes,
        audience: typeof introspection.aud === "string" || Array.isArray(introspection.aud)
          ? introspection.aud
          : undefined,
        issuer: resourceConfig.issuer ?? undefined
      })
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/auth/me") {
    writeJson(response, 200, await controlPlaneStore.getCurrentUser(bearerToken));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/auth/logout") {
    writeJson(response, 200, await controlPlaneStore.logoutUser(bearerToken));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/users") {
    writeJson(response, 200, await controlPlaneStore.listUsers(bearerToken));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/users") {
    writeJson(
      response,
      201,
      await controlPlaneStore.createUser(
        await readJsonBody<CreateUserRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  return false;
};
