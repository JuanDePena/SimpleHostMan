import type {
  JobClaimRequest,
  JobReportRequest,
  NodeRegistrationRequest
} from "@simplehost/panel-contracts";

import { readJsonBody, writeJson } from "./api-http.js";
import type { ApiRouteHandler } from "./api-route-context.js";

export const handleNodeAgentRoutes: ApiRouteHandler = async ({
  request,
  response,
  url,
  bearerToken,
  controlPlaneStore
}) => {
  if (request.method === "POST" && url.pathname === "/v1/nodes/register") {
    writeJson(
      response,
      200,
      await controlPlaneStore.registerNode(
        await readJsonBody<NodeRegistrationRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/jobs/claim") {
    writeJson(
      response,
      200,
      await controlPlaneStore.claimJobs(
        await readJsonBody<JobClaimRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/jobs/report") {
    writeJson(
      response,
      200,
      await controlPlaneStore.reportJob(
        await readJsonBody<JobReportRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  return false;
};
