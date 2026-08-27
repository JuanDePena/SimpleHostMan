import { createRuntimeHealthSnapshot } from "@simplehost/control-shared";

import { getNoticeFromUrl } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { buildProxyVhostPreview, renderProxyVhostPage } from "./proxy-vhost-preview.js";
import { writeHtml, writeJson } from "./request.js";
import { requireSessionToken } from "./route-helpers.js";
import {
  renderRustDeskConnectPage,
  renderRustDeskSplashPage
} from "./rustdesk-connect.js";
import type { WebRouteContext, WebRouteHandler } from "./web-route-context.js";

const defaultRustDeskPublicHostname = "rustdesk.pyrosa.com.do";

function normalizeRequestHostname(value: string | string[] | undefined): string {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue) {
    return "";
  }

  const normalized = rawValue.trim().toLowerCase();

  if (normalized.startsWith("[")) {
    return normalized.slice(1, normalized.indexOf("]"));
  }

  return normalized.split(":", 1)[0] ?? "";
}

function getRustDeskPublicHostname(config: WebRouteContext["config"]): string {
  const configured = config.rustdesk?.publicHostname?.trim() ?? "";

  return configured || defaultRustDeskPublicHostname;
}

function isRustDeskPublicHost(
  request: Parameters<WebRouteHandler>[0]["request"],
  config: Parameters<WebRouteHandler>[0]["config"]
): boolean {
  return normalizeRequestHostname(request.headers.host) === getRustDeskPublicHostname(config);
}

function redirectPermanent(
  response: Parameters<WebRouteHandler>[0]["response"],
  location: string
): void {
  response.writeHead(301, { location });
  response.end();
}

function isReadRequest(method: string | undefined): boolean {
  return method === "GET" || method === "HEAD";
}

function writeHtmlReadResponse(
  response: Parameters<WebRouteHandler>[0]["response"],
  method: string | undefined,
  html: string
): void {
  if (method === "HEAD") {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8"
    });
    response.end();
    return;
  }

  writeHtml(response, 200, html);
}

export const handleCoreWebRoutes: WebRouteHandler = async ({
  request,
  response,
  url,
  locale,
  sessionToken,
  resolveSession,
  requireSession,
  loadAuthenticatedDashboard,
  api,
  config,
  startedAt,
  handleDashboard,
  renderLoginPage,
  renderOAuthLoginPage
}) => {
  const rustdeskPublicHost = isRustDeskPublicHost(request, config);

  if (rustdeskPublicHost && isReadRequest(request.method)) {
    if (url.pathname === "/connect/rustdesk") {
      redirectPermanent(response, `/connect${url.search}`);
      return true;
    }

    if (url.pathname === "/" || url.pathname === "/connect") {
      const connection = await api.loadRustDeskPublicConnection();

      writeHtmlReadResponse(
        response,
        request.method,
        url.pathname === "/"
          ? renderRustDeskSplashPage(locale, connection)
          : renderRustDeskConnectPage(locale, connection, {
              connectionPath: "/connect",
              hasSession: false,
              notice: getNoticeFromUrl(url),
              showOperatorAction: false
            })
      );
      return true;
    }

    writeJson(response, 404, {
      error: "Not Found",
      method: request.method,
      path: url.pathname
    });
    return true;
  }

  if (rustdeskPublicHost && url.pathname !== "/preferences/locale") {
    writeJson(response, 404, {
      error: "Not Found",
      method: request.method ?? "GET",
      path: url.pathname
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/healthz") {
    writeJson(
      response,
      200,
      createRuntimeHealthSnapshot({
        config,
        service: "web",
        startedAt,
        extra: {
          upstreamApi: `${config.api.host}:${config.api.port}`
        }
      })
    );
    return true;
  }

  if (request.method === "GET" && url.pathname === "/favicon.ico") {
    response.writeHead(204);
    response.end();
    return true;
  }

  if (isReadRequest(request.method) && url.pathname === "/connect/rustdesk") {
    redirectPermanent(response, `https://${getRustDeskPublicHostname(config)}/connect${url.search}`);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/proxy-vhost") {
    const token = await requireSessionToken({ requireSession });
    const slug = url.searchParams.get("slug")?.trim() ?? "";
    const payload = await api.loadProxyPreview(token, slug);

    if (url.searchParams.get("format") === "json") {
      writeJson(response, 200, buildProxyVhostPreview(payload));
      return true;
    }

    writeHtml(
      response,
      200,
      renderProxyVhostPage({
        backHref: buildDashboardViewUrl("proxies", undefined, slug),
        locale,
        payload
      })
    );
    return true;
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/login")) {
    return handleDashboard({
      request,
      response,
      url,
      locale,
      sessionToken,
      resolveSession,
      requireSession,
      loadAuthenticatedDashboard,
      api,
      config,
      startedAt,
      handleDashboard,
      renderLoginPage,
      renderOAuthLoginPage
    });
  }

  return false;
};
