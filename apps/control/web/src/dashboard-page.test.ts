import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardData } from "./api-client.js";
import { renderDashboardPage } from "./dashboard-page.js";
import { createMailReleaseBaselineData } from "./mail-release-baseline.js";
import type { OverviewMetricsSnapshot } from "./overview-metrics.js";

function createOverviewMetricsSnapshot(): OverviewMetricsSnapshot {
  return {
    generatedAt: "2026-04-29T00:00:00.000Z",
    sourceCode: {
      lineCount: 0,
      sizeBytes: 0,
      fileCount: 0,
      directoryCount: 0
    },
    system: {
      hostname: "control.example.net",
      cpuCores: 2,
      cpuLoadPercent: 0,
      memoryTotalBytes: 0,
      memoryFreeBytes: 0,
      storageTotalBytes: 0,
      storageAvailableBytes: 0,
      apiService: "active",
      uiService: "active",
      version: "test",
      currentIpv4: "127.0.0.1"
    }
  };
}

test("renderDashboardPage renders only the active workspace body", () => {
  const data = createMailReleaseBaselineData();
  data.currentUser = {
    userId: "user-1",
    email: "ops@example.com",
    displayName: "Ops",
    status: "active",
    globalRoles: ["platform_admin"],
    tenantMemberships: []
  };
  data.nodeHealth[0] = {
    ...data.nodeHealth[0]!,
    logs: {
      checkedAt: "2026-04-29T00:00:00.000Z",
      entries: [
        {
          occurredAt: "2026-04-29T00:00:00.000Z",
          unit: "inactive.service",
          priority: 6,
          priorityLabel: "info",
          get message(): string {
            throw new Error("inactive logs workspace rendered");
          }
        }
      ]
    }
  } satisfies DashboardData["nodeHealth"][number];

  const html = renderDashboardPage({
    currentPath: "/?view=overview",
    data,
    defaultImportPath: "/etc/simplehost/inventory.yaml",
    desiredStateTab: "desired-state-create",
    locale: "en",
    overviewMetrics: createOverviewMetricsSnapshot(),
    version: "test",
    view: "overview"
  });

  assert.match(html, /id="section-overview"/);
  assert.doesNotMatch(html, /id="section-logs"/);
});
