import { escapeHtml } from "@simplehost/panel-ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import {
  groupItemsBy,
  summarizeGroupStatuses
} from "./dashboard-utils.js";
import {
  buildActiveBackupFilterItems,
  renderBackupsFilterForm
} from "./dashboard-backups-filters.js";
import { renderBackupsWorkspacePanels } from "./dashboard-backups-panels.js";
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
    findRelatedAuditEvents,
    formatDate,
    renderActionFacts,
    renderActiveFiltersPanel,
    renderAuditPanel,
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
  const selectedBackupAuditEvents = selectedBackupViewRun || selectedBackupPolicySummary
    ? findRelatedAuditEvents(
        data.auditEvents,
        [
          selectedBackupViewRun?.runId ?? "",
          selectedBackupViewRun?.policySlug ?? selectedBackupPolicySummary?.policySlug ?? "",
          selectedBackupViewRun?.nodeId ?? selectedBackupPolicySummary?.targetNodeId ?? "",
          selectedBackupPolicySummary?.storageLocation ?? ""
        ],
        8
      )
    : [];
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
  const backupLatestSuccessRun = filteredBackupRuns.find((run) => run.status === "succeeded");
  const backupLatestFailedRun = filteredBackupRuns.find((run) => run.status === "failed");
  const backupCoveredTenantCount = new Set(
    filteredBackupPolicies.map((policy) => policy.tenantSlug)
  ).size;
  const backupTargetNodeCount = new Set(
    filteredBackupPolicies.map((policy) => policy.targetNodeId)
  ).size;
  const backupNodeGroups = groupItemsBy(filteredBackupRuns, (run) => run.nodeId).slice(0, 6);
  const backupStatusGroups = groupItemsBy(filteredBackupRuns, (run) => run.status).slice(0, 4);
  const backupTenantGroups = groupItemsBy(filteredBackupPolicies, (policy) => policy.tenantSlug).slice(0, 6);
  const backupPolicyGroups = groupItemsBy(filteredBackupRuns, (run) => run.policySlug).slice(0, 6);
  const backupPolicyPreviewItems = filteredBackupPolicies.slice(0, 6).map((policy) => ({
    title: `<a class="detail-link" href="${escapeHtml(
      buildDashboardViewUrl("backups", undefined, policy.policySlug)
    )}">${escapeHtml(policy.policySlug)}</a>`,
    meta: escapeHtml([policy.tenantSlug, policy.targetNodeId].join(" · ")),
    summary: escapeHtml(`${policy.schedule} · ${policy.retentionDays}d retention`),
    tone: "default" as const
  }));
  const backupFailureItems = filteredBackupRuns
    .filter((run) => run.status === "failed")
    .slice(0, 6)
    .map((run) => ({
      title: `<a class="detail-link" href="${escapeHtml(
        buildDashboardViewUrl("backups", undefined, run.runId)
      )}">${escapeHtml(run.runId)}</a>`,
      meta: escapeHtml([run.policySlug, run.nodeId].join(" · ")),
      summary: escapeHtml(run.summary),
      tone: "danger" as const
    }));
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
    : `<article class="panel"><p class="empty">${escapeHtml(copy.noBackups)}</p></article>`;
  const activeBackupFilterItems = buildActiveBackupFilterItems({
    backupNodeFilter,
    backupPolicyFilter,
    backupStatusFilter,
    backupTenantFilter,
    copy
  });
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
  const {
    backupActiveFiltersPanel,
    backupCoverageByTenantPanel,
    backupCoveragePanel,
    backupFailureFocusPanel,
    backupNodesPanel,
    backupPolicySignalsPanel,
    backupRunPanel,
    backupRunSignalsPanel,
    backupTargetPosturePanel,
    selectedBackupAuditPanel,
    selectedBackupPolicyPanel
  } = renderBackupsWorkspacePanels({
    activeBackupFilterItems,
    backupCoveredTenantCount,
    backupCoverageCount,
    backupFailureItems,
    backupLatestFailedRun,
    backupLatestSuccessRun,
    backupNodeGroups,
    backupPolicyGroups,
    backupPolicyPreviewItems,
    backupStatusGroups,
    backupTargetNodeCount,
    backupTenantGroups,
    copy,
    currentBackupFilters,
    data,
    formatDate,
    locale,
    renderActionFacts,
    renderActiveFiltersPanel,
    renderAuditPanel,
    renderDetailGrid,
    renderPill,
    renderRelatedPanel,
    selectedBackupAuditEvents,
    selectedBackupPolicyLatestFailedRun,
    selectedBackupPolicyLatestSuccessRun,
    selectedBackupPolicyRuns,
    selectedBackupPolicySummary,
    selectedBackupPolicyTargetHealth,
    selectedBackupPolicyTenantApps,
    selectedBackupPolicyTenantDatabases,
    selectedBackupPolicyTenantZones,
    selectedBackupRunsPanel,
    selectedBackupSummaryActionPreviewItems,
    selectedBackupViewRun
  });

  return `<section id="section-backups" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.succeededBackups, value: String(backupSucceededCount), tone: backupSucceededCount > 0 ? "success" : "muted" },
      { label: copy.runningBackups, value: String(backupRunningCount), tone: backupRunningCount > 0 ? "muted" : "success" },
      { label: copy.failedBackups, value: String(backupFailedCount), tone: backupFailedCount > 0 ? "danger" : "success" },
      { label: copy.policyCoverage, value: String(backupCoverageCount), tone: backupCoverageCount > 0 ? "success" : "muted" }
    ])}
    ${backupFilterForm}
    ${backupActiveFiltersPanel}
    ${backupsTable}
    <div class="grid-two-desktop">
      ${backupRunPanel}
      <div class="stack">
        ${backupCoveragePanel}
        ${backupNodesPanel}
        ${backupCoverageByTenantPanel}
        ${backupTargetPosturePanel}
        ${backupPolicySignalsPanel}
        ${backupRunSignalsPanel}
        ${selectedBackupPolicyPanel}
        ${selectedBackupRunsPanel}
        ${backupFailureFocusPanel}
        ${selectedBackupAuditPanel}
      </div>
    </div>
  </section>`;
}
