import { type DashboardData } from "./api-client.js";
import {
  groupItemsBy,
  summarizeGroupStatuses
} from "./dashboard-utils.js";
import {
  buildActiveJobFilterItems,
  renderJobHistoryFilterForm
} from "./dashboard-jobs-filters.js";
import {
  renderJobWorkspaceSidePanels,
  renderSelectedJobPanel
} from "./dashboard-jobs-panels.js";
import { buildJobHistoryRows, renderJobHistoryTable } from "./dashboard-jobs-table.js";
import { type JobHistoryWorkspaceArgs, type JobsCopy } from "./dashboard-jobs-types.js";

export function renderJobHistoryWorkspace<Copy extends JobsCopy>(
  args: JobHistoryWorkspaceArgs<Copy>
): string {
  const {
    copy,
    data,
    locale,
    filteredJobHistory,
    filteredAuditEvents,
    selectedJob,
    currentJobFilters,
    jobStatusFilter,
    jobKindFilter,
    jobNodeFilter,
    jobResourceFilter,
    auditTypeFilter,
    auditActorFilter,
    auditEntityFilter,
    formatDate,
    findRelatedJobs,
    payloadContainsValue,
    resolveResourceKeyTarget,
    renderActionFacts,
    renderActiveFiltersPanel,
    renderAuditPanel,
    renderCodeBlock,
    renderDataTable,
    renderDetailGrid,
    renderJobFeedPanel,
    renderPill,
    renderRelatedPanel,
    renderSignalStrip,
    renderWorkspaceFilterForm
  } = args;

  const jobRows = buildJobHistoryRows({
    copy,
    currentJobFilters,
    filteredJobHistory,
    formatDate,
    locale,
    renderFocusLink: args.renderFocusLink,
    renderPill,
    selectedJob
  });

  const queuedJobCount = filteredJobHistory.filter((job) => !job.status).length;
  const appliedJobCount = filteredJobHistory.filter((job) => job.status === "applied").length;
  const failedJobCount = filteredJobHistory.filter((job) => job.status === "failed").length;
  const dnsSyncJobCount = filteredJobHistory.filter((job) => job.kind === "dns.sync").length;
  const proxyRenderJobCount = filteredJobHistory.filter((job) => job.kind === "proxy.render").length;
  const databaseReconcileJobCount = filteredJobHistory.filter(
    (job) => job.kind === "postgres.reconcile" || job.kind === "mariadb.reconcile"
  ).length;
  const backupTriggerJobCount = filteredJobHistory.filter((job) => job.kind === "backup.trigger").length;

  const selectedJobAuditEvents = selectedJob
    ? data.auditEvents
        .filter(
          (event) =>
            event.entityId === selectedJob.jobId ||
            payloadContainsValue(event.payload, selectedJob.jobId) ||
            (selectedJob.resourceKey
              ? payloadContainsValue(event.payload, selectedJob.resourceKey)
              : false)
        )
        .slice(0, 8)
    : [];
  const selectedJobRelatedJobs = selectedJob
    ? findRelatedJobs(
        data.jobHistory,
        {
          resourceKeys: [selectedJob.resourceKey ?? "", selectedJob.jobId],
          nodeId: selectedJob.nodeId,
          needles: [selectedJob.resourceKey ?? "", selectedJob.nodeId]
        },
        8
      ).filter((job) => job.jobId !== selectedJob.jobId)
    : [];
  const selectedJobResourceTarget = selectedJob?.resourceKey
    ? resolveResourceKeyTarget(selectedJob.resourceKey)
    : {};

  const failedJobFocus = filteredJobHistory.filter((job) => job.status === "failed").slice(0, 6);
  const jobNodeGroups = groupItemsBy(filteredJobHistory, (job) => job.nodeId).slice(0, 6);
  const jobKindGroups = groupItemsBy(filteredJobHistory, (job) => job.kind).slice(0, 6);
  const jobStatusGroups = groupItemsBy(filteredJobHistory, (job) => job.status ?? "queued").slice(0, 4);
  const jobResourceGroups = groupItemsBy(
    filteredJobHistory.filter((job) => Boolean(job.resourceKey)),
    (job) => job.resourceKey ?? "unscoped"
  ).slice(0, 6);
  const auditEventGroups = groupItemsBy(filteredAuditEvents, (event) => event.eventType).slice(0, 6);
  const auditActorGroups = groupItemsBy(
    filteredAuditEvents,
    (event) => `${event.actorType}:${event.actorId ?? "unknown"}`
  ).slice(0, 6);
  const auditEntityGroups = groupItemsBy(
    filteredAuditEvents.filter((event) => Boolean(event.entityType || event.entityId)),
    (event) =>
      event.entityType && event.entityId
        ? `${event.entityType}:${event.entityId}`
        : event.entityType ?? event.entityId ?? "unknown"
  ).slice(0, 6);

  const activeJobFilterItems = buildActiveJobFilterItems({
    auditActorFilter,
    auditEntityFilter,
    auditTypeFilter,
    copy,
    jobKindFilter,
    jobNodeFilter,
    jobResourceFilter,
    jobStatusFilter
  });
  const jobFilterForm = renderJobHistoryFilterForm({
    auditActorFilter,
    auditEntityFilter,
    auditTypeFilter,
    copy,
    data,
    jobKindFilter,
    jobNodeFilter,
    jobResourceFilter,
    jobStatusFilter,
    renderWorkspaceFilterForm
  });
  const selectedJobPanel = renderSelectedJobPanel({
    copy,
    currentJobFilters,
    data,
    formatDate,
    locale,
    renderActionFacts,
    renderCodeBlock,
    renderDetailGrid,
    renderPill,
    renderRelatedPanel,
    selectedJob,
    selectedJobAuditEvents,
    selectedJobRelatedJobs,
    selectedJobResourceTarget
  });
  const sidePanels = renderJobWorkspaceSidePanels({
    activeJobFilterItems,
    auditActorGroups,
    auditEntityGroups,
    auditEventGroups,
    copy,
    currentJobFilters,
    data,
    failedJobFocus,
    formatDate,
    jobKindGroups,
    jobNodeGroups,
    jobResourceGroups,
    jobStatusGroups,
    locale,
    renderActiveFiltersPanel,
    renderAuditPanel,
    renderJobFeedPanel,
    renderRelatedPanel,
    selectedJobAuditEvents,
    selectedJobRelatedJobs
  });
  const jobHistoryTable = renderJobHistoryTable({
    copy,
    jobRows,
    renderDataTable
  });

  return `<section id="section-job-history" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.recentQueuedJobs, value: String(queuedJobCount), tone: queuedJobCount > 0 ? "muted" : "success" },
      { label: copy.recentAppliedJobs, value: String(appliedJobCount), tone: appliedJobCount > 0 ? "success" : "muted" },
      { label: copy.recentFailedJobs, value: String(failedJobCount), tone: failedJobCount > 0 ? "danger" : "success" },
      { label: "dns.sync", value: String(dnsSyncJobCount), tone: dnsSyncJobCount > 0 ? "muted" : "success" },
      { label: "proxy.render", value: String(proxyRenderJobCount), tone: proxyRenderJobCount > 0 ? "muted" : "success" },
      { label: "db reconcile", value: String(databaseReconcileJobCount), tone: databaseReconcileJobCount > 0 ? "muted" : "success" },
      { label: "backup.trigger", value: String(backupTriggerJobCount), tone: backupTriggerJobCount > 0 ? "muted" : "success" }
    ])}
    ${jobFilterForm}
    ${jobHistoryTable}
    <div class="grid-two-desktop">
      ${selectedJobPanel}
      <div class="stack">${sidePanels}</div>
    </div>
  </section>`;
}
