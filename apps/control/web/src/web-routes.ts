import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { type PanelNotice } from "@simplehost/ui";
import { isUnauthorizedError } from "@simplehost/control-shared";

import { type ControlWebApi } from "./api-client.js";
import { handleDesiredStateResourceRoute } from "./desired-state-resource-routes.js";
import { handleMailRoute } from "./mail-routes.js";
import { handleOAuthLoginRoutes } from "./oauth-login-routes.js";
import {
  type WebLocale,
  writeJson
} from "./request.js";
import {
  createWebRouteContext,
  type WebRouteContext,
  type WebRouteHandler
} from "./web-route-context.js";
import { redirectToLogin, renderLoginError } from "./web-auth-helpers.js";
import { handleActionWebRoutes } from "./web-action-routes.js";
import { handleCoreWebRoutes } from "./web-core-routes.js";
import { handleSessionWebRoutes } from "./web-session-routes.js";

export interface ControlWebRuntimeConfig {
  api: {
    host: string;
    port: number;
  };
  env: string;
  version: string;
  web: {
    host: string;
    port: number;
  };
  oauthResourceServer?: {
    enabled: boolean;
    issuer: string | null;
    authorizationUrl: string | null;
    tokenUrl: string | null;
    introspectionUrl: string | null;
    revocationUrl: string | null;
    clientId: string | null;
    clientSecret: string | null;
    clientSecretFile: string | null;
    requiredScope: string | null;
    requiredAudience: string | null;
    requiredPrincipalType: string | null;
    requiredAssuranceLevel: string | null;
    pilotRedirectUri: string | null;
    pilotScope: string | null;
    pilotRequiredPrincipalType: string | null;
    pilotRequiredAssuranceLevel: string | null;
    pilotRevokeTokens: boolean;
    loginProviderSlug: "pyrosa-iam";
    loginEnabled: boolean;
    loginRedirectUri: string | null;
    loginScope: string | null;
    loginRequiredPrincipalType: string | null;
    loginRequiredAssuranceLevel: string | null;
    loginRequiredGroup: string | null;
    loginLogoutUrl: string | null;
    loginPostLogoutRedirectUri: string | null;
    introspectionTimeoutMs: number;
  };
}

export interface StartControlWebServerArgs {
  api: ControlWebApi;
  config: ControlWebRuntimeConfig;
  handleDashboard: (context: WebRouteContext) => Promise<boolean>;
  renderLoginPage: (locale: WebLocale, notice?: PanelNotice) => string;
  startedAt: number;
}

export function createRequestHandler(args: StartControlWebServerArgs) {
  return async function requestHandler(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const context = createWebRouteContext({
      request,
      response,
      api: args.api,
      config: args.config,
      startedAt: args.startedAt,
      handleDashboard: args.handleDashboard,
      renderLoginPage: args.renderLoginPage
    });

    for (const handler of [
      handleCoreWebRoutes,
      handleOAuthLoginRoutes,
      handleSessionWebRoutes,
      handleActionWebRoutes,
      handleDesiredStateResourceRoute,
      handleMailRoute
    ] satisfies WebRouteHandler[]) {
      if (await handler(context)) {
        return;
      }
    }

    writeJson(response, 404, {
      error: "Not Found",
      method: request.method ?? "GET",
      path: context.url.pathname
    });
  };
}

export function createServerRequestListener(
  args: StartControlWebServerArgs
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  const requestHandler = createRequestHandler(args);

  return async (request, response) => {
    try {
      await requestHandler(request, response);
    } catch (error: unknown) {
      const { locale } = createWebRouteContext({
        request,
        response,
        api: args.api,
        config: args.config,
        startedAt: args.startedAt,
        handleDashboard: args.handleDashboard,
        renderLoginPage: args.renderLoginPage
      });

      if (isUnauthorizedError(error)) {
        redirectToLogin(response);
        return;
      }

      renderLoginError(response, locale, args.renderLoginPage, error);
    }
  };
}

export function startControlWebServer(
  args: StartControlWebServerArgs
): ReturnType<typeof createServer> {
  const server = createServer(createServerRequestListener(args));

  server.listen(args.config.web.port, args.config.web.host, () => {
    console.log(`SimpleHost Control Web listening on http://${args.config.web.host}:${args.config.web.port}`);
  });

  return server;
}
