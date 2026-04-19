import { escapeHtml } from "@simplehost/ui";

import {
  type BuildDesiredStateModelArgs,
  type DesiredStateActionModel,
  type DesiredStateActivityModel,
  type DesiredStateModelCopy,
  type DesiredStateSelectionModel
} from "./desired-state-model-types.js";

export function buildDesiredStateActionModel<Copy extends DesiredStateModelCopy>(
  args: Pick<
    BuildDesiredStateModelArgs<Copy>,
    | "copy"
    | "createComparisonDeltaItems"
    | "createComparisonRow"
    | "formatDnsRecordPreview"
    | "readBooleanPayloadValue"
    | "readObjectArrayPayloadValue"
    | "readStringArrayPayloadValue"
    | "readStringPayloadValue"
    | "summarizeComparisonRows"
  > & {
    activity: DesiredStateActivityModel;
    selections: DesiredStateSelectionModel;
  }
): DesiredStateActionModel {
  const {
    activity,
    copy,
    createComparisonDeltaItems,
    createComparisonRow,
    formatDnsRecordPreview,
    readBooleanPayloadValue,
    readObjectArrayPayloadValue,
    readStringArrayPayloadValue,
    readStringPayloadValue,
    selections,
    summarizeComparisonRows
  } = args;

  const selectedAppPlanItems = selections.selectedApp
    ? [
        {
          title: "dns.sync",
          meta: escapeHtml(
            [
              selections.selectedApp.zoneName,
              selections.selectedAppZone?.primaryNodeId ?? selections.selectedApp.primaryNodeId
            ].join(" · ")
          ),
          summary: escapeHtml(
            `Queues 1 dns.sync job for zone ${selections.selectedApp.zoneName} on ${
              selections.selectedAppZone?.primaryNodeId ?? selections.selectedApp.primaryNodeId
            }.`
          ),
          tone: "default" as const
        },
        {
          title: "proxy.render",
          meta: escapeHtml(
            selections.selectedApp.standbyNodeId
              ? `${selections.selectedApp.primaryNodeId} + ${selections.selectedApp.standbyNodeId}`
              : selections.selectedApp.primaryNodeId
          ),
          summary: escapeHtml(
            `Queues ${
              selections.selectedApp.standbyNodeId ? 2 : 1
            } proxy.render job(s) for ${selections.selectedApp.canonicalDomain}.`
          ),
          tone: "default" as const
        }
      ]
    : [];
  const selectedDatabasePlanItems = selections.selectedDatabase
    ? [
        {
          title:
            selections.selectedDatabase.engine === "postgresql"
              ? "postgres.reconcile"
              : "mariadb.reconcile",
          meta: `<span class="mono">${escapeHtml(selections.selectedDatabase.primaryNodeId)}</span>`,
          summary: escapeHtml(
            `Queues 1 reconcile job for ${selections.selectedDatabase.databaseName} using ${selections.selectedDatabase.engine}.`
          ),
          tone: "default" as const
        }
      ]
    : [];
  const selectedZonePlanItems = selections.selectedZone
    ? [
        {
          title: "dns.sync",
          meta: `<span class="mono">${escapeHtml(selections.selectedZone.primaryNodeId)}</span>`,
          summary: escapeHtml(
            `Queues 1 dns.sync job for ${selections.selectedZone.records.length} desired DNS record(s).`
          ),
          tone: "default" as const
        }
      ]
    : [];

  const zoneComparisonRows =
    selections.selectedZone && activity.selectedZoneLatestAppliedDnsJob
      ? [
          createComparisonRow(
            copy.zoneColZone,
            selections.selectedZone.zoneName,
            readStringPayloadValue(activity.selectedZoneLatestAppliedDnsJob.payload, "zoneName")
          ),
          createComparisonRow(
            copy.targetedNodesLabel,
            selections.selectedZone.primaryNodeId,
            activity.selectedZoneLatestAppliedDnsJob.nodeId
          ),
          createComparisonRow(
            copy.zoneColRecordCount,
            String(selections.selectedZone.records.length),
            String(
              readObjectArrayPayloadValue(activity.selectedZoneLatestAppliedDnsJob.payload, "records").length
            )
          ),
          createComparisonRow(
            copy.recordPreviewTitle,
            formatDnsRecordPreview(selections.selectedZone.records[0]) || copy.none,
            formatDnsRecordPreview(
              readObjectArrayPayloadValue(activity.selectedZoneLatestAppliedDnsJob.payload, "records")[0]
            ) || copy.none
          )
        ]
      : [];
  const appComparisonRows =
    selections.selectedApp && activity.selectedAppLatestAppliedProxyJob
      ? [
          createComparisonRow(
            copy.appColDomain,
            selections.selectedApp.canonicalDomain,
            readStringPayloadValue(activity.selectedAppLatestAppliedProxyJob.payload, "serverName")
          ),
          createComparisonRow(
            copy.aliasesLabel,
            String(selections.selectedApp.aliases.length),
            String(
              readStringArrayPayloadValue(activity.selectedAppLatestAppliedProxyJob.payload, "serverAliases")
                .length
            )
          ),
          createComparisonRow(
            copy.storageRootLabel,
            `${selections.selectedApp.storageRoot}/current/public`,
            readStringPayloadValue(activity.selectedAppLatestAppliedProxyJob.payload, "documentRoot")
          ),
          createComparisonRow(
            copy.targetedNodesLabel,
            selections.selectedApp.primaryNodeId,
            activity.selectedAppLatestAppliedProxyJob.nodeId
          ),
          createComparisonRow(
            copy.appColMode,
            "tls:on",
            readBooleanPayloadValue(activity.selectedAppLatestAppliedProxyJob.payload, "tls") === null
              ? null
              : readBooleanPayloadValue(activity.selectedAppLatestAppliedProxyJob.payload, "tls")
                ? "tls:on"
                : "tls:off"
          )
        ]
      : [];
  const databaseComparisonRows =
    selections.selectedDatabase && activity.selectedDatabaseLatestAppliedReconcileJob
      ? [
          createComparisonRow(
            copy.databaseColEngine,
            selections.selectedDatabase.engine,
            activity.selectedDatabaseLatestAppliedReconcileJob.kind === "postgres.reconcile"
              ? "postgresql"
              : "mariadb"
          ),
          createComparisonRow(
            copy.databaseColDatabase,
            selections.selectedDatabase.databaseName,
            readStringPayloadValue(
              activity.selectedDatabaseLatestAppliedReconcileJob.payload,
              "databaseName"
            )
          ),
          createComparisonRow(
            copy.databaseColUser,
            selections.selectedDatabase.databaseUser,
            readStringPayloadValue(activity.selectedDatabaseLatestAppliedReconcileJob.payload, "roleName") ??
              readStringPayloadValue(activity.selectedDatabaseLatestAppliedReconcileJob.payload, "userName")
          ),
          createComparisonRow(
            copy.targetedNodesLabel,
            selections.selectedDatabase.primaryNodeId,
            activity.selectedDatabaseLatestAppliedReconcileJob.nodeId
          )
        ]
      : [];

  const zoneDeltaPreviewItems = createComparisonDeltaItems(copy, zoneComparisonRows, 4);
  const appDeltaPreviewItems = createComparisonDeltaItems(copy, appComparisonRows, 4);
  const databaseDeltaPreviewItems = createComparisonDeltaItems(copy, databaseComparisonRows, 4);

  return {
    selectedAppPlanItems,
    selectedDatabasePlanItems,
    selectedZonePlanItems,
    zoneComparisonRows,
    appComparisonRows,
    databaseComparisonRows,
    selectedTenantActionPreviewItems: selections.selectedTenant
      ? [
          {
            title: "metadata.update",
            meta: escapeHtml(`${selections.selectedTenant.slug} · ${selections.selectedTenant.displayName}`),
            summary: escapeHtml(
              `${selections.selectedTenantApps.length} app(s), ${selections.selectedTenantZones.length} zone(s) and ${selections.selectedTenantBackupPolicies.length} backup polic(ies) remain attached to this tenant scope.`
            ),
            tone: "default" as const
          },
          {
            title: "tenant.delete",
            meta: escapeHtml("cascade"),
            summary: escapeHtml(
              `${selections.selectedTenantApps.length} app(s), ${selections.selectedTenantZones.length} zone(s) and ${selections.selectedTenantBackupPolicies.length} backup polic(ies) would be removed from desired state.`
            ),
            tone:
              selections.selectedTenantApps.length +
                selections.selectedTenantZones.length +
                selections.selectedTenantBackupPolicies.length >
              0
                ? "danger"
                : "default"
          }
        ]
      : [],
    selectedNodeActionPreviewItems: selections.selectedNode
      ? [
          {
            title: "node.update",
            meta: escapeHtml(`${selections.selectedNode.hostname} · ${selections.selectedNode.publicIpv4}`),
            summary: escapeHtml(
              `${selections.selectedNodePrimaryApps.length} app(s), ${selections.selectedNodePrimaryZones.length} zone(s) and ${selections.selectedNodeBackupPolicies.length} backup polic(ies) currently target this node.`
            ),
            tone: "default" as const
          },
          {
            title: "node.delete",
            meta: escapeHtml("topology risk"),
            summary: escapeHtml(
              `${activity.selectedNodeDesiredJobs.length} related job(s) and ${activity.selectedNodeDesiredAuditEvents.length} audit event(s) reference this node.`
            ),
            tone:
              selections.selectedNodePrimaryApps.length +
                selections.selectedNodePrimaryZones.length +
                selections.selectedNodeBackupPolicies.length >
              0
                ? "danger"
                : "default"
          }
        ]
      : [],
    selectedZoneActionPreviewItems: selections.selectedZone
      ? [
          {
            title: "dns.sync",
            meta: escapeHtml(
              `${selections.selectedZone.primaryNodeId} · ${selections.selectedZone.records.length} record(s)`
            ),
            summary: escapeHtml(
              activity.selectedZoneLatestAppliedDnsJob
                ? summarizeComparisonRows(copy, zoneComparisonRows)
                : "No successful dns.sync payload recorded yet for this zone."
            ),
            tone:
              activity.selectedZoneDrift?.dispatchRecommended ||
              zoneComparisonRows.some((row) => row.state === "changed")
                ? "danger"
                : "default"
          },
          {
            title: "zone.delete",
            meta: escapeHtml(`${selections.selectedZoneApps.length} app(s)`),
            summary: escapeHtml(
              `${selections.selectedZoneBackupPolicies.length} backup polic(ies) and ${selectedZonePlanItems.length} queued work item(s) currently relate to this zone.`
            ),
            tone:
              selections.selectedZoneApps.length + selections.selectedZoneBackupPolicies.length > 0
                ? "danger"
                : "default"
          },
          ...zoneDeltaPreviewItems
        ]
      : [],
    selectedAppActionPreviewItems: selections.selectedApp
      ? [
          {
            title: "proxy.render",
            meta: escapeHtml(
              selections.selectedApp.standbyNodeId
                ? `${selections.selectedApp.primaryNodeId} -> ${selections.selectedApp.standbyNodeId}`
                : selections.selectedApp.primaryNodeId
            ),
            summary: escapeHtml(
              activity.selectedAppLatestAppliedProxyJob
                ? summarizeComparisonRows(copy, appComparisonRows)
                : "No successful proxy.render payload recorded yet for this app."
            ),
            tone:
              activity.selectedAppProxyDrifts.some((entry) => entry.dispatchRecommended) ||
              appComparisonRows.some((row) => row.state === "changed")
                ? "danger"
                : "default"
          },
          {
            title: "app.reconcile",
            meta: escapeHtml(
              `${selections.selectedAppDatabases.length} database(s) · ${selections.selectedApp.aliases.length} alias(es)`
            ),
            summary: escapeHtml(
              `${selectedAppPlanItems.length} queued work item(s) and ${selections.selectedAppBackupPolicies.length} backup polic(ies) are currently linked to this app.`
            ),
            tone: "default" as const
          },
          {
            title: "app.delete",
            meta: escapeHtml(selections.selectedApp.canonicalDomain),
            summary: escapeHtml(
              `${selections.selectedAppDatabases.length} database definition(s) would need follow-up review and ${selections.selectedApp.aliases.length} alias(es) would disappear from proxy planning.`
            ),
            tone:
              selections.selectedAppDatabases.length + selections.selectedApp.aliases.length > 0
                ? "danger"
                : "default"
          },
          ...appDeltaPreviewItems
        ]
      : [],
    selectedDatabaseActionPreviewItems: selections.selectedDatabase
      ? [
          {
            title: `${selections.selectedDatabase.engine}.reconcile`,
            meta: escapeHtml(selections.selectedDatabase.primaryNodeId),
            summary: escapeHtml(
              activity.selectedDatabaseLatestAppliedReconcileJob
                ? summarizeComparisonRows(copy, databaseComparisonRows)
                : "No successful database reconcile payload recorded yet for this resource."
            ),
            tone:
              activity.selectedDatabaseDrift?.dispatchRecommended ||
              databaseComparisonRows.some((row) => row.state === "changed")
                ? "danger"
                : "default"
          },
          {
            title: "database.delete",
            meta: escapeHtml(selections.selectedDatabase.databaseName),
            summary: escapeHtml(
              `${selections.selectedDatabaseBackupPolicies.length} backup polic(ies) and ${selectedDatabasePlanItems.length} queued work item(s) currently reference this database resource.`
            ),
            tone:
              selections.selectedDatabaseBackupPolicies.length + selectedDatabasePlanItems.length > 0
                ? "danger"
                : "default"
          },
          ...databaseDeltaPreviewItems
        ]
      : [],
    selectedBackupActionPreviewItems: selections.selectedBackupPolicy
      ? [
          {
            title: "policy.update",
            meta: escapeHtml(
              `${selections.selectedBackupPolicy.targetNodeId} · ${selections.selectedBackupPolicy.schedule}`
            ),
            summary: escapeHtml(
              `${selections.selectedBackupTenantApps.length} app(s), ${selections.selectedBackupTenantZones.length} zone(s) and ${selections.selectedBackupTenantDatabases.length} database(s) fall under this policy scope.`
            ),
            tone: "default" as const
          },
          {
            title: "policy.delete",
            meta: escapeHtml(`${selections.selectedBackupRuns.length} recorded run(s)`),
            summary: escapeHtml(
              `${selections.selectedBackupTenantApps.length} app(s), ${selections.selectedBackupTenantZones.length} zone(s) and ${selections.selectedBackupTenantDatabases.length} database(s) would lose tracked coverage from this policy.`
            ),
            tone:
              selections.selectedBackupTenantApps.length +
                selections.selectedBackupTenantZones.length +
                selections.selectedBackupTenantDatabases.length >
              0
                ? "danger"
                : "default"
          },
          {
            title: "coverage.apps",
            meta: escapeHtml(`${selections.selectedBackupTenantApps.length} app(s)`),
            summary: escapeHtml(
              selections.selectedBackupTenantApps
                .slice(0, 3)
                .map((app) => `${app.slug} · ${app.primaryNodeId}`)
                .join(" · ") || copy.none
            ),
            tone: selections.selectedBackupTenantApps.length > 0 ? "success" : "default"
          },
          {
            title: "coverage.databases",
            meta: escapeHtml(`${selections.selectedBackupTenantDatabases.length} database(s)`),
            summary: escapeHtml(
              selections.selectedBackupTenantDatabases
                .slice(0, 3)
                .map((database) => `${database.databaseName} · ${database.engine}`)
                .join(" · ") || copy.none
            ),
            tone: selections.selectedBackupTenantDatabases.length > 0 ? "success" : "default"
          },
          {
            title: "coverage.zones",
            meta: escapeHtml(`${selections.selectedBackupTenantZones.length} zone(s)`),
            summary: escapeHtml(
              selections.selectedBackupTenantZones
                .slice(0, 3)
                .map((zone) => `${zone.zoneName} · ${zone.primaryNodeId}`)
                .join(" · ") || copy.none
            ),
            tone: selections.selectedBackupTenantZones.length > 0 ? "success" : "default"
          }
        ]
      : []
  };
}
