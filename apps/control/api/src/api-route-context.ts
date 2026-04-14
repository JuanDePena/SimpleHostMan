import type { IncomingMessage, ServerResponse } from "node:http";

import type { PanelRuntimeConfig } from "@simplehost/panel-config";
import type { PanelControlPlaneStore } from "@simplehost/panel-database";

export interface ApiRouteContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  bearerToken: string | null;
  controlPlaneStore: PanelControlPlaneStore;
  config: PanelRuntimeConfig;
  startedAt: number;
}

export type ApiRouteHandler = (context: ApiRouteContext) => Promise<boolean>;
