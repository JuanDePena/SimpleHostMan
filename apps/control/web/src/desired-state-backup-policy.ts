import { escapeHtml } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import {
  type DesiredStateActionFactsRenderer,
  type DesiredStateDetailGridRenderer,
  type DesiredStatePillRenderer,
  type DesiredStateRelatedPanelItem,
  type DesiredStateRelatedPanelRenderer,
  type DesiredStateSelectOption,
  type DesiredStateSelectOptionsRenderer
} from "./desired-state-shared.js";
import { type WebLocale } from "./request.js";

type App = DashboardData["desiredState"]["spec"]["apps"][number];
type Zone = DashboardData["desiredState"]["spec"]["zones"][number];
type Database = DashboardData["desiredState"]["spec"]["databases"][number];
type BackupPolicy = DashboardData["desiredState"]["spec"]["backupPolicies"][number];
type BackupRun = DashboardData["backups"]["latestRuns"][number];
type AuditEvent = DashboardData["auditEvents"][number];
type NodeHealth = DashboardData["nodeHealth"][number];

export interface DesiredStateBackupPolicyCopy {
  selectedResourceTitle: string;
  selectedResourceDescription: string;
  backupPolicyColTenant: string;
  backupPolicyColTargetNode: string;
  backupPolicyColSchedule: string;
  backupPolicyColRetention: string;
  storageRootLabel: string;
  recordPreviewTitle: string;
  latestSuccessLabel: string;
  latestFailureLabel: string;
  none: string;
  backupColStatus: string;
  backupColNode: string;
  backupColStarted: string;
  backupColSummary: string;
  noBackups: string;
  effectiveStateTitle: string;
  effectiveStateDescription: string;
  nodeHealthTitle: string;
  relatedJobsTitle: string;
  noRelatedRecords: string;
  plannedChangesTitle: string;
  plannedChangesDescription: string;
  failureFocusTitle: string;
  failureFocusDescription: string;
  relatedResourcesTitle: string;
  relatedResourcesDescription: string;
  backupsTitle: string;
  openNodeHealth: string;
  desiredStateEditorsTitle: string;
  desiredStateEditorsDescription: string;
  detailActionsTitle: string;
  impactPreviewTitle: string;
  backupsDescription: string;
  policyCoverage: string;
  affectedResourcesLabel: string;
  queuedWorkTitle: string;
  backupCoverageDescription: string;
  openBackupsView: string;
  dangerZoneTitle: string;
  backupPolicyContextDescription: string;
}

interface DesiredStateBackupPolicyRenderers {
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderActionFacts: DesiredStateActionFactsRenderer;
  renderAuditPanel: (events: AuditEvent[]) => string;
  renderDetailGrid: DesiredStateDetailGridRenderer;
  renderPill: DesiredStatePillRenderer;
  renderRelatedPanel: DesiredStateRelatedPanelRenderer<DesiredStateRelatedPanelItem>;
  renderSelectOptions: DesiredStateSelectOptionsRenderer;
}

export function renderBackupPolicyDesiredStatePanels(args: {
  copy: DesiredStateBackupPolicyCopy;
  locale: WebLocale;
  selectedBackupPolicy: BackupPolicy | undefined;
  selectedBackupRun: BackupRun | undefined;
  selectedBackupRuns: BackupRun[];
  selectedBackupAuditEvents: AuditEvent[];
  selectedBackupLatestSuccessRun: BackupRun | undefined;
  selectedBackupLatestFailureRun: BackupRun | undefined;
  selectedBackupTargetHealth: NodeHealth | undefined;
  selectedBackupActionPreviewItems: DesiredStateRelatedPanelItem[];
  selectedBackupTenantApps: App[];
  selectedBackupTenantZones: Zone[];
  selectedBackupTenantDatabases: Database[];
  tenantOptions: DesiredStateSelectOption[];
  nodeOptions: DesiredStateSelectOption[];
  policyCoverageCount: number;
  renderers: DesiredStateBackupPolicyRenderers;
}): { detailPanel: string; editorPanel: string } {
  const {
    copy,
    locale,
    selectedBackupPolicy,
    selectedBackupRun,
    selectedBackupRuns,
    selectedBackupAuditEvents,
    selectedBackupLatestSuccessRun,
    selectedBackupLatestFailureRun,
    selectedBackupTargetHealth,
    selectedBackupActionPreviewItems,
    selectedBackupTenantApps,
    selectedBackupTenantZones,
    selectedBackupTenantDatabases,
    tenantOptions,
    nodeOptions,
    policyCoverageCount,
    renderers
  } = args;

  if (!selectedBackupPolicy) {
    return {
      detailPanel: "",
      editorPanel: ""
    };
  }

  const detailPanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.selectedResourceTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
      </div>
    </div>
    <div>
      <h3>${escapeHtml(selectedBackupPolicy.policySlug)}</h3>
      <p class="muted">${escapeHtml(selectedBackupPolicy.storageLocation)}</p>
    </div>
    ${renderers.renderDetailGrid([
      { label: copy.backupPolicyColTenant, value: escapeHtml(selectedBackupPolicy.tenantSlug) },
      {
        label: copy.backupPolicyColTargetNode,
        value: `<span class="mono">${escapeHtml(selectedBackupPolicy.targetNodeId)}</span>`
      },
      {
        label: copy.backupPolicyColSchedule,
        value: `<span class="mono">${escapeHtml(selectedBackupPolicy.schedule)}</span>`
      },
      {
        label: copy.backupPolicyColRetention,
        value: renderers.renderPill(
          String(selectedBackupPolicy.retentionDays),
          selectedBackupPolicy.retentionDays > 0 ? "success" : "muted"
        )
      },
      {
        label: copy.storageRootLabel,
        value: `<span class="mono">${escapeHtml(selectedBackupPolicy.storageLocation)}</span>`
      },
      {
        label: copy.recordPreviewTitle,
        value: escapeHtml(selectedBackupPolicy.resourceSelectors.join(", ") || copy.none)
      },
      {
        label: copy.latestSuccessLabel,
        value: selectedBackupLatestSuccessRun
          ? `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("backups", undefined, selectedBackupLatestSuccessRun.runId)
            )}">${escapeHtml(selectedBackupLatestSuccessRun.runId)}</a>`
          : renderers.renderPill(copy.none, "muted")
      },
      {
        label: copy.latestFailureLabel,
        value: selectedBackupLatestFailureRun
          ? `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("backups", undefined, selectedBackupLatestFailureRun.runId)
            )}">${escapeHtml(selectedBackupLatestFailureRun.runId)}</a>`
          : renderers.renderPill(copy.none, "muted")
      }
    ])}
    ${
      selectedBackupRun
        ? renderers.renderDetailGrid([
            {
              label: copy.backupColStatus,
              value: renderers.renderPill(
                selectedBackupRun.status,
                selectedBackupRun.status === "succeeded"
                  ? "success"
                  : selectedBackupRun.status === "failed"
                    ? "danger"
                    : "muted"
              )
            },
            {
              label: copy.backupColNode,
              value: `<span class="mono">${escapeHtml(selectedBackupRun.nodeId)}</span>`
            },
            {
              label: copy.backupColStarted,
              value: escapeHtml(renderers.formatDate(selectedBackupRun.startedAt, locale))
            },
            {
              label: copy.backupColSummary,
              value: escapeHtml(selectedBackupRun.summary)
            }
          ])
        : `<p class="empty">${escapeHtml(copy.noBackups)}</p>`
    }
    ${renderers.renderRelatedPanel(
      copy.effectiveStateTitle,
      copy.effectiveStateDescription,
      [
        {
          title: escapeHtml(copy.nodeHealthTitle),
          meta: escapeHtml(selectedBackupTargetHealth?.currentVersion ?? copy.none),
          summary: escapeHtml(selectedBackupTargetHealth?.latestJobSummary ?? copy.none),
          tone: selectedBackupTargetHealth?.latestJobStatus === "failed"
            ? "danger"
            : selectedBackupTargetHealth?.latestJobStatus === "applied"
              ? "success"
              : "default"
        },
        {
          title: escapeHtml(copy.relatedJobsTitle),
          meta: escapeHtml(`${selectedBackupRuns.length} run(s)`),
          summary: escapeHtml(selectedBackupRun?.summary ?? copy.none),
          tone: selectedBackupRuns.some((run) => run.status === "failed")
            ? "danger"
            : selectedBackupRuns.some((run) => run.status === "succeeded")
              ? "success"
              : "default"
        }
      ],
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.plannedChangesTitle,
      copy.plannedChangesDescription,
      selectedBackupActionPreviewItems,
      copy.noRelatedRecords
    )}
    ${renderers.renderRelatedPanel(
      copy.failureFocusTitle,
      copy.failureFocusDescription,
      selectedBackupRuns
        .filter((run) => run.status === "failed")
        .slice(0, 4)
        .map((run) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("backups", undefined, run.runId)
          )}">${escapeHtml(run.runId)}</a>`,
          meta: escapeHtml(
            [run.policySlug, renderers.formatDate(run.startedAt, locale)].join(" · ")
          ),
          summary: escapeHtml(run.summary),
          tone: "danger" as const
        })),
      copy.noBackups
    )}
    ${renderers.renderRelatedPanel(
      copy.relatedResourcesTitle,
      copy.relatedResourcesDescription,
      [
        ...selectedBackupTenantApps.slice(0, 4).map((app) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("desired-state", "desired-state-apps", app.slug)
          )}">${escapeHtml(app.slug)}</a>`,
          meta: escapeHtml(app.canonicalDomain),
          summary: escapeHtml(app.primaryNodeId),
          tone: "default" as const
        })),
        ...selectedBackupTenantZones.slice(0, 3).map((zone) => ({
          title: `<a class="detail-link" href="${escapeHtml(
            buildDashboardViewUrl("desired-state", "desired-state-zones", zone.zoneName)
          )}">${escapeHtml(zone.zoneName)}</a>`,
          meta: escapeHtml(zone.primaryNodeId),
          summary: escapeHtml(zone.tenantSlug),
          tone: "default" as const
        }))
      ],
      copy.noRelatedRecords
    )}
    <div class="toolbar">
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("backups", undefined, selectedBackupPolicy.policySlug)
      )}">${escapeHtml(copy.backupsTitle)}</a>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedBackupPolicy.targetNodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    ${renderers.renderAuditPanel(selectedBackupAuditEvents)}
  </article>`;

  const editorPanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.desiredStateEditorsTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
      </div>
    </div>
    <form method="post" action="/resources/backups/upsert" class="stack">
      <input type="hidden" name="originalPolicySlug" value="${escapeHtml(selectedBackupPolicy.policySlug)}" />
      <div class="grid grid-two">
        <article class="panel panel-nested detail-shell">
          <div>
            <h3>${escapeHtml(copy.detailActionsTitle)}</h3>
          </div>
          <div class="form-grid">
            <label>Policy slug
              <input name="policySlug" value="${escapeHtml(selectedBackupPolicy.policySlug)}" required spellcheck="false" />
            </label>
            <label>Tenant slug
              <select name="tenantSlug" required>
                ${renderers.renderSelectOptions(tenantOptions, selectedBackupPolicy.tenantSlug)}
              </select>
            </label>
            <label>Target node
              <select name="targetNodeId" required>
                ${renderers.renderSelectOptions(nodeOptions, selectedBackupPolicy.targetNodeId)}
              </select>
            </label>
            <label>Schedule
              <input name="schedule" value="${escapeHtml(selectedBackupPolicy.schedule)}" required />
            </label>
            <label>Retention days
              <input type="number" name="retentionDays" min="1" value="${escapeHtml(String(selectedBackupPolicy.retentionDays))}" required />
            </label>
          </div>
        </article>
        <article class="panel panel-nested detail-shell">
          <div>
            <h3>${escapeHtml(copy.impactPreviewTitle)}</h3>
            <p class="muted section-description">${escapeHtml(copy.backupsDescription)}</p>
          </div>
          <div class="form-grid">
            <label>Storage location
              <input name="storageLocation" value="${escapeHtml(selectedBackupPolicy.storageLocation)}" required />
            </label>
            <label>Resource selectors
              <input name="resourceSelectors" value="${escapeHtml(selectedBackupPolicy.resourceSelectors.join(", "))}" />
            </label>
          </div>
          ${renderers.renderDetailGrid([
            {
              label: copy.policyCoverage,
              value: escapeHtml(String(policyCoverageCount))
            },
            {
              label: copy.affectedResourcesLabel,
              value: escapeHtml(
                `${selectedBackupPolicy.resourceSelectors.length || 0} selector(s) · ${selectedBackupTenantApps.length} app(s) · ${selectedBackupTenantZones.length} zone(s)`
              )
            },
            {
              label: copy.backupColStatus,
              value: selectedBackupRun
                ? renderers.renderPill(
                    selectedBackupRun.status,
                    selectedBackupRun.status === "succeeded"
                      ? "success"
                      : selectedBackupRun.status === "failed"
                        ? "danger"
                        : "muted"
                  )
                : renderers.renderPill(copy.none, "muted")
            },
            {
              label: copy.latestFailureLabel,
              value: selectedBackupLatestFailureRun
                ? renderers.renderPill(selectedBackupLatestFailureRun.status, "danger")
                : renderers.renderPill(copy.none, "muted")
            },
            {
              label: copy.latestSuccessLabel,
              value: selectedBackupLatestSuccessRun
                ? renderers.renderPill(selectedBackupLatestSuccessRun.status, "success")
                : renderers.renderPill(copy.none, "muted")
            },
            {
              label: copy.nodeHealthTitle,
              value: selectedBackupTargetHealth?.latestJobStatus
                ? renderers.renderPill(
                    selectedBackupTargetHealth.latestJobStatus,
                    selectedBackupTargetHealth.latestJobStatus === "applied"
                      ? "success"
                      : selectedBackupTargetHealth.latestJobStatus === "failed"
                        ? "danger"
                        : "muted"
                  )
                : renderers.renderPill(copy.none, "muted")
            }
          ])}
          ${renderers.renderRelatedPanel(
            copy.queuedWorkTitle,
            copy.backupCoverageDescription,
            [
              {
                title: `<span class="mono">${escapeHtml(selectedBackupPolicy.targetNodeId)}</span>`,
                meta: escapeHtml(
                  [
                    selectedBackupPolicy.schedule,
                    `${selectedBackupPolicy.retentionDays}d retention`
                  ].join(" · ")
                ),
                summary: escapeHtml(
                  `${selectedBackupPolicy.resourceSelectors.length || 0} selector(s), ${selectedBackupTenantApps.length} app(s), ${selectedBackupTenantZones.length} zone(s), ${selectedBackupTenantDatabases.length} database(s)`
                ),
                tone: "default"
              }
            ],
            copy.noRelatedRecords
          )}
          ${renderers.renderRelatedPanel(
            copy.plannedChangesTitle,
            copy.plannedChangesDescription,
            selectedBackupActionPreviewItems,
            copy.noRelatedRecords
          )}
        </article>
      </div>
      <div class="toolbar">
        <button type="submit">Save backup policy</button>
        <a class="button-link secondary" href="${escapeHtml(
          buildDashboardViewUrl("backups", undefined, selectedBackupPolicy.policySlug)
        )}">${escapeHtml(copy.openBackupsView)}</a>
      </div>
    </form>
    <article class="panel panel-nested detail-shell danger-shell">
      <div>
        <h3>${escapeHtml(copy.dangerZoneTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.backupPolicyContextDescription)}</p>
      </div>
      ${renderers.renderActionFacts([
        {
          label: copy.affectedResourcesLabel,
          value: escapeHtml(
            `${selectedBackupTenantApps.length} app(s) · ${selectedBackupTenantZones.length} zone(s) · ${selectedBackupTenantDatabases.length} database(s)`
          )
        },
        {
          label: copy.relatedJobsTitle,
          value: escapeHtml(String(selectedBackupRuns.length))
        }
      ])}
      <form method="post" action="/resources/backups/delete" class="toolbar">
        <input type="hidden" name="policySlug" value="${escapeHtml(selectedBackupPolicy.policySlug)}" />
        <button class="danger" type="submit" data-confirm="${escapeHtml(
          `Delete backup policy ${selectedBackupPolicy.policySlug}? ${selectedBackupRuns.length} recorded run(s) and coverage for ${selectedBackupTenantApps.length} app(s), ${selectedBackupTenantZones.length} zone(s) and ${selectedBackupTenantDatabases.length} database(s) will no longer be tracked by this policy.`
        )}">Delete backup policy</button>
      </form>
    </article>
  </article>`;

  return {
    detailPanel,
    editorPanel
  };
}
