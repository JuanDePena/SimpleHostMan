import { type DashboardData } from "./api-client.js";
import { renderJobHistoryFilterForm } from "./dashboard-jobs-filters.js";
import { renderSelectedJobPanel } from "./dashboard-jobs-panels.js";
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
    resolveResourceKeyTarget,
    renderCodeBlock,
    renderDataTable,
    renderDetailGrid,
    renderPill,
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

  const selectedJobResourceTarget = selectedJob?.resourceKey
    ? resolveResourceKeyTarget(selectedJob.resourceKey)
    : {};
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
    formatDate,
    locale,
    renderCodeBlock,
    renderDetailGrid,
    renderPill,
    selectedJob,
    selectedJobResourceTarget
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
    ${selectedJobPanel}
  </section>`;
}
