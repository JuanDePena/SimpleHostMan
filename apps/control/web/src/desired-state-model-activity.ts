import {
  type BuildDesiredStateModelArgs,
  type DesiredStateActivityModel,
  type DesiredStateModelCopy,
  type DesiredStateSelectionModel
} from "./desired-state-model-types.js";

export function buildDesiredStateActivityModel<Copy extends DesiredStateModelCopy>(
  args: Pick<
    BuildDesiredStateModelArgs<Copy>,
    "data" | "findLatestJobWithStatus" | "findRelatedAuditEvents" | "findRelatedJobs"
  > & {
    selections: DesiredStateSelectionModel;
  }
): DesiredStateActivityModel {
  const { data, findLatestJobWithStatus, findRelatedAuditEvents, findRelatedJobs, selections } = args;
  const { selectedApp, selectedBackupPolicy, selectedDatabase, selectedNode, selectedZone } =
    selections;

  const selectedTenantJobs = selections.selectedTenant
    ? findRelatedJobs(data.jobHistory, { needles: [selections.selectedTenant.slug] }, 5)
    : [];
  const selectedTenantAuditEvents = selections.selectedTenant
    ? findRelatedAuditEvents(data.auditEvents, [selections.selectedTenant.slug], 6)
    : [];
  const selectedNodeDesiredJobs = selectedNode
    ? findRelatedJobs(
        data.jobHistory,
        {
          nodeId: selectedNode.nodeId,
          needles: [selectedNode.nodeId, selectedNode.hostname]
        },
        6
      )
    : [];
  const selectedNodeDesiredAuditEvents = selectedNode
    ? findRelatedAuditEvents(data.auditEvents, [selectedNode.nodeId, selectedNode.hostname], 6)
    : [];
  const selectedNodeDesiredDrift = selectedNode
    ? data.drift.filter((entry) => entry.nodeId === selectedNode.nodeId)
    : [];
  const selectedZoneJobs = selectedZone
    ? findRelatedJobs(
        data.jobHistory,
        {
          resourceKeys: [`zone:${selectedZone.zoneName}`],
          needles: [selectedZone.zoneName, selectedZone.primaryNodeId]
        },
        6
      )
    : [];
  const selectedZoneAuditEvents = selectedZone
    ? findRelatedAuditEvents(
        data.auditEvents,
        [selectedZone.zoneName, selectedZone.tenantSlug, selectedZone.primaryNodeId],
        6
      )
    : [];
  const selectedAppJobs = selectedApp
    ? findRelatedJobs(
        data.jobHistory,
        {
          resourcePrefixes: [`app:${selectedApp.slug}:`],
          resourceKeys: [`zone:${selectedApp.zoneName}`],
          needles: [
            selectedApp.slug,
            selectedApp.zoneName,
            selectedApp.canonicalDomain,
            selectedApp.primaryNodeId,
            selectedApp.standbyNodeId ?? ""
          ]
        },
        6
      )
    : [];
  const selectedAppAuditEvents = selectedApp
    ? findRelatedAuditEvents(
        data.auditEvents,
        [
          selectedApp.slug,
          selectedApp.zoneName,
          selectedApp.canonicalDomain,
          selectedApp.primaryNodeId,
          selectedApp.standbyNodeId ?? ""
        ],
        6
      )
    : [];
  const selectedDatabaseJobs = selectedDatabase
    ? findRelatedJobs(
        data.jobHistory,
        {
          resourceKeys: [`database:${selectedDatabase.appSlug}`],
          needles: [
            selectedDatabase.appSlug,
            selectedDatabase.databaseName,
            selectedDatabase.databaseUser,
            selectedDatabase.primaryNodeId,
            selectedDatabase.standbyNodeId ?? ""
          ]
        },
        6
      )
    : [];
  const selectedDatabaseAuditEvents = selectedDatabase
    ? findRelatedAuditEvents(
        data.auditEvents,
        [
          selectedDatabase.appSlug,
          selectedDatabase.databaseName,
          selectedDatabase.databaseUser,
          selectedDatabase.primaryNodeId,
          selectedDatabase.standbyNodeId ?? ""
        ],
        6
      )
    : [];
  const selectedBackupRun = selectedBackupPolicy
    ? data.backups.latestRuns.find((run) => run.policySlug === selectedBackupPolicy.policySlug)
    : undefined;
  const selectedBackupAuditEvents = selectedBackupPolicy
    ? findRelatedAuditEvents(
        data.auditEvents,
        [
          selectedBackupPolicy.policySlug,
          selectedBackupPolicy.targetNodeId,
          selectedBackupPolicy.storageLocation,
          selectedBackupRun?.runId ?? ""
        ],
        6
      )
    : [];

  const selectedZoneDrift = selectedZone
    ? data.drift.find((entry) => entry.resourceKey === `zone:${selectedZone.zoneName}`)
    : undefined;
  const selectedAppProxyDrifts = selectedApp
    ? data.drift.filter((entry) => entry.resourceKey.startsWith(`app:${selectedApp.slug}:proxy:`))
    : [];
  const selectedDatabaseDrift = selectedDatabase
    ? data.drift.find((entry) => entry.resourceKey === `database:${selectedDatabase.appSlug}`)
    : undefined;

  const selectedZoneLatestAppliedDnsJob = selectedZoneJobs.find(
    (job) => job.kind === "dns.sync" && job.status === "applied"
  );
  const selectedAppLatestAppliedProxyJob = selectedAppJobs.find(
    (job) =>
      job.kind === "proxy.render" &&
      job.status === "applied" &&
      job.nodeId === selectedApp?.primaryNodeId
  );
  const selectedDatabaseLatestAppliedReconcileJob = selectedDatabaseJobs.find(
    (job) =>
      (job.kind === "postgres.reconcile" || job.kind === "mariadb.reconcile") &&
      job.status === "applied"
  );

  return {
    selectedTenantJobs,
    selectedTenantAuditEvents,
    selectedNodeDesiredJobs,
    selectedNodeDesiredAuditEvents,
    selectedNodeDesiredDrift,
    selectedZoneJobs,
    selectedZoneAuditEvents,
    selectedAppJobs,
    selectedAppAuditEvents,
    selectedDatabaseJobs,
    selectedDatabaseAuditEvents,
    selectedBackupRun,
    selectedBackupAuditEvents,
    selectedTenantLatestFailure: findLatestJobWithStatus(selectedTenantJobs, "failed"),
    selectedTenantLatestSuccess: findLatestJobWithStatus(selectedTenantJobs, "applied"),
    selectedNodeLatestFailure: findLatestJobWithStatus(selectedNodeDesiredJobs, "failed"),
    selectedNodeLatestSuccess: findLatestJobWithStatus(selectedNodeDesiredJobs, "applied"),
    selectedZoneLatestFailure: findLatestJobWithStatus(selectedZoneJobs, "failed"),
    selectedZoneLatestSuccess: findLatestJobWithStatus(selectedZoneJobs, "applied"),
    selectedAppLatestFailure: findLatestJobWithStatus(selectedAppJobs, "failed"),
    selectedAppLatestSuccess: findLatestJobWithStatus(selectedAppJobs, "applied"),
    selectedDatabaseLatestFailure: findLatestJobWithStatus(selectedDatabaseJobs, "failed"),
    selectedDatabaseLatestSuccess: findLatestJobWithStatus(selectedDatabaseJobs, "applied"),
    selectedBackupLatestFailureRun: selections.selectedBackupRuns.find((run) => run.status === "failed"),
    selectedBackupLatestSuccessRun: selections.selectedBackupRuns.find((run) => run.status === "succeeded"),
    selectedNodeHealthSnapshot: selectedNode
      ? data.nodeHealth.find((entry) => entry.nodeId === selectedNode.nodeId)
      : undefined,
    selectedBackupTargetHealth: selectedBackupPolicy
      ? data.nodeHealth.find((entry) => entry.nodeId === selectedBackupPolicy.targetNodeId)
      : undefined,
    selectedZonePrimaryNodeHealth: selectedZone
      ? data.nodeHealth.find((entry) => entry.nodeId === selectedZone.primaryNodeId)
      : undefined,
    selectedAppPrimaryNodeHealth: selectedApp
      ? data.nodeHealth.find((entry) => entry.nodeId === selectedApp.primaryNodeId)
      : undefined,
    selectedDatabasePrimaryNodeHealth: selectedDatabase
      ? data.nodeHealth.find((entry) => entry.nodeId === selectedDatabase.primaryNodeId)
      : undefined,
    selectedZoneDrift,
    selectedAppProxyDrifts,
    selectedDatabaseDrift,
    selectedZoneLatestAppliedDnsJob,
    selectedAppLatestAppliedProxyJob,
    selectedDatabaseLatestAppliedReconcileJob
  };
}
