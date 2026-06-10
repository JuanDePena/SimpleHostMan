import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import type {
  AuthLoginRequest,
  CreateUserRequest,
  OAuthLoginProviderSlug,
  OAuthProviderLoginRequest,
  OAuthProviderRevokeRequest
} from "@simplehost/control-contracts";
import { UserAuthorizationError } from "@simplehost/control-database";

import { readJsonBody, writeJson } from "./api-http.js";
import type { ApiRouteHandler } from "./api-route-context.js";

interface OAuthIntrospectionResponse {
  active?: unknown;
  token_type?: unknown;
  tokenType?: unknown;
  client_id?: unknown;
  clientId?: unknown;
  scope?: unknown;
  aud?: unknown;
  audience?: unknown;
  sub?: unknown;
  subject?: unknown;
  email?: unknown;
  username?: unknown;
  name?: unknown;
  roles?: unknown;
  groups?: unknown;
  principal_type?: unknown;
  principalType?: unknown;
  assurance_level?: unknown;
  assuranceLevel?: unknown;
  issuer?: unknown;
  acr?: unknown;
  amr?: unknown;
}

interface OAuthTokenResponse {
  access_token?: unknown;
  token_type?: unknown;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readOAuthLoginProviderSlug(_value: string | null | undefined): OAuthLoginProviderSlug {
  return "pyrosa-iam";
}

function formatOAuthProviderName(_provider: OAuthLoginProviderSlug): string {
  return "Pyrosa IAM";
}

function matchOAuthProviderRoute(
  pathname: string,
  action: "oauth-login" | "oauth-revoke"
): OAuthLoginProviderSlug | null {
  const match = /^\/v1\/auth\/([^/]+)\/(oauth-login|oauth-revoke)$/.exec(pathname);
  if (!match || match[2] !== action) {
    return null;
  }

  if (match[1] === "pyrosa-iam") {
    return match[1];
  }

  return null;
}

function normalizeEmail(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const email = value.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

function hashOAuthToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isUserAuthorizationError(error: unknown): boolean {
  return (
    error instanceof UserAuthorizationError ||
    (error instanceof Error && error.name === "UserAuthorizationError")
  );
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

function readTokenType(introspection: OAuthIntrospectionResponse): string | null {
  return readString(introspection.token_type) ?? readString(introspection.tokenType);
}

function readClientId(introspection: OAuthIntrospectionResponse): string | null {
  return readString(introspection.client_id) ?? readString(introspection.clientId);
}

function readAudience(introspection: OAuthIntrospectionResponse): unknown {
  return introspection.aud ?? introspection.audience;
}

function readSubject(introspection: OAuthIntrospectionResponse): string | null {
  return readString(introspection.sub) ?? readString(introspection.subject);
}

function readPrincipalType(introspection: OAuthIntrospectionResponse): string | null {
  return readString(introspection.principal_type) ?? readString(introspection.principalType);
}

function readAssuranceLevel(introspection: OAuthIntrospectionResponse): string | null {
  return (
    readString(introspection.assurance_level) ??
    readString(introspection.assuranceLevel) ??
    readString(introspection.acr)
  );
}

function readIssuer(introspection: OAuthIntrospectionResponse): string | null {
  return readString(introspection.issuer);
}

function normalizeClaimList(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split(/[,\s]+/).map((entry) => entry.trim()).filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.map(readString).filter((entry): entry is string => Boolean(entry));
  }

  return [];
}

function hasRequiredClaim(values: string[], requiredValue: string | null): boolean {
  if (!requiredValue) {
    return true;
  }

  const normalizedRequired = requiredValue.trim().toLowerCase();
  return values.some((value) => value.trim().toLowerCase() === normalizedRequired);
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
  clientSecret: string | null;
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
    client_id: args.clientId
  });

  if (args.clientSecret) {
    body.set("client_secret", args.clientSecret);
  }

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
  clientSecret: string | null;
  timeoutMs: number;
}): Promise<OAuthIntrospectionResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const body = new URLSearchParams({
    token: args.token,
    token_type_hint: "access_token",
    client_id: args.clientId
  });

  if (args.clientSecret) {
    body.set("client_secret", args.clientSecret);
  }

  try {
    const response = await fetch(args.introspectionUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body,
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

async function revokeToken(args: {
  revocationUrl: string;
  token: string;
  clientId: string;
  clientSecret: string | null;
  timeoutMs: number;
}): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const body = new URLSearchParams({
    token: args.token,
    token_type_hint: "access_token",
    client_id: args.clientId
  });

  if (args.clientSecret) {
    body.set("client_secret", args.clientSecret);
  }

  try {
    const response = await fetch(args.revocationUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`OAuth revocation failed with HTTP ${response.status}.`);
    }
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
  requiredGroup: string | null;
}):
  | { ok: true; scopes: string[] }
  | { ok: false; statusCode: number; error: string; message: string } {
  if (args.introspection.active !== true || readTokenType(args.introspection) !== "access_token") {
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

  if (!hasAudience(readAudience(args.introspection), args.requiredAudience)) {
    return {
      ok: false,
      statusCode: 403,
      error: "invalid_audience",
      message: "OAuth access token audience does not match SimpleHostMan."
    };
  }

  const principalType = readPrincipalType(args.introspection);
  if (args.requiredPrincipalType && principalType !== args.requiredPrincipalType) {
    return {
      ok: false,
      statusCode: 403,
      error: "invalid_principal_type",
      message: "OAuth access token principal type is not allowed for SimpleHostMan login."
    };
  }

  const assuranceLevel = readAssuranceLevel(args.introspection);
  if (args.requiredAssuranceLevel && assuranceLevel !== args.requiredAssuranceLevel) {
    return {
      ok: false,
      statusCode: 403,
      error: "insufficient_assurance",
      message: "OAuth access token assurance level is below the SimpleHostMan login requirement."
    };
  }

  const providerGroups = [
    ...normalizeClaimList(args.introspection.groups),
    ...normalizeClaimList(args.introspection.roles)
  ];
  if (!hasRequiredClaim(providerGroups, args.requiredGroup)) {
    return {
      ok: false,
      statusCode: 403,
      error: "missing_provider_group",
      message: "OAuth access token is missing the required provider group for SimpleHostMan login."
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

  const oauthLoginProvider = matchOAuthProviderRoute(url.pathname, "oauth-login");
  if (request.method === "POST" && oauthLoginProvider) {
    const resourceConfig = config.oauthResourceServer;
    const provider = readOAuthLoginProviderSlug(resourceConfig.loginProviderSlug);
    const providerName = formatOAuthProviderName(provider);

    if (oauthLoginProvider !== provider) {
      writeJson(response, 404, {
        error: "oauth_provider_not_configured",
        message: `${formatOAuthProviderName(oauthLoginProvider)} OAuth login is not configured on this SimpleHostMan runtime.`
      });
      return true;
    }

    if (!resourceConfig.loginEnabled) {
      writeJson(response, 503, {
        error: "oauth_login_disabled",
        message: `${providerName} OAuth login is not enabled.`
      });
      await controlPlaneStore.recordOAuthLoginRejected({
        provider,
        reason: "oauth_login_disabled"
      });
      return true;
    }

    const tokenUrl = resourceConfig.tokenUrl ?? deriveEndpoint(resourceConfig.issuer, "/oauth/token");
    const introspectionUrl = resourceConfig.introspectionUrl;
    const requestBody = await readJsonBody<OAuthProviderLoginRequest>(request);

    if (
      !tokenUrl ||
      !introspectionUrl ||
      !resourceConfig.clientId ||
      !resourceConfig.loginRedirectUri
    ) {
      writeJson(response, 503, {
        error: "oauth_login_unavailable",
        message: `${providerName} OAuth login is not fully configured.`
      });
      await controlPlaneStore.recordOAuthLoginRejected({
        provider,
        reason: "oauth_login_unavailable"
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
      await controlPlaneStore.recordOAuthLoginRejected({
        provider,
        reason: "invalid_oauth_login_request"
      });
      return true;
    }

    let clientSecret: string | null;
    try {
      clientSecret = await readClientSecret(resourceConfig);
    } catch {
      writeJson(response, 503, {
        error: "oauth_login_unavailable",
        message: `${providerName} OAuth client secret is unavailable.`
      });
      await controlPlaneStore.recordOAuthLoginRejected({
        provider,
        reason: "oauth_client_secret_unavailable"
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
        message: `${providerName} OAuth authorization code exchange failed closed.`
      });
      await controlPlaneStore.recordOAuthLoginRejected({
        provider,
        reason: "oauth_token_exchange_failed"
      });
      return true;
    }

    const accessToken = readString(token.access_token);
    if (!accessToken || readString(token.token_type) !== "Bearer") {
      writeJson(response, 502, {
        error: "invalid_token_response",
        message: `${providerName} returned an invalid access token response.`
      });
      await controlPlaneStore.recordOAuthLoginRejected({
        provider,
        reason: "invalid_token_response"
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
        message: `${providerName} OAuth introspection failed closed.`
      });
      await controlPlaneStore.recordOAuthLoginRejected({
        provider,
        reason: "oauth_introspection_unavailable"
      });
      return true;
    }

    const validation = validateLoginIntrospection({
      introspection,
      requiredScopes: normalizeScopeList(resourceConfig.loginScope),
      requiredAudience: resourceConfig.requiredAudience,
      requiredPrincipalType: resourceConfig.loginRequiredPrincipalType,
      requiredAssuranceLevel: resourceConfig.loginRequiredAssuranceLevel,
      requiredGroup: resourceConfig.loginRequiredGroup
    });
    if (!validation.ok) {
      writeJson(response, validation.statusCode, {
        error: validation.error,
        message: validation.message
      });
      await controlPlaneStore.recordOAuthLoginRejected({
        provider,
        reason: validation.error,
        clientId: readClientId(introspection) ?? undefined,
        externalSubject: readSubject(introspection) ?? undefined,
        assuranceLevel: readAssuranceLevel(introspection) ?? undefined
      });
      return true;
    }

    const email =
      normalizeEmail(readString(introspection.email)) ??
      normalizeEmail(readString(introspection.username));
    if (!email) {
      writeJson(response, 403, {
        error: "missing_email",
        message: `${providerName} did not expose a valid email for SimpleHostMan login.`
      });
      await controlPlaneStore.recordOAuthLoginRejected({
        provider,
        reason: "missing_email",
        clientId: readClientId(introspection) ?? undefined,
        externalSubject: readSubject(introspection) ?? undefined,
        assuranceLevel: readAssuranceLevel(introspection) ?? undefined
      });
      return true;
    }

    const tokenHash = hashOAuthToken(accessToken);
    const clientId = readClientId(introspection);
    const externalSubject = readSubject(introspection) ?? email;
    const assuranceLevel = readAssuranceLevel(introspection);
    const audience = readAudience(introspection);
    const issuer = readIssuer(introspection) ?? resourceConfig.issuer ?? undefined;
    let login;
    try {
      login = await controlPlaneStore.loginOAuthUser({
        provider,
        email,
        username: readString(introspection.username) ?? undefined,
        displayName: readString(introspection.name) ?? undefined,
        externalSubject,
        mfaSatisfied: resourceConfig.loginRequiredAssuranceLevel
          ? assuranceLevel === resourceConfig.loginRequiredAssuranceLevel
          : undefined,
        assuranceLevel: assuranceLevel ?? undefined,
        clientId: clientId ?? undefined,
        scopes: validation.scopes,
        audience: typeof audience === "string" || Array.isArray(audience)
          ? audience
          : undefined,
        issuer,
        oauthClientId: clientId ?? undefined,
        oauthScopes: validation.scopes,
        oauthTokenHash: tokenHash,
        oauthIssuer: issuer
      });
    } catch (error) {
      if (!isUserAuthorizationError(error)) {
        throw error;
      }

      writeJson(response, 403, {
        error: "local_operator_not_active",
        message: `${providerName} authenticated identity is not an active SimpleHostMan operator.`
      });
      await controlPlaneStore.recordOAuthLoginRejected({
        provider,
        reason: "local_operator_not_active",
        email,
        clientId: clientId ?? undefined,
        externalSubject,
        assuranceLevel: assuranceLevel ?? undefined
      });
      return true;
    }
    writeJson(response, 200, {
      ...login,
      oauthLogoutToken: accessToken
    });
    return true;
  }

  const oauthRevokeProvider = matchOAuthProviderRoute(url.pathname, "oauth-revoke");
  if (request.method === "POST" && oauthRevokeProvider) {
    const resourceConfig = config.oauthResourceServer;
    const provider = readOAuthLoginProviderSlug(resourceConfig.loginProviderSlug);
    const revocationUrl =
      resourceConfig.revocationUrl ?? deriveEndpoint(resourceConfig.issuer, "/oauth/revoke");
    const requestBody = await readJsonBody<OAuthProviderRevokeRequest>(request);
    const token = readString(requestBody.token);

    if (oauthRevokeProvider !== provider) {
      writeJson(response, 404, {
        error: "oauth_provider_not_configured",
        message: `${formatOAuthProviderName(oauthRevokeProvider)} OAuth revocation is not configured on this SimpleHostMan runtime.`
      });
      return true;
    }

    if (!token) {
      writeJson(response, 400, {
        error: "invalid_oauth_revoke_request",
        message: "OAuth revoke request is missing a token."
      });
      return true;
    }

    let clientSecret: string | null;
    try {
      clientSecret = await readClientSecret(resourceConfig);
    } catch {
      writeJson(response, 503, {
        error: "oauth_revoke_unavailable",
        message: `${formatOAuthProviderName(provider)} OAuth client secret is unavailable.`
      });
      return true;
    }

    if (!revocationUrl || !resourceConfig.clientId) {
      writeJson(response, 503, {
        error: "oauth_revoke_unavailable",
        message: `${formatOAuthProviderName(provider)} OAuth revocation is not fully configured.`
      });
      return true;
    }

    await revokeToken({
      revocationUrl,
      token,
      clientId: resourceConfig.clientId,
      clientSecret,
      timeoutMs: resourceConfig.introspectionTimeoutMs
    });

    await controlPlaneStore.recordOAuthTokenRevoked(
      {
        provider,
        tokenHash: hashOAuthToken(token),
        clientId: resourceConfig.clientId
      },
      bearerToken
    );

    writeJson(response, 200, {
      revoked: true
    });
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
