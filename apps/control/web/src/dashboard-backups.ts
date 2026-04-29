import { escapeHtml } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { renderBackupsFilterForm } from "./dashboard-backups-filters.js";
import {
  renderBackupRunPanel,
  renderSelectedBackupPolicyPanel
} from "./dashboard-backups-panels.js";
import { buildBackupRows, renderBackupsTable } from "./dashboard-backups-table.js";
import { type BackupCopy, type BackupsWorkspaceArgs } from "./dashboard-backups-types.js";

export function renderBackupsWorkspace<Copy extends BackupCopy>(
  args: BackupsWorkspaceArgs<Copy>
): string {
  const {
    copy,
    data,
    locale,
    filteredBackupPolicies,
    filteredBackupRuns,
    selectedBackupViewRun,
    selectedBackupPolicySummary,
    currentBackupFilters,
    backupStatusFilter,
    backupNodeFilter,
    backupTenantFilter,
    backupPolicyFilter,
    formatDate,
    renderActionFacts,
    renderDetailGrid,
    renderPill,
    renderRelatedPanel,
    renderSignalStrip,
    renderWorkspaceFilterForm
  } = args;

  const backupRows = buildBackupRows({
    copy,
    currentBackupFilters,
    filteredBackupRuns,
    formatDate,
    locale,
    renderFocusLink: args.renderFocusLink,
    renderPill,
    selectedBackupViewRun
  });

  const backupSucceededCount = filteredBackupRuns.filter((run) => run.status === "succeeded").length;
  const backupFailedCount = filteredBackupRuns.filter((run) => run.status === "failed").length;
  const backupRunningCount = filteredBackupRuns.filter((run) => run.status === "running").length;
  const backupCoverageCount = filteredBackupPolicies.length;
  const selectedBackupPolicyRuns = selectedBackupPolicySummary
    ? data.backups.latestRuns.filter((run) => run.policySlug === selectedBackupPolicySummary.policySlug)
    : [];
  const selectedBackupPolicyLatestFailedRun = selectedBackupPolicyRuns.find(
    (run) => run.status === "failed"
  );
  const selectedBackupPolicyTenantApps = selectedBackupPolicySummary
    ? data.desiredState.spec.apps.filter((app) => app.tenantSlug === selectedBackupPolicySummary.tenantSlug)
    : [];
  const selectedBackupPolicyTenantZones = selectedBackupPolicySummary
    ? data.desiredState.spec.zones.filter(
        (zone) => zone.tenantSlug === selectedBackupPolicySummary.tenantSlug
      )
    : [];
  const selectedBackupPolicyTenantDatabases = selectedBackupPolicySummary
    ? data.desiredState.spec.databases.filter((database) => {
        const app = data.desiredState.spec.apps.find((entry) => entry.slug === database.appSlug);
        return app?.tenantSlug === selectedBackupPolicySummary.tenantSlug;
      })
    : [];
  const selectedBackupPolicyLatestSuccessRun = selectedBackupPolicyRuns.find(
    (run) => run.status === "succeeded"
  );
  const selectedBackupPolicyTargetHealth = selectedBackupPolicySummary
    ? data.nodeHealth.find((entry) => entry.nodeId === selectedBackupPolicySummary.targetNodeId)
    : undefined;
  const selectedBackupSummaryActionPreviewItems = selectedBackupPolicySummary
    ? [
        {
          title: "backup.trigger",
          meta: escapeHtml(
            `${selectedBackupPolicySummary.targetNodeId} · ${selectedBackupPolicySummary.schedule}`
          ),
          summary: escapeHtml(
            `${selectedBackupPolicyRuns.length} recorded run(s) and ${selectedBackupPolicySummary.resourceSelectors.length} selector(s) currently shape this backup scope.`
          ),
          tone:
            selectedBackupPolicyLatestFailedRun ||
            selectedBackupPolicyRuns.some((run) => run.status === "failed")
              ? ("danger" as const)
              : ("default" as const)
        },
        {
          title: "policy.coverage",
          meta: escapeHtml(
            `${selectedBackupPolicyTenantApps.length} app(s) · ${selectedBackupPolicyTenantZones.length} zone(s) · ${selectedBackupPolicyTenantDatabases.length} database(s)`
          ),
          summary: escapeHtml(
            `${selectedBackupPolicySummary.retentionDays}d retention at ${selectedBackupPolicySummary.storageLocation}.`
          ),
          tone:
            selectedBackupPolicyTenantApps.length +
              selectedBackupPolicyTenantZones.length +
              selectedBackupPolicyTenantDatabases.length >
            0
              ? ("success" as const)
              : ("default" as const)
        }
      ]
    : [];
  const selectedBackupRunsPanel = selectedBackupPolicySummary
    ? renderRelatedPanel(
        copy.backupsTitle,
        copy.backupsDescription,
        selectedBackupPolicyRuns.map((run) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("backups", undefined, run.runId)
          )}">${escapeHtml(run.runId)}</a>`,
          meta: escapeHtml([run.status, formatDate(run.startedAt, locale)].join(" · ")),
          summary: escapeHtml(run.summary),
          tone:
            run.status === "failed"
              ? "danger"
              : run.status === "succeeded"
                ? "success"
                : "default"
        })),
        copy.noBackups
      )
    : "";
  const backupFilterForm = renderBackupsFilterForm({
    backupNodeFilter,
    backupPolicyFilter,
    backupStatusFilter,
    backupTenantFilter,
    copy,
    data,
    renderWorkspaceFilterForm
  });
  const backupsTable = renderBackupsTable({
    backupRows,
    copy,
    renderDataTable: args.renderDataTable
  });
  const backupRunPanel = renderBackupRunPanel({
    copy,
    currentBackupFilters,
    formatDate,
    locale,
    renderDetailGrid,
    renderPill,
    selectedBackupPolicySummary,
    selectedBackupViewRun
  });
  const selectedBackupPolicyPanel = renderSelectedBackupPolicyPanel({
    copy,
    currentBackupFilters,
    renderActionFacts,
    renderDetailGrid,
    renderPill,
    renderRelatedPanel,
    selectedBackupPolicyLatestFailedRun,
    selectedBackupPolicyLatestSuccessRun,
    selectedBackupPolicyRuns,
    selectedBackupPolicySummary,
    selectedBackupPolicyTargetHealth,
    selectedBackupPolicyTenantApps,
    selectedBackupPolicyTenantDatabases,
    selectedBackupPolicyTenantZones,
    selectedBackupSummaryActionPreviewItems
  });

  return `<section id="section-backups" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.succeededBackups, value: String(backupSucceededCount), tone: backupSucceededCount > 0 ? "success" : "muted" },
      { label: copy.runningBackups, value: String(backupRunningCount), tone: backupRunningCount > 0 ? "muted" : "success" },
      { label: copy.failedBackups, value: String(backupFailedCount), tone: backupFailedCount > 0 ? "danger" : "success" },
      { label: copy.policyCoverage, value: String(backupCoverageCount), tone: backupCoverageCount > 0 ? "success" : "muted" }
    ])}
    ${backupFilterForm}
    ${backupsTable}
    ${backupRunPanel}
    ${selectedBackupPolicyPanel}
    ${selectedBackupRunsPanel}
  </section>`;
}
