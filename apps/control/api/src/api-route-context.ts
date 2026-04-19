import type { IncomingMessage, ServerResponse } from "node:http";

import type { ControlRuntimeConfig } from "@simplehost/control-config";
import type { ControlPlaneStore } from "@simplehost/control-database";

export interface ApiRouteContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  bearerToken: string | null;
  controlPlaneStore: ControlPlaneStore;
  config: ControlRuntimeConfig;
  startedAt: number;
}

export type ApiRouteHandler = (context: ApiRouteContext) => Promise<boolean>;
