import { createHash, randomBytes } from "node:crypto";

import { noticeLocation, WebApiError } from "./api-client.js";
import { redirect, serializeSessionCookie } from "./request.js";
import type { WebRouteHandler } from "./web-route-context.js";

interface OAuthLoginState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}

const oauthLoginCookieName = "shp_oauth_login";
export const oauthLogoutTokenCookieName = "shp_oauth_logout";
const oauthLogoutCookiePath = "/auth/logout";
const oauthLoginCookieMaxAgeSeconds = 10 * 60;

type OAuthLoginProviderSlug = "pyrosa-iam";

function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function deriveEndpoint(issuer: string | null | undefined, path: string): string | null {
  return issuer ? `${issuer.replace(/\/+$/, "")}${path}` : null;
}

function encodeLoginState(state: OAuthLoginState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

function decodeLoginState(value: string | null): OAuthLoginState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<OAuthLoginState>;
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

function readOAuthLoginProviderSlug(_value: string | null | undefined): OAuthLoginProviderSlug {
  return "pyrosa-iam";
}

function formatOAuthProviderName(_provider: OAuthLoginProviderSlug): string {
  return "Pyrosa IAM";
}

function oauthLoginCookiePath(provider: OAuthLoginProviderSlug): string {
  return `/auth/${provider}`;
}

function serializeLoginCookie(provider: OAuthLoginProviderSlug, value: string): string {
  return `${oauthLoginCookieName}=${encodeURIComponent(value)}; Path=${oauthLoginCookiePath(provider)}; HttpOnly; Secure; SameSite=Lax; Max-Age=${oauthLoginCookieMaxAgeSeconds}`;
}

function clearLoginCookie(provider: OAuthLoginProviderSlug): string {
  return `${oauthLoginCookieName}=; Path=${oauthLoginCookiePath(provider)}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function serializeOAuthLogoutTokenCookie(value: string, expiresAt: string): string {
  const maxAgeSeconds = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
  );

  return `${oauthLogoutTokenCookieName}=${encodeURIComponent(value)}; Path=${oauthLogoutCookiePath}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearOAuthLogoutTokenCookie(): string {
  return `${oauthLogoutTokenCookieName}=; Path=${oauthLogoutCookiePath}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function failClosedLocation(message: string): string {
  return noticeLocation(message, "error");
}

export const handleOAuthLoginRoutes: WebRouteHandler = async ({
  request,
  response,
  url,
  api,
  config
}) => {
  const oauthConfig = config.oauthResourceServer;
  const provider = readOAuthLoginProviderSlug(oauthConfig?.loginProviderSlug);
  const providerName = formatOAuthProviderName(provider);
  const providerPath = oauthLoginCookiePath(provider);

  if (url.pathname !== providerPath && !url.pathname.startsWith(`${providerPath}/`)) {
    return false;
  }

  if (request.method !== "GET") {
    return false;
  }

  if (!oauthConfig?.loginEnabled) {
    redirect(
      response,
      failClosedLocation(`${providerName} OAuth login is not enabled.`),
      clearLoginCookie(provider)
    );
    return true;
  }

  if (url.pathname === `${providerPath}/start`) {
    const authorizationUrl =
      oauthConfig.authorizationUrl ?? deriveEndpoint(oauthConfig.issuer, "/oauth/authorize");
    const redirectUri = oauthConfig.loginRedirectUri;

    if (!authorizationUrl || !oauthConfig.clientId || !redirectUri) {
      redirect(
        response,
        failClosedLocation(`${providerName} OAuth login is not fully configured.`),
        clearLoginCookie(provider)
      );
      return true;
    }

    const state = randomBytes(24).toString("base64url");
    const pkce = createPkcePair();
    const authorize = new URL(authorizationUrl);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", oauthConfig.clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("scope", oauthConfig.loginScope ?? "profile:read mfa:read");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("code_challenge", pkce.challenge);
    authorize.searchParams.set("code_challenge_method", "S256");

    redirect(
      response,
      authorize.toString(),
      serializeLoginCookie(provider, encodeLoginState({
        state,
        codeVerifier: pkce.verifier,
        redirectUri,
        createdAt: Date.now()
      }))
    );
    return true;
  }

  if (url.pathname !== `${providerPath}/callback`) {
    return false;
  }

  const upstreamError = url.searchParams.get("error");
  if (upstreamError) {
    redirect(
      response,
      failClosedLocation(url.searchParams.get("error_description") ?? `${providerName} returned an OAuth error.`),
      clearLoginCookie(provider)
    );
    return true;
  }

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const loginState = decodeLoginState(readCookie(request.headers.cookie, oauthLoginCookieName));
  if (
    !state ||
    !code ||
    !loginState ||
    loginState.state !== state ||
    Date.now() - loginState.createdAt > oauthLoginCookieMaxAgeSeconds * 1000
  ) {
    redirect(
      response,
      failClosedLocation("OAuth login state is missing, expired or mismatched."),
      clearLoginCookie(provider)
    );
    return true;
  }

  try {
    const login = await api.loginOAuthProvider(provider, {
      code,
      redirectUri: loginState.redirectUri,
      codeVerifier: loginState.codeVerifier
    });

    redirect(
      response,
      "/",
      [
        serializeSessionCookie(login.sessionToken, login.expiresAt),
        serializeOAuthLogoutTokenCookie(login.oauthLogoutToken, login.expiresAt),
        clearLoginCookie(provider)
      ]
    );
  } catch (error) {
    const message =
      error instanceof WebApiError
        ? error.message
        : `${providerName} OAuth login failed closed.`;
    redirect(response, failClosedLocation(message), clearLoginCookie(provider));
  }

  return true;
};
