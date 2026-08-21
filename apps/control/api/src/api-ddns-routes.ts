import type {
  UpsertDdnsHostRequest
} from "@simplehost/control-contracts";

import {
  matchRoute,
  readJsonBody,
  writeJson,
  writeText
} from "./api-http.js";
import type { ApiRouteHandler } from "./api-route-context.js";

function readBasicAuth(header: string | undefined): { username: string; password: string } | null {
  const match = /^Basic\s+(.+)$/i.exec(header ?? "");

  if (!match) {
    return null;
  }

  try {
    const decoded = Buffer.from(match[1] ?? "", "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

function readForwardedRemoteAddress(headers: NodeJS.Dict<string | string[] | undefined>): string | undefined {
  const forwardedFor = headers["x-forwarded-for"];
  const firstForwardedFor = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

  if (firstForwardedFor) {
    return firstForwardedFor.split(",")[0]?.trim();
  }

  const realIp = headers["x-real-ip"];
  return Array.isArray(realIp) ? realIp[0] : realIp;
}

function writeDdnsResponse(
  response: Parameters<typeof writeText>[0],
  statusCode: number,
  status: string,
  ipAddress?: string
): void {
  writeText(response, statusCode, `${status}${ipAddress ? ` ${ipAddress}` : ""}\n`);
}

export const handleDdnsRoutes: ApiRouteHandler = async ({
  request,
  response,
  url,
  bearerToken,
  controlPlaneStore
}) => {
  if (request.method === "GET" && url.pathname === "/v1/ddns/hosts") {
    writeJson(response, 200, await controlPlaneStore.listDdnsHosts(bearerToken));
    return true;
  }

  if (request.method === "POST" && url.pathname === "/v1/ddns/hosts") {
    writeJson(
      response,
      200,
      await controlPlaneStore.upsertDdnsHost(
        await readJsonBody<UpsertDdnsHostRequest>(request),
        bearerToken
      )
    );
    return true;
  }

  const deleteHostMatch = matchRoute(url.pathname, /^\/v1\/ddns\/hosts\/([^/]+)$/);

  if (request.method === "DELETE" && deleteHostMatch) {
    writeJson(
      response,
      200,
      await controlPlaneStore.deleteDdnsHost(
        decodeURIComponent(deleteHostMatch[1] ?? ""),
        bearerToken
      )
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/nic/update") {
    const credentials = readBasicAuth(request.headers.authorization);

    if (!credentials) {
      response.setHeader("www-authenticate", 'Basic realm="SimpleHostMan DDNS"');
      writeDdnsResponse(response, 401, "badauth");
      return true;
    }

    const ipAddress =
      url.searchParams.get("myip") ??
      url.searchParams.get("ip") ??
      readForwardedRemoteAddress(request.headers) ??
      request.socket.remoteAddress ??
      undefined;
    const result = await controlPlaneStore.updateDdnsHost({
      hostname: url.searchParams.get("hostname") ?? url.searchParams.get("host") ?? "",
      username: credentials.username,
      password: credentials.password,
      ipAddress,
      userAgent: request.headers["user-agent"],
      remoteAddress: readForwardedRemoteAddress(request.headers) ?? request.socket.remoteAddress
    });

    if (result.status === "badauth") {
      response.setHeader("www-authenticate", 'Basic realm="SimpleHostMan DDNS"');
      writeDdnsResponse(response, 401, result.status);
      return true;
    }

    if (result.status === "nohost") {
      writeDdnsResponse(response, 404, result.status);
      return true;
    }

    if (result.status === "badip") {
      writeDdnsResponse(response, 400, result.status, result.ipAddress);
      return true;
    }

    writeDdnsResponse(response, 200, result.status, result.ipAddress);
    return true;
  }

  return false;
};
