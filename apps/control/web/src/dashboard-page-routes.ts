import { type PanelNotice } from "@simplehost/ui";
import {
  ControlSessionRequiredError,
  isUnauthorizedError
} from "@simplehost/control-shared";

import {
  getNoticeFromUrl,
  type ControlWebApi
} from "./api-client.js";
import {
  buildDashboardViewUrl,
  normalizeDashboardFocus,
  normalizeDashboardView,
  normalizeDesiredStateTab,
  normalizeStatusInterval,
  resolveCanonicalDashboardTarget
} from "./dashboard-routing.js";
import { renderDashboardPage } from "./dashboard-page.js";
import {
  redirect,
  sanitizeReturnTo,
  type WebLocale,
  writeHtml
} from "./request.js";
import { redirectToLogin, renderLoginError } from "./web-auth-helpers.js";
import { isPublicOAuthOnlyRequest } from "./public-login-policy.js";
import type { WebRouteHandler } from "./web-route-context.js";
import type { OverviewMetricsCollector } from "./overview-metrics.js";

export function createDashboardHandler(args: {
  api: ControlWebApi;
  overviewMetrics: OverviewMetricsCollector;
  renderLoginPage: (locale: WebLocale, notice?: PanelNotice) => string;
  renderOAuthLoginPage: (locale: WebLocale, notice?: PanelNotice) => string;
  version: string;
}): WebRouteHandler {
  return async function handleDashboard({
    request,
    response,
    url,
    locale,
    config,
    resolveSession,
    loadAuthenticatedDashboard
  }): Promise<boolean> {
    const view = normalizeDashboardView(url.searchParams.get("view"));
    const rawTab = url.searchParams.get("tab") ?? undefined;
    const desiredStateTab = normalizeDesiredStateTab(rawTab);
    const focus = normalizeDashboardFocus(url.searchParams.get("focus"));
    const statusInterval = normalizeStatusInterval(url.searchParams.get("statusInterval"));
    const mailCredentialRevealId = url.searchParams.get("mailCredentialReveal");

    const session = await resolveSession();

    if (session.state === "anonymous") {
      if (isPublicOAuthOnlyRequest(request, config)) {
        const notice = getNoticeFromUrl(url);
        if (url.pathname === "/" && config.oauthResourceServer?.loginEnabled && !notice) {
          redirect(response, "/auth/pyrosa-iam/start");
          return true;
        }

        const oauthNotice = notice ?? (
          config.oauthResourceServer?.loginEnabled
            ? undefined
            : {
                kind: "error" as const,
                message: "Pyrosa IAM OAuth login is not enabled."
              }
        );
        writeHtml(response, 200, args.renderOAuthLoginPage(locale, oauthNotice));
        return true;
      }

      writeHtml(response, 200, args.renderLoginPage(locale, getNoticeFromUrl(url)));
      return true;
    }

    const canonicalTarget = resolveCanonicalDashboardTarget(view, rawTab);
    const extraFilters = Object.fromEntries(
      Array.from(url.searchParams.entries()).filter(
        ([key]) => key !== "view" && key !== "tab" && key !== "focus" && key !== "statusInterval"
      )
    );
    if (view === "overview" && statusInterval !== "day") {
      extraFilters.statusInterval = statusInterval;
    }
    const canonicalLocation = buildDashboardViewUrl(
      canonicalTarget.view,
      canonicalTarget.tab,
      focus,
      extraFilters
    );
    const currentLocation = sanitizeReturnTo(`${url.pathname}${url.search}`);

    if (canonicalLocation !== currentLocation) {
      redirect(response, canonicalLocation);
      return true;
    }

    try {
      const { dashboard } = await loadAuthenticatedDashboard({
        jobHistoryMode: view === "jobs" || view === "job-history" ? "full" : "compact",
        statusInterval: view === "overview" ? statusInterval : undefined
      });
      const historyReplaceUrl = (() => {
        if (!mailCredentialRevealId) {
          return undefined;
        }

        const nextUrl = new URL(`${url.pathname}${url.search}`, "http://localhost");
        nextUrl.searchParams.delete("mailCredentialReveal");
        return sanitizeReturnTo(`${nextUrl.pathname}${nextUrl.search}`);
      })();
      const mailCredentialReveal =
        mailCredentialRevealId && session.token
          ? await args.api.consumeMailboxCredentialReveal(session.token, mailCredentialRevealId)
          : null;
      writeHtml(
        response,
        200,
        renderDashboardPage({
          currentPath: sanitizeReturnTo(`${url.pathname}${url.search}`),
          data: dashboard,
          desiredStateTab,
          focus,
          historyReplaceUrl,
          locale,
          mailCredentialReveal,
          notice: getNoticeFromUrl(url),
          overviewMetrics: args.overviewMetrics.getSnapshot(),
          statusInterval,
          version: args.version,
          view
        })
      );
      return true;
    } catch (error) {
      if (error instanceof ControlSessionRequiredError || isUnauthorizedError(error)) {
        redirectToLogin(response, "Session required");
        return true;
      }

      renderLoginError(response, locale, args.renderLoginPage, error);
      return true;
    }
  };
}
