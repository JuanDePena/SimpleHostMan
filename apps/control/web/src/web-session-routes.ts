import {
  type AuthLogoutResponse,
  type AuthLoginRequest
} from "@simplehost/control-contracts";

import {
  clearSessionCookie,
  normalizeLocale,
  readFormBody,
  redirect,
  sanitizeReturnTo,
  serializeLocaleCookie,
  serializeSessionCookie
} from "./request.js";
import {
  clearOAuthLogoutTokenCookie,
  oauthLogoutTokenCookieName
} from "./oauth-login-routes.js";
import { renderLoginError } from "./web-auth-helpers.js";
import type { WebRouteHandler } from "./web-route-context.js";
import type { ControlWebRuntimeConfig } from "./web-routes.js";

function readHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null {
  const value = headers[name.toLowerCase()];

  if (Array.isArray(value)) {
    return value.find((entry) => entry.trim().length > 0)?.trim() ?? null;
  }

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function buildExternalSsoSignOutLocation(
  headers: Record<string, string | string[] | undefined>,
  logout: AuthLogoutResponse | null,
  config: ControlWebRuntimeConfig
): string | null {
  if (logout?.authProviderSlug === readOAuthLoginProviderSlug(config.oauthResourceServer?.loginProviderSlug)) {
    return buildOAuthProviderSignOutLocation(config);
  }

  if (
    readHeader(headers, "x-authentik-email") ??
    readHeader(headers, "x-authentik-username") ??
    readHeader(headers, "x-authentik-meta-provider") ??
    readHeader(headers, "x-authentik-meta-outpost")
  ) {
    return `/outpost.goauthentik.io/sign_out?rd=${encodeURIComponent("/login")}`;
  }

  return null;
}

function readOAuthLoginProviderSlug(value: string | null | undefined): "pyrosa-accounts" | "pyrosa-iam" {
  return value === "pyrosa-iam" ? "pyrosa-iam" : "pyrosa-accounts";
}

function buildOAuthProviderSignOutLocation(config: {
  oauthResourceServer?: {
    loginProviderSlug?: "pyrosa-accounts" | "pyrosa-iam";
    loginLogoutUrl: string | null;
    loginPostLogoutRedirectUri: string | null;
  };
}): string | null {
  const logoutUrl = config.oauthResourceServer?.loginLogoutUrl;
  if (!logoutUrl) {
    return null;
  }

  const location = new URL(logoutUrl);
  location.searchParams.set(
    "return_to",
    config.oauthResourceServer?.loginPostLogoutRedirectUri ??
      "/login?notice=Session%20closed&kind=info"
  );
  return location.toString();
}

export const handleSessionWebRoutes: WebRouteHandler = async ({
  request,
  response,
  url,
  locale,
  api,
  renderLoginPage,
  sessionToken,
  config
}) => {
  if (request.method === "POST" && url.pathname === "/preferences/locale") {
    const form = await readFormBody(request);
    redirect(
      response,
      sanitizeReturnTo(form.get("returnTo")),
      serializeLocaleCookie(normalizeLocale(form.get("locale")))
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/auth/login") {
    const form = await readFormBody(request);

    try {
      const login = await api.login({
          email: form.get("email")?.trim() ?? "",
          password: form.get("password")?.trim() ?? ""
        } satisfies AuthLoginRequest);

      redirect(
        response,
        "/",
        serializeSessionCookie(login.sessionToken, login.expiresAt)
      );
    } catch (error) {
      renderLoginError(response, locale, renderLoginPage, error);
    }

    return true;
  }

  if (request.method === "POST" && url.pathname === "/auth/logout") {
    const oauthLogoutToken = readHeader(request.headers, "cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${oauthLogoutTokenCookieName}=`))
      ?.split("=")
      .slice(1)
      .join("=");
    if (sessionToken && oauthLogoutToken) {
      try {
        await api.revokeOAuthProvider(
          readOAuthLoginProviderSlug(config.oauthResourceServer?.loginProviderSlug),
          sessionToken,
          {
            token: decodeURIComponent(oauthLogoutToken)
          }
        );
      } catch {
        // Local logout must still close the SimpleHostMan session.
      }
    }

    let logout: AuthLogoutResponse | null = null;
    if (sessionToken) {
      try {
        logout = await api.logout(sessionToken);
      } catch {
        // Ignore logout errors and clear the local cookie anyway.
      }
    }

    redirect(
      response,
      buildExternalSsoSignOutLocation(request.headers, logout, config) ??
        "/login?notice=Session%20closed&kind=info",
      [
        clearSessionCookie(),
        clearOAuthLogoutTokenCookie()
      ]
    );
    return true;
  }

  return false;
};
