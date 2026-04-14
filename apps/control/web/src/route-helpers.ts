import type { IncomingMessage } from "node:http";

import { WebApiError } from "./api-client.js";
import { readSessionToken } from "./request.js";

export async function requireSessionToken(request: IncomingMessage): Promise<string> {
  const token = readSessionToken(request);

  if (!token) {
    throw new WebApiError(401, "Missing session.");
  }

  return token;
}
