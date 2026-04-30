import type { IncomingMessage, ServerResponse } from "node:http";

import type { PanelNotice } from "@simplehost/ui";
import type {
  ControlAuthenticatedSession,
  ControlAuthenticatedDashboardBootstrap,
  ControlResolvedSession
} from "@simplehost/control-shared";
import { ControlSessionRequiredError } from "@simplehost/control-shared";

import type { ControlWebApi, DashboardLoadOptions } from "./api-client.js";
import { readLocale, readSessionToken } from "./request.js";
import type { ControlWebRuntimeConfig } from "./web-routes.js";
import type { WebLocale } from "./request.js";

export interface WebRouteContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  locale: WebLocale;
  sessionToken: string | null;
  resolveSession: () => Promise<ControlResolvedSession>;
  requireSession: () => Promise<ControlAuthenticatedSession>;
  loadAuthenticatedDashboard: (
    options?: DashboardLoadOptions
  ) => Promise<ControlAuthenticatedDashboardBootstrap>;
  api: ControlWebApi;
  config: ControlWebRuntimeConfig;
  startedAt: number;
  handleDashboard: (context: WebRouteContext) => Promise<boolean>;
  renderLoginPage: (locale: WebLocale, notice?: PanelNotice) => string;
}

export type WebRouteHandler = (context: WebRouteContext) => Promise<boolean>;

export function createWebRouteContext(args: {
  request: IncomingMessage;
  response: ServerResponse;
  api: ControlWebApi;
  config: ControlWebRuntimeConfig;
  startedAt: number;
  handleDashboard: WebRouteContext["handleDashboard"];
  renderLoginPage: WebRouteContext["renderLoginPage"];
}): WebRouteContext {
  const sessionToken = readSessionToken(args.request);
  let resolvedSessionPromise: Promise<ControlResolvedSession> | undefined;
  let requiredSessionPromise: Promise<ControlAuthenticatedSession> | undefined;
  let authenticatedDashboardPromise:
    | Promise<ControlAuthenticatedDashboardBootstrap>
    | undefined;

  const resolveSession = (): Promise<ControlResolvedSession> =>
    (resolvedSessionPromise ??= args.api.resolveSession(sessionToken));
  const requireSession = async (): Promise<ControlAuthenticatedSession> => {
    if (!requiredSessionPromise) {
      requiredSessionPromise = resolveSession().then((session) => {
        if (session.state === "anonymous") {
          throw new ControlSessionRequiredError("Session required");
        }

        return session;
      });
    }

    return requiredSessionPromise;
  };
  const loadAuthenticatedDashboard =
    async (options?: DashboardLoadOptions): Promise<ControlAuthenticatedDashboardBootstrap> => {
      if (!authenticatedDashboardPromise) {
        authenticatedDashboardPromise = args.api
          .loadAuthenticatedDashboard(sessionToken, options)
          .then((result) => {
            resolvedSessionPromise = Promise.resolve(result.session);
            requiredSessionPromise = Promise.resolve(result.session);
            return result;
          });
      }

      return authenticatedDashboardPromise;
    };

  return {
    request: args.request,
    response: args.response,
    url: new URL(args.request.url ?? "/", "http://127.0.0.1"),
    locale: readLocale(args.request),
    sessionToken,
    resolveSession,
    requireSession,
    loadAuthenticatedDashboard,
    api: args.api,
    config: args.config,
    startedAt: args.startedAt,
    handleDashboard: args.handleDashboard,
    renderLoginPage: args.renderLoginPage
  };
}
