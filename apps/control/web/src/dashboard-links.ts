import { escapeHtml } from "@simplehost/panel-ui";

import {
  type JobHistoryEntry,
  type ResourceDriftSummary
} from "@simplehost/panel-contracts";

import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { type PillTone } from "./web-types.js";

type PillRenderer = (value: string, tone?: PillTone) => string;

export function parseDriftResourceReference(entry: ResourceDriftSummary): {
  editorHref?: string;
  action?: {
    path: string;
    fields: Record<string, string>;
    label: string;
    confirmMessage: string;
  };
} {
  if (entry.resourceKind === "dns" && entry.resourceKey.startsWith("zone:")) {
    const zoneName = entry.resourceKey.slice("zone:".length);
    return {
      editorHref: buildDashboardViewUrl("desired-state", "desired-state-zones", zoneName),
      action: {
        path: "/actions/zone-sync",
        fields: { zoneName },
        label: "dns.sync",
        confirmMessage: `Dispatch dns.sync for zone ${zoneName}?`
      }
    };
  }

  if (entry.resourceKind === "site" && entry.resourceKey.startsWith("app:")) {
    const [, appSlug, actionKind] = entry.resourceKey.split(":", 4);

    if (actionKind === "container") {
      return {
        editorHref: buildDashboardViewUrl("apps", "apps-spec", appSlug),
        action: {
          path: "/actions/app-reconcile",
          fields: { slug: appSlug },
          label: "container.reconcile",
          confirmMessage: `Dispatch app.reconcile for app ${appSlug}?`
        }
      };
    }

    return {
      editorHref: buildDashboardViewUrl("proxies", "proxies-spec", appSlug),
      action: {
        path: "/actions/app-render-proxy",
        fields: { slug: appSlug },
        label: "proxy.render",
        confirmMessage: `Dispatch proxy.render for app ${appSlug}?`
      }
    };
  }

  if (entry.resourceKind === "database" && entry.resourceKey.startsWith("database:")) {
    const appSlug = entry.resourceKey.slice("database:".length);
    return {
      editorHref: buildDashboardViewUrl("desired-state", "desired-state-databases", appSlug),
      action: {
        path: "/actions/database-reconcile",
        fields: { appSlug },
        label: "database reconcile",
        confirmMessage: `Dispatch database reconcile for ${appSlug}?`
      }
    };
  }

  return {};
}

export function renderActionForm(
  action: string,
  hiddenFields: Record<string, string>,
  label: string,
  options: { confirmMessage?: string } = {}
): string {
  return `<form method="post" action="${escapeHtml(action)}" class="inline-form">
    ${Object.entries(hiddenFields)
      .map(
        ([name, value]) =>
          `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`
      )
      .join("")}
    <button class="secondary" type="submit"${
      options.confirmMessage
        ? ` data-confirm="${escapeHtml(options.confirmMessage)}"`
        : ""
    }>${escapeHtml(label)}</button>
  </form>`;
}

export function renderFocusLink(
  label: string,
  href: string,
  active: boolean,
  activeLabel: string,
  renderPill: PillRenderer
): string {
  return `<a href="${escapeHtml(href)}" class="mono detail-link">${escapeHtml(label)}</a>${
    active ? ` ${renderPill(activeLabel, "success")}` : ""
  }`;
}

export function findLatestJobWithStatus(
  jobs: JobHistoryEntry[],
  status: JobHistoryEntry["status"]
): JobHistoryEntry | undefined {
  return jobs.find((job) => job.status === status);
}

export function resolveResourceKeyTarget(resourceKey: string): {
  desiredStateHref?: string;
  driftHref?: string;
} {
  if (resourceKey.startsWith("zone:")) {
    const zoneName = resourceKey.slice("zone:".length);

    return {
      desiredStateHref: buildDashboardViewUrl("desired-state", "desired-state-zones", zoneName),
      driftHref: buildDashboardViewUrl("resource-drift", undefined, resourceKey)
    };
  }

  if (resourceKey.startsWith("app:")) {
    const [, slug, actionKind] = resourceKey.split(":", 4);

    if (!slug) {
      return {};
    }

    return {
      desiredStateHref: buildDashboardViewUrl(
        actionKind === "container" ? "apps" : "proxies",
        actionKind === "container" ? "apps-spec" : "proxies-spec",
        slug
      ),
      driftHref: buildDashboardViewUrl("resource-drift", undefined, resourceKey)
    };
  }

  if (resourceKey.startsWith("database:")) {
    const appSlug = resourceKey.slice("database:".length);

    return {
      desiredStateHref: buildDashboardViewUrl("desired-state", "desired-state-databases", appSlug),
      driftHref: buildDashboardViewUrl("resource-drift", undefined, resourceKey)
    };
  }

  return {};
}
