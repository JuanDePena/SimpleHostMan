import type { IncomingMessage, ServerResponse } from "node:http";

import type { PanelNotice } from "@simplehost/panel-ui";

import type { PanelWebApi } from "./api-client.js";
import type { PanelWebRuntimeConfig } from "./web-routes.js";
import type { WebLocale } from "./request.js";

export interface WebRouteContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  locale: WebLocale;
  api: PanelWebApi;
  config: PanelWebRuntimeConfig;
  startedAt: number;
  handleDashboard: (
    request: IncomingMessage,
    response: ServerResponse
  ) => Promise<void>;
  renderLoginPage: (locale: WebLocale, notice?: PanelNotice) => string;
}

export type WebRouteHandler = (context: WebRouteContext) => Promise<boolean>;
