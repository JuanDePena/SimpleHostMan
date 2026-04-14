import type {
  AuthLoginRequest,
  CreateUserRequest
} from "@simplehost/panel-contracts";

import { readJsonBody, writeJson } from "./api-http.js";
import type { ApiRouteHandler } from "./api-route-context.js";

export const handleAuthRoutes: ApiRouteHandler = async ({
  request,
  response,
  url,
  bearerToken,
  controlPlaneStore
}) => {
  if (request.method === "POST" && url.pathname === "/v1/auth/login") {
    writeJson(
      response,
      200,
      await controlPlaneStore.loginUser(await readJsonBody<AuthLoginRequest>(request))
    );
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
