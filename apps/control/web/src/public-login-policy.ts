import type { IncomingMessage } from "node:http";

import type { ControlWebRuntimeConfig } from "./web-routes.js";

const publicAuthModeHeader = "x-simplehost-public-auth-mode";

function readHeader(request: IncomingMessage, name: string): string | null {
  const value = request.headers[name];

  if (Array.isArray(value)) {
    return value.find((entry) => entry.trim().length > 0)?.trim() ?? null;
  }

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function isPublicOAuthOnlyRequest(
  request: IncomingMessage,
  config: ControlWebRuntimeConfig
): boolean {
  return (
    config.oauthResourceServer?.loginPublicMode === "oauth_only" &&
    readHeader(request, publicAuthModeHeader)?.toLowerCase() === "oauth_only"
  );
}
