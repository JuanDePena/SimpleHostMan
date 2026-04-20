import type {
  ResetMailboxCredentialRequest,
  UpsertMailAliasRequest,
  UpsertMailboxQuotaRequest,
  UpsertMailboxRequest,
  UpsertMailDomainRequest
} from "@simplehost/control-contracts";

import {
  matchRoute,
  readJsonBody,
  writeJson
} from "./api-http.js";
import type { ApiRouteHandler } from "./api-route-context.js";

export const handleMailRoutes: ApiRouteHandler = async ({
  request,
  response,
  url,
  bearerToken,
  controlPlaneStore
}) => {
  if (request.method === "GET" && url.pathname === "/v1/mail/overview") {
    writeJson(
      response,
      200,
      await controlPlaneStore.getMailOverview(bearerToken)
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/mail/domains") {
    writeJson(
      response,
      200,
      await controlPlaneStore.upsertMailDomain(
        await readJsonBody<UpsertMailDomainRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  const deleteMailDomainMatch = matchRoute(
    url.pathname,
    /^\/v1\/mail\/domains\/([^/]+)$/
  );

  if (request.method === "DELETE" && deleteMailDomainMatch) {
    writeJson(
      response,
      200,
      await controlPlaneStore.deleteMailDomain(
        decodeURIComponent(deleteMailDomainMatch[1] ?? ""),
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/mail/mailboxes") {
    writeJson(
      response,
      200,
      await controlPlaneStore.upsertMailbox(
        await readJsonBody<UpsertMailboxRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/mail/mailboxes/reset-credential") {
    writeJson(
      response,
      200,
      await controlPlaneStore.resetMailboxCredential(
        await readJsonBody<ResetMailboxCredentialRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  const deleteMailboxMatch = matchRoute(
    url.pathname,
    /^\/v1\/mail\/mailboxes\/([^/]+)$/
  );

  if (request.method === "DELETE" && deleteMailboxMatch) {
    writeJson(
      response,
      200,
      await controlPlaneStore.deleteMailbox(
        decodeURIComponent(deleteMailboxMatch[1] ?? ""),
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/mail/aliases") {
    writeJson(
      response,
      200,
      await controlPlaneStore.upsertMailAlias(
        await readJsonBody<UpsertMailAliasRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  const deleteAliasMatch = matchRoute(
    url.pathname,
    /^\/v1\/mail\/aliases\/([^/]+)$/
  );

  if (request.method === "DELETE" && deleteAliasMatch) {
    writeJson(
      response,
      200,
      await controlPlaneStore.deleteMailAlias(
        decodeURIComponent(deleteAliasMatch[1] ?? ""),
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/mail/quotas") {
    writeJson(
      response,
      200,
      await controlPlaneStore.upsertMailboxQuota(
        await readJsonBody<UpsertMailboxQuotaRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  const deleteQuotaMatch = matchRoute(
    url.pathname,
    /^\/v1\/mail\/quotas\/([^/]+)$/
  );

  if (request.method === "DELETE" && deleteQuotaMatch) {
    writeJson(
      response,
      200,
      await controlPlaneStore.deleteMailboxQuota(
        decodeURIComponent(deleteQuotaMatch[1] ?? ""),
        bearerToken
      )
    );
    return true;
  }

  return false;
};
