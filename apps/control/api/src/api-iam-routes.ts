import type { IamBindingMutationRequest } from "@simplehost/control-contracts";

import {
  matchRoute,
  readJsonBody,
  writeJson
} from "./api-http.js";
import type { ApiRouteHandler } from "./api-route-context.js";
import { applyIamApacheBinding } from "./api-iam-apache-apply.js";

export const handleIamRoutes: ApiRouteHandler = async ({
  request,
  response,
  url,
  bearerToken,
  controlPlaneStore
}) => {
  if (request.method === "GET" && url.pathname === "/v1/iam/summary") {
    writeJson(response, 200, await controlPlaneStore.getIamOverview(bearerToken));
    return true;
  }

  const bindingMatch = matchRoute(url.pathname, /^\/v1\/iam\/bindings\/([^/]+)$/);

  if (request.method === "PUT" && bindingMatch) {
    writeJson(
      response,
      200,
      await controlPlaneStore.upsertIamBinding(
        {
          ...(await readJsonBody<Omit<IamBindingMutationRequest, "bindingId">>(request)),
          bindingId: decodeURIComponent(bindingMatch[1] ?? "")
        },
        bearerToken
      )
    );
    return true;
  }

  const apacheApplyMatch = matchRoute(
    url.pathname,
    /^\/v1\/iam\/bindings\/([^/]+)\/apache\/apply$/
  );

  if (request.method === "POST" && apacheApplyMatch) {
    const bindingId = decodeURIComponent(apacheApplyMatch[1] ?? "");
    const binding = await controlPlaneStore.getIamBindingForApacheApply(
      bindingId,
      bearerToken
    );
    const result = await applyIamApacheBinding(binding);
    const overview = await controlPlaneStore.recordIamApacheApplyResult(
      {
        bindingId,
        result
      },
      bearerToken
    );

    writeJson(response, 200, { result, overview });
    return true;
  }

  return false;
};
