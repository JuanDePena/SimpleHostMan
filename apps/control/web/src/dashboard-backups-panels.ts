import { escapeHtml } from "@simplehost/panel-ui";

import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { summarizeGroupStatuses } from "./dashboard-utils.js";
import { type BackupCopy, type BackupsWorkspaceArgs } from "./dashboard-backups-types.js";

type Group<T> = {
  key: string;
  items: T[];
};

export function renderBackupsWorkspacePanels<Copy extends BackupCopy>(
  args: Pick<
    BackupsWorkspaceArgs<Copy>,
    | "copy"
    | "currentBackupFilters"
    | "data"
    | "formatDate"
    | "locale"
    | "renderActionFacts"
    | "renderActiveFiltersPanel"
    | "renderAuditPanel"
    | "renderDetailGrid"
    | "renderPill"
    | "renderRelatedPanel"
  > & {
    activeBackupFilterItems: Array<{ label: string; value: string }>;
    backupCoveredTenantCount: number;
    backupCoverageCount: number;
    backupFailureItems: Array<{
      title: string;
      meta?: string;
      summary?: string;
      tone?: "default" | "danger" | "success";
    }>;
    backupLatestFailedRun: BackupsWorkspaceArgs<Copy>["filteredBackupRuns"][number] | undefined;
    backupLatestSuccessRun: BackupsWorkspaceArgs<Copy>["filteredBackupRuns"][number] | undefined;
    backupNodeGroups: Array<Group<BackupsWorkspaceArgs<Copy>["filteredBackupRuns"][number]>>;
    backupPolicyGroups: Array<Group<BackupsWorkspaceArgs<Copy>["filteredBackupRuns"][number]>>;
    backupPolicyPreviewItems: Array<{
      title: string;
      meta?: string;
      summary?: string;
      tone?: "default" | "danger" | "success";
    }>;
    backupStatusGroups: Array<Group<BackupsWorkspaceArgs<Copy>["filteredBackupRuns"][number]>>;
    backupTargetNodeCount: number;
    backupTenantGroups: Array<Group<BackupsWorkspaceArgs<Copy>["filteredBackupPolicies"][number]>>;
    selectedBackupAuditEvents: BackupsWorkspaceArgs<Copy>["data"]["auditEvents"];
    selectedBackupPolicyLatestFailedRun: BackupsWorkspaceArgs<Copy>["filteredBackupRuns"][number] | undefined;
    selectedBackupPolicyLatestSuccessRun: BackupsWorkspaceArgs<Copy>["filteredBackupRuns"][number] | undefined;
    selectedBackupPolicyRuns: BackupsWorkspaceArgs<Copy>["filteredBackupRuns"];
    selectedBackupPolicySummary: BackupsWorkspaceArgs<Copy>["selectedBackupPolicySummary"];
    selectedBackupPolicyTargetHealth: BackupsWorkspaceArgs<Copy>["data"]["nodeHealth"][number] | undefined;
    selectedBackupPolicyTenantApps: BackupsWorkspaceArgs<Copy>["data"]["desiredState"]["spec"]["apps"];
    selectedBackupPolicyTenantDatabases: BackupsWorkspaceArgs<Copy>["data"]["desiredState"]["spec"]["databases"];
    selectedBackupPolicyTenantZones: BackupsWorkspaceArgs<Copy>["data"]["desiredState"]["spec"]["zones"];
    selectedBackupRunsPanel: string;
    selectedBackupSummaryActionPreviewItems: Array<{
      title: string;
      meta?: string;
      summary?: string;
      tone?: "default" | "danger" | "success";
    }>;
    selectedBackupViewRun: BackupsWorkspaceArgs<Copy>["selectedBackupViewRun"];
  }
): {
  backupActiveFiltersPanel: string;
  backupCoverageByTenantPanel: string;
  backupCoveragePanel: string;
  backupFailureFocusPanel: string;
  backupNodesPanel: string;
  backupPolicySignalsPanel: string;
  backupRunPanel: string;
  backupRunSignalsPanel: string;
  backupTargetPosturePanel: string;
  selectedBackupAuditPanel: string;
  selectedBackupPolicyPanel: string;
} {
  const {
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
  } = args;

  const backupRunPanel = selectedBackupViewRun
    ? `<article class="panel detail-shell">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(copy.backupRunTitle)}</h3>
            <p class="muted section-description">${escapeHtml(copy.backupRunDescription)}</p>
          </div>
        </div>
        ${renderDetailGrid([
          { label: copy.backupColPolicy, value: `<span class="mono">${escapeHtml(selectedBackupViewRun.policySlug)}</span>` },
          { label: copy.backupColNode, value: `<span class="mono">${escapeHtml(selectedBackupViewRun.nodeId)}</span>` },
          {
            label: copy.backupColStatus,
            value: renderPill(
              selectedBackupViewRun.status,
              selectedBackupViewRun.status === "succeeded"
                ? "success"
                : selectedBackupViewRun.status === "failed"
                  ? "danger"
                  : "muted"
            )
          },
          { label: copy.backupColSummary, value: escapeHtml(selectedBackupViewRun.summary) },
          {
            label: copy.backupColStarted,
            value: escapeHtml(formatDate(selectedBackupViewRun.startedAt, locale))
          },
          {
            label: copy.latestCompleted,
            value: escapeHtml(
              selectedBackupViewRun.completedAt
                ? formatDate(selectedBackupViewRun.completedAt, locale)
                : copy.none
            )
          },
          {
            label: copy.openNodeHealth,
            value: `<a class="detail-link" href="${escapeHtml(
              buildDashboardViewUrl("node-health", undefined, selectedBackupViewRun.nodeId)
            )}">${escapeHtml(copy.openNodeHealth)}</a>`
          }
        ])}
        ${renderActionFacts([
          {
            label: copy.filterStatusLabel,
            value: `<a class="detail-link" href="${escapeHtml(
              buildDashboardViewUrl("backups", undefined, undefined, {
                ...currentBackupFilters,
                backupStatus: selectedBackupViewRun.status
              })
            )}">${escapeHtml(selectedBackupViewRun.status)}</a>`
          },
          {
            label: copy.filterNodeLabel,
            value: `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("backups", undefined, undefined, {
                ...currentBackupFilters,
                backupNode: selectedBackupViewRun.nodeId
              })
            )}">${escapeHtml(selectedBackupViewRun.nodeId)}</a>`
          },
          {
            label: copy.filterPolicyLabel,
            value: `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("backups", undefined, undefined, {
                ...currentBackupFilters,
                backupPolicy: selectedBackupViewRun.policySlug
              })
            )}">${escapeHtml(selectedBackupViewRun.policySlug)}</a>`
          },
          {
            label: copy.filterTenantLabel,
            value: selectedBackupPolicySummary
              ? `<a class="detail-link" href="${escapeHtml(
                  buildDashboardViewUrl("backups", undefined, undefined, {
                    ...currentBackupFilters,
                    backupTenant: selectedBackupPolicySummary.tenantSlug
                  })
                )}">${escapeHtml(selectedBackupPolicySummary.tenantSlug)}</a>`
              : escapeHtml(copy.none)
          }
        ])}
        <div class="toolbar">
          <a class="button-link secondary" href="${escapeHtml(
            buildDashboardViewUrl(
              "desired-state",
              "desired-state-backups",
              selectedBackupViewRun.policySlug
            )
          )}">${escapeHtml(copy.openDesiredState)}</a>
        </div>
      </article>`
    : `<article class="panel"><p class="empty">${escapeHtml(copy.noBackups)}</p></article>`;

  const selectedBackupPolicyPanel = selectedBackupPolicySummary
    ? `<article class="panel detail-shell">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(copy.backupPolicyContextTitle)}</h3>
            <p class="muted section-description">${escapeHtml(copy.backupPolicyContextDescription)}</p>
          </div>
          <a class="button-link secondary" href="${escapeHtml(
            buildDashboardViewUrl(
              "desired-state",
              "desired-state-backups",
              selectedBackupPolicySummary.policySlug
            )
          )}">${escapeHtml(copy.openDesiredState)}</a>
        </div>
        ${renderDetailGrid([
          { label: copy.backupPolicyColSlug, value: `<span class="mono">${escapeHtml(selectedBackupPolicySummary.policySlug)}</span>` },
          { label: copy.backupPolicyColTenant, value: escapeHtml(selectedBackupPolicySummary.tenantSlug) },
          {
            label: copy.backupPolicyColTargetNode,
            value: `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("node-health", undefined, selectedBackupPolicySummary.targetNodeId)
            )}">${escapeHtml(selectedBackupPolicySummary.targetNodeId)}</a>`
          },
          {
            label: copy.backupPolicyColSchedule,
            value: `<span class="mono">${escapeHtml(selectedBackupPolicySummary.schedule)}</span>`
          },
          {
            label: copy.backupPolicyColRetention,
            value: escapeHtml(String(selectedBackupPolicySummary.retentionDays))
          },
          {
            label: copy.storageLocationLabel,
            value: `<span class="mono">${escapeHtml(selectedBackupPolicySummary.storageLocation)}</span>`
          },
          {
            label: copy.resourceSelectorsLabel,
            value: escapeHtml(
              selectedBackupPolicySummary.resourceSelectors.length > 0
                ? selectedBackupPolicySummary.resourceSelectors.join(", ")
                : copy.none
            )
          },
          {
            label: copy.latestSuccessLabel,
            value: selectedBackupPolicyLatestSuccessRun
              ? `<a class="detail-link mono" href="${escapeHtml(
                  buildDashboardViewUrl("backups", undefined, selectedBackupPolicyLatestSuccessRun.runId)
                )}">${escapeHtml(selectedBackupPolicyLatestSuccessRun.runId)}</a>`
              : renderPill(copy.none, "muted")
          },
          {
            label: copy.latestFailureLabel,
            value: selectedBackupPolicyLatestFailedRun
              ? `<a class="detail-link mono" href="${escapeHtml(
                  buildDashboardViewUrl("backups", undefined, selectedBackupPolicyLatestFailedRun.runId)
                )}">${escapeHtml(selectedBackupPolicyLatestFailedRun.runId)}</a>`
              : renderPill(copy.none, "muted")
          },
          {
            label: copy.nodeHealthTitle,
            value: selectedBackupPolicyTargetHealth?.latestJobStatus
              ? renderPill(
                  selectedBackupPolicyTargetHealth.latestJobStatus,
                  selectedBackupPolicyTargetHealth.latestJobStatus === "applied"
                    ? "success"
                    : selectedBackupPolicyTargetHealth.latestJobStatus === "failed"
                      ? "danger"
                      : "muted"
                )
              : renderPill(copy.none, "muted")
          }
        ])}
        ${renderActionFacts([
          {
            label: copy.filterPolicyLabel,
            value: `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("backups", undefined, undefined, {
                ...currentBackupFilters,
                backupPolicy: selectedBackupPolicySummary.policySlug
              })
            )}">${escapeHtml(selectedBackupPolicySummary.policySlug)}</a>`
          },
          {
            label: copy.filterTenantLabel,
            value: `<a class="detail-link" href="${escapeHtml(
              buildDashboardViewUrl("backups", undefined, undefined, {
                ...currentBackupFilters,
                backupTenant: selectedBackupPolicySummary.tenantSlug
              })
            )}">${escapeHtml(selectedBackupPolicySummary.tenantSlug)}</a>`
          },
          {
            label: copy.filterNodeLabel,
            value: `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("backups", undefined, undefined, {
                ...currentBackupFilters,
                backupNode: selectedBackupPolicySummary.targetNodeId
              })
            )}">${escapeHtml(selectedBackupPolicySummary.targetNodeId)}</a>`
          }
        ])}
        ${renderRelatedPanel(
          copy.effectiveStateTitle,
          copy.effectiveStateDescription,
          [
            {
              title: escapeHtml(copy.nodeHealthTitle),
              meta: escapeHtml(selectedBackupPolicyTargetHealth?.currentVersion ?? copy.none),
              summary: escapeHtml(
                selectedBackupPolicyTargetHealth?.latestJobSummary ??
                  selectedBackupPolicyLatestSuccessRun?.summary ??
                  copy.none
              ),
              tone:
                selectedBackupPolicyTargetHealth?.latestJobStatus === "failed"
                  ? ("danger" as const)
                  : selectedBackupPolicyTargetHealth?.latestJobStatus === "applied"
                    ? ("success" as const)
                    : ("default" as const)
            },
            {
              title: escapeHtml(copy.relatedJobsTitle),
              meta: escapeHtml(`${selectedBackupPolicyRuns.length} run(s)`),
              summary: escapeHtml(
                selectedBackupPolicyLatestFailedRun?.summary ??
                  selectedBackupPolicyLatestSuccessRun?.summary ??
                  copy.none
              ),
              tone: selectedBackupPolicyRuns.some((run) => run.status === "failed")
                ? ("danger" as const)
                : selectedBackupPolicyRuns.some((run) => run.status === "succeeded")
                  ? ("success" as const)
                  : ("default" as const)
            }
          ],
          copy.noRelatedRecords
        )}
        ${renderRelatedPanel(
          copy.plannedChangesTitle,
          copy.plannedChangesDescription,
          selectedBackupSummaryActionPreviewItems,
          copy.noRelatedRecords
        )}
        ${renderRelatedPanel(
          copy.relatedResourcesTitle,
          copy.relatedResourcesDescription,
          [
            ...selectedBackupPolicyTenantApps.slice(0, 4).map((app) => ({
              title: `<a class="detail-link" href="${escapeHtml(
                buildDashboardViewUrl("desired-state", "desired-state-apps", app.slug)
              )}">${escapeHtml(app.slug)}</a>`,
              meta: escapeHtml(app.canonicalDomain),
              summary: escapeHtml(app.primaryNodeId),
              tone: "default" as const
            })),
            ...selectedBackupPolicyTenantZones.slice(0, 3).map((zone) => ({
              title: `<a class="detail-link" href="${escapeHtml(
                buildDashboardViewUrl("desired-state", "desired-state-zones", zone.zoneName)
              )}">${escapeHtml(zone.zoneName)}</a>`,
              meta: escapeHtml(zone.primaryNodeId),
              summary: escapeHtml(zone.tenantSlug),
              tone: "default" as const
            })),
            ...selectedBackupPolicyTenantDatabases.slice(0, 3).map((database) => ({
              title: `<a class="detail-link" href="${escapeHtml(
                buildDashboardViewUrl("desired-state", "desired-state-databases", database.appSlug)
              )}">${escapeHtml(database.databaseName)}</a>`,
              meta: escapeHtml(database.engine),
              summary: escapeHtml(database.appSlug),
              tone: "default" as const
            }))
          ],
          copy.noRelatedRecords
        )}
      </article>`
    : `<article class="panel"><p class="empty">${escapeHtml(copy.noBackupPolicies)}</p></article>`;

  const backupCoveragePanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.backupCoverageTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.backupCoverageDescription)}</p>
      </div>
    </div>
    ${renderDetailGrid([
      {
        label: copy.policyCoverage,
        value: renderPill(String(backupCoverageCount), backupCoverageCount > 0 ? "success" : "muted")
      },
      {
        label: copy.navTenants,
        value: renderPill(String(backupCoveredTenantCount), backupCoveredTenantCount > 0 ? "success" : "muted")
      },
      {
        label: copy.targetedNodesLabel,
        value: renderPill(String(backupTargetNodeCount), backupTargetNodeCount > 0 ? "success" : "muted")
      },
      {
        label: copy.latestSuccessLabel,
        value: backupLatestSuccessRun
          ? `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("backups", undefined, backupLatestSuccessRun.runId)
            )}">${escapeHtml(backupLatestSuccessRun.runId)}</a>`
          : renderPill(copy.none, "muted")
      },
      {
        label: copy.latestFailureLabel,
        value: backupLatestFailedRun
          ? `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("backups", undefined, backupLatestFailedRun.runId)
            )}">${escapeHtml(backupLatestFailedRun.runId)}</a>`
          : renderPill(copy.none, "muted")
      },
      {
        label: copy.nodeHealthTitle,
        value: selectedBackupPolicyTargetHealth?.latestJobStatus
          ? renderPill(
              selectedBackupPolicyTargetHealth.latestJobStatus,
              selectedBackupPolicyTargetHealth.latestJobStatus === "applied"
                ? "success"
                : selectedBackupPolicyTargetHealth.latestJobStatus === "failed"
                  ? "danger"
                  : "muted"
            )
          : renderPill(copy.none, "muted")
      }
    ])}
    ${renderRelatedPanel(
      copy.navBackupPolicies,
      copy.backupCoverageDescription,
      backupPolicyPreviewItems,
      copy.noBackupPolicies
    )}
  </article>`;

  const backupTargetPosturePanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.backupTargetPostureTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.backupTargetPostureDescription)}</p>
      </div>
    </div>
    ${renderDetailGrid([
      {
        label: copy.backupPolicyColTargetNode,
        value: selectedBackupPolicySummary
          ? `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("node-health", undefined, selectedBackupPolicySummary.targetNodeId)
            )}">${escapeHtml(selectedBackupPolicySummary.targetNodeId)}</a>`
          : renderPill(copy.none, "muted")
      },
      {
        label: copy.nodeHealthTitle,
        value: selectedBackupPolicyTargetHealth?.latestJobStatus
          ? renderPill(
              selectedBackupPolicyTargetHealth.latestJobStatus,
              selectedBackupPolicyTargetHealth.latestJobStatus === "applied"
                ? "success"
                : selectedBackupPolicyTargetHealth.latestJobStatus === "failed"
                  ? "danger"
                  : "muted"
            )
          : renderPill(copy.none, "muted")
      },
      {
        label: copy.nodeColPending,
        value: selectedBackupPolicyTargetHealth
          ? renderPill(
              String(selectedBackupPolicyTargetHealth.pendingJobCount),
              selectedBackupPolicyTargetHealth.pendingJobCount > 0 ? "danger" : "success"
            )
          : renderPill(copy.none, "muted")
      },
      {
        label: copy.nodeColVersion,
        value: selectedBackupPolicyTargetHealth?.currentVersion
          ? renderPill(selectedBackupPolicyTargetHealth.currentVersion, "muted")
          : renderPill(copy.none, "muted")
      },
      {
        label: copy.navBackupPolicies,
        value: renderPill(
          String(
            selectedBackupPolicySummary
              ? data.backups.policies.filter(
                  (policy) => policy.targetNodeId === selectedBackupPolicySummary.targetNodeId
                ).length
              : 0
          ),
          selectedBackupPolicySummary ? "success" : "muted"
        )
      },
      {
        label: copy.relatedJobsTitle,
        value: renderPill(
          String(selectedBackupPolicySummary ? selectedBackupPolicyRuns.length : 0),
          selectedBackupPolicySummary && selectedBackupPolicyRuns.length > 0 ? "success" : "muted"
        )
      }
    ])}
    ${renderRelatedPanel(
      copy.backupRunSignalsTitle,
      copy.backupRunSignalsDescription,
      backupNodeGroups.map((group) => ({
        title: `<a class="detail-link mono" href="${escapeHtml(
          buildDashboardViewUrl("node-health", undefined, group.key)
        )}">${escapeHtml(group.key)}</a>`,
        meta: escapeHtml(`${group.items.length} run(s)`),
        summary: escapeHtml(summarizeGroupStatuses(group.items)),
        tone: group.items.some((run) => run.status === "failed")
          ? ("danger" as const)
          : group.items.some((run) => run.status === "succeeded")
            ? ("success" as const)
            : ("default" as const)
      })),
      copy.noBackups
    )}
  </article>`;

  const backupRunSignalsPanel = renderRelatedPanel(
    copy.backupRunSignalsTitle,
    copy.backupRunSignalsDescription,
    backupStatusGroups.map((group) => ({
      title: `<a class="detail-link" href="${escapeHtml(
        buildDashboardViewUrl("backups", undefined, undefined, {
          ...currentBackupFilters,
          backupStatus: group.key
        })
      )}">${escapeHtml(group.key)}</a>`,
      meta: escapeHtml(`${group.items.length} run(s)`),
      summary: escapeHtml(
        group.items
          .slice(0, 2)
          .map((run) => `${run.policySlug} · ${run.nodeId}`)
          .join(" · ")
      ),
      tone:
        group.key === "failed"
          ? ("danger" as const)
          : group.key === "succeeded"
            ? ("success" as const)
            : ("default" as const)
    })),
    copy.noBackups
  );

  const backupNodesPanel = renderRelatedPanel(
    copy.backupNodesTitle,
    copy.backupNodesDescription,
    backupNodeGroups.map((group) => ({
      title: `<a class="detail-link mono" href="${escapeHtml(
        buildDashboardViewUrl("backups", undefined, undefined, {
          ...currentBackupFilters,
          backupNode: group.key
        })
      )}">${escapeHtml(group.key)}</a>`,
      meta: escapeHtml(`${group.items.length} run(s)`),
      summary: escapeHtml(summarizeGroupStatuses(group.items)),
      tone: group.items.some((run) => run.status === "failed")
        ? ("danger" as const)
        : group.items.some((run) => run.status === "succeeded")
          ? ("success" as const)
          : ("default" as const)
    })),
    copy.noBackups
  );

  const backupCoverageByTenantPanel = renderRelatedPanel(
    copy.backupCoverageByTenantTitle,
    copy.backupCoverageByTenantDescription,
    backupTenantGroups.map((group) => {
      const tenantApps = data.desiredState.spec.apps.filter((app) => app.tenantSlug === group.key).length;
      const tenantZones = data.desiredState.spec.zones.filter((zone) => zone.tenantSlug === group.key).length;
      const tenantDatabases = data.desiredState.spec.databases.filter((database) => {
        const app = data.desiredState.spec.apps.find((entry) => entry.slug === database.appSlug);
        return app?.tenantSlug === group.key;
      }).length;

      return {
        title: `<a class="detail-link" href="${escapeHtml(
          buildDashboardViewUrl("backups", undefined, undefined, {
            ...currentBackupFilters,
            backupTenant: group.key
          })
        )}">${escapeHtml(group.key)}</a>`,
        meta: escapeHtml(`${group.items.length} polic(ies)`),
        summary: escapeHtml(
          `${tenantApps} app(s) · ${tenantZones} zone(s) · ${tenantDatabases} database(s)`
        ),
        tone: "default" as const
      };
    }),
    copy.noBackupPolicies
  );

  const backupPolicySignalsPanel = renderRelatedPanel(
    copy.backupPolicySignalsTitle,
    copy.backupPolicySignalsDescription,
    backupPolicyGroups.map((group) => ({
      title: `<a class="detail-link mono" href="${escapeHtml(
        buildDashboardViewUrl("backups", undefined, undefined, {
          ...currentBackupFilters,
          backupPolicy: group.key
        })
      )}">${escapeHtml(group.key)}</a>`,
      meta: escapeHtml(`${group.items.length} run(s)`),
      summary: escapeHtml(summarizeGroupStatuses(group.items)),
      tone: group.items.some((run) => run.status === "failed")
        ? ("danger" as const)
        : group.items.some((run) => run.status === "succeeded")
          ? ("success" as const)
          : ("default" as const)
    })),
    copy.noBackups
  );

  return {
    backupActiveFiltersPanel: renderActiveFiltersPanel(
      copy,
      activeBackupFilterItems,
      buildDashboardViewUrl("backups")
    ),
    backupCoverageByTenantPanel,
    backupCoveragePanel,
    backupFailureFocusPanel: renderRelatedPanel(
      copy.failureFocusTitle,
      copy.failureFocusDescription,
      backupFailureItems,
      copy.noBackups
    ),
    backupNodesPanel,
    backupPolicySignalsPanel,
    backupRunPanel,
    backupRunSignalsPanel,
    backupTargetPosturePanel,
    selectedBackupAuditPanel: renderAuditPanel(copy, locale, selectedBackupAuditEvents),
    selectedBackupPolicyPanel
  };
}
