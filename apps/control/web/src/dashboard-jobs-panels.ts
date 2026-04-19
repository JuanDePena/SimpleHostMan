import { escapeHtml } from "@simplehost/ui";

import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { summarizeGroupStatuses } from "./dashboard-utils.js";
import { type JobHistoryWorkspaceArgs, type JobsCopy } from "./dashboard-jobs-types.js";

type Group<T> = {
  key: string;
  items: T[];
};

export function renderSelectedJobPanel<Copy extends JobsCopy>(
  args: Pick<
    JobHistoryWorkspaceArgs<Copy>,
    | "copy"
    | "currentJobFilters"
    | "data"
    | "formatDate"
    | "locale"
    | "renderActionFacts"
    | "renderCodeBlock"
    | "renderDetailGrid"
    | "renderPill"
    | "renderRelatedPanel"
    | "selectedJob"
  > & {
    selectedJobAuditEvents: JobHistoryWorkspaceArgs<Copy>["data"]["auditEvents"];
    selectedJobRelatedJobs: JobHistoryWorkspaceArgs<Copy>["data"]["jobHistory"];
    selectedJobResourceTarget: {
      desiredStateHref?: string;
      driftHref?: string;
    };
  }
): string {
  const {
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
  } = args;

  if (!selectedJob) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noJobs)}</p></article>`;
  }

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.payloadTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.jobHistoryDescription)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedJob.nodeId)
      )}">${escapeHtml(copy.nodeColNode)}</a>
    </div>
    ${renderDetailGrid([
      { label: copy.jobColJob, value: `<span class="mono">${escapeHtml(selectedJob.jobId)}</span>` },
      { label: copy.jobColKind, value: escapeHtml(selectedJob.kind) },
      {
        label: copy.jobColNode,
        value: `<a class="detail-link mono" href="${escapeHtml(
          buildDashboardViewUrl("node-health", undefined, selectedJob.nodeId)
        )}">${escapeHtml(selectedJob.nodeId)}</a>`
      },
      {
        label: copy.jobColStatus,
        value: selectedJob.status
          ? renderPill(
              selectedJob.status,
              selectedJob.status === "applied"
                ? "success"
                : selectedJob.status === "failed"
                  ? "danger"
                  : "muted"
            )
          : renderPill("queued", "muted")
      },
      { label: copy.jobColReason, value: escapeHtml(selectedJob.dispatchReason ?? "-") },
      { label: copy.jobColCreated, value: escapeHtml(formatDate(selectedJob.createdAt, locale)) },
      {
        label: copy.linkedResource,
        value: selectedJob.resourceKey
          ? `<span class="mono">${escapeHtml(selectedJob.resourceKey)}</span>`
          : escapeHtml(copy.none)
      },
      {
        label: copy.latestCompleted,
        value: escapeHtml(
          selectedJob.completedAt ? formatDate(selectedJob.completedAt, locale) : copy.none
        )
      }
    ])}
    <div class="grid grid-two">
      <article class="panel detail-shell panel-nested">
        <h4>${escapeHtml(copy.payloadTitle)}</h4>
        ${renderCodeBlock(selectedJob.payload)}
      </article>
      <article class="panel detail-shell panel-nested">
        <h4>${escapeHtml(copy.linkedOperationsTitle)}</h4>
        ${renderActionFacts([
          {
            label: copy.openDesiredState,
            value: selectedJobResourceTarget.desiredStateHref
              ? `<a class="detail-link" href="${escapeHtml(
                  selectedJobResourceTarget.desiredStateHref
                )}">${escapeHtml(copy.openDesiredState)}</a>`
              : escapeHtml(copy.none)
          },
          {
            label: copy.openDriftView,
            value: selectedJobResourceTarget.driftHref
              ? `<a class="detail-link" href="${escapeHtml(
                  selectedJobResourceTarget.driftHref
                )}">${escapeHtml(copy.openDriftView)}</a>`
              : escapeHtml(copy.none)
          },
          {
            label: copy.filterStatusLabel,
            value: `<a class="detail-link" href="${escapeHtml(
              buildDashboardViewUrl("job-history", undefined, undefined, {
                ...currentJobFilters,
                jobStatus: selectedJob.status ?? "queued"
              })
            )}">${escapeHtml(selectedJob.status ?? "queued")}</a>`
          },
          {
            label: copy.filterKindLabel,
            value: `<a class="detail-link" href="${escapeHtml(
              buildDashboardViewUrl("job-history", undefined, undefined, {
                ...currentJobFilters,
                jobKind: selectedJob.kind
              })
            )}">${escapeHtml(selectedJob.kind)}</a>`
          },
          {
            label: copy.filterNodeLabel,
            value: `<a class="detail-link mono" href="${escapeHtml(
              buildDashboardViewUrl("job-history", undefined, undefined, {
                ...currentJobFilters,
                jobNode: selectedJob.nodeId
              })
            )}">${escapeHtml(selectedJob.nodeId)}</a>`
          },
          {
            label: copy.filterResourceLabel,
            value: selectedJob.resourceKey
              ? `<a class="detail-link mono" href="${escapeHtml(
                  buildDashboardViewUrl("job-history", undefined, undefined, {
                    ...currentJobFilters,
                    jobResource: selectedJob.resourceKey
                  })
                )}">${escapeHtml(selectedJob.resourceKey)}</a>`
              : escapeHtml(copy.none)
          },
          {
            label: copy.jobColSummary,
            value: escapeHtml(selectedJob.summary ?? "-")
          },
          {
            label: copy.openNodeHealth,
            value: `<a class="detail-link" href="${escapeHtml(
              buildDashboardViewUrl("node-health", undefined, selectedJob.nodeId)
            )}">${escapeHtml(copy.openNodeHealth)}</a>`
          }
        ])}
        ${
          selectedJob.details
            ? renderCodeBlock(selectedJob.details)
            : `<p class="muted">${escapeHtml(copy.none)}</p>`
        }
      </article>
    </div>
    ${renderRelatedPanel(
      copy.effectiveStateTitle,
      copy.effectiveStateDescription,
      [
        {
          title: escapeHtml(copy.linkedResource),
          meta: escapeHtml(selectedJob.resourceKey ?? copy.none),
          summary: escapeHtml(selectedJob.summary ?? selectedJob.dispatchReason ?? copy.none),
          tone:
            selectedJob.status === "failed"
              ? ("danger" as const)
              : selectedJob.status === "applied"
                ? ("success" as const)
                : ("default" as const)
        },
        {
          title: escapeHtml(copy.linkedOperationsTitle),
          meta: escapeHtml(`${selectedJobRelatedJobs.length} job(s)`),
          summary: escapeHtml(
            selectedJobRelatedJobs[0]?.summary ??
              selectedJobRelatedJobs[0]?.dispatchReason ??
              copy.none
          ),
          tone: selectedJobRelatedJobs.some((job) => job.status === "failed")
            ? ("danger" as const)
            : selectedJobRelatedJobs.some((job) => job.status === "applied")
              ? ("success" as const)
              : ("default" as const)
        },
        {
          title: escapeHtml(copy.auditTrailTitle),
          meta: escapeHtml(`${selectedJobAuditEvents.length} event(s)`),
          summary: escapeHtml(selectedJobAuditEvents[0]?.eventType ?? copy.none),
          tone: "default" as const
        }
      ],
      copy.noRelatedRecords
    )}
  </article>`;
}

export function renderJobWorkspaceSidePanels<Copy extends JobsCopy>(
  args: Pick<
    JobHistoryWorkspaceArgs<Copy>,
    | "copy"
    | "currentJobFilters"
    | "data"
    | "formatDate"
    | "locale"
    | "renderActiveFiltersPanel"
    | "renderAuditPanel"
    | "renderJobFeedPanel"
    | "renderRelatedPanel"
  > & {
    activeJobFilterItems: Array<{ label: string; value: string }>;
    auditActorGroups: Array<Group<JobHistoryWorkspaceArgs<Copy>["data"]["auditEvents"][number]>>;
    auditEntityGroups: Array<Group<JobHistoryWorkspaceArgs<Copy>["data"]["auditEvents"][number]>>;
    auditEventGroups: Array<Group<JobHistoryWorkspaceArgs<Copy>["data"]["auditEvents"][number]>>;
    failedJobFocus: JobHistoryWorkspaceArgs<Copy>["data"]["jobHistory"];
    jobKindGroups: Array<Group<JobHistoryWorkspaceArgs<Copy>["data"]["jobHistory"][number]>>;
    jobNodeGroups: Array<Group<JobHistoryWorkspaceArgs<Copy>["data"]["jobHistory"][number]>>;
    jobResourceGroups: Array<Group<JobHistoryWorkspaceArgs<Copy>["data"]["jobHistory"][number]>>;
    jobStatusGroups: Array<Group<JobHistoryWorkspaceArgs<Copy>["data"]["jobHistory"][number]>>;
    selectedJobAuditEvents: JobHistoryWorkspaceArgs<Copy>["data"]["auditEvents"];
    selectedJobRelatedJobs: JobHistoryWorkspaceArgs<Copy>["data"]["jobHistory"];
  }
): string {
  const {
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
  } = args;

  const failureFocusPanel = renderRelatedPanel(
    copy.failureFocusTitle,
    copy.failureFocusDescription,
    failedJobFocus.map((job) => ({
      title: `<a class="detail-link" href="${escapeHtml(
        buildDashboardViewUrl("job-history", undefined, job.jobId)
      )}">${escapeHtml(job.kind)}</a>`,
      meta: escapeHtml([job.jobId, job.nodeId, formatDate(job.createdAt, locale)].join(" · ")),
      summary: escapeHtml(job.summary ?? job.dispatchReason ?? "-"),
      tone: "danger" as const
    })),
    copy.noJobs
  );

  const auditSignalsPanel = renderRelatedPanel(
    copy.auditSignalsTitle,
    copy.auditSignalsDescription,
    auditEventGroups.map((group) => ({
      title: `<a class="detail-link" href="${escapeHtml(
        buildDashboardViewUrl("job-history", undefined, undefined, {
          ...currentJobFilters,
          auditType: group.key
        })
      )}">${escapeHtml(group.key)}</a>`,
      meta: escapeHtml(`${group.items.length} event(s)`),
      summary: escapeHtml(
        group.items
          .slice(0, 2)
          .map((event) => event.entityType ?? event.entityId ?? copy.none)
          .join(" · ")
      ),
      tone: "default" as const
    })),
    copy.noRelatedRecords
  );

  const auditActorsPanel = renderRelatedPanel(
    copy.auditActorsTitle,
    copy.auditActorsDescription,
    auditActorGroups.map((group) => ({
      title: `<a class="detail-link" href="${escapeHtml(
        buildDashboardViewUrl("job-history", undefined, undefined, {
          ...currentJobFilters,
          auditActor: group.key
        })
      )}">${escapeHtml(group.key)}</a>`,
      meta: escapeHtml(`${group.items.length} event(s)`),
      summary: escapeHtml(
        group.items
          .slice(0, 2)
          .map((event) => event.entityType ?? event.entityId ?? copy.none)
          .join(" · ")
      ),
      tone: "default" as const
    })),
    copy.noRelatedRecords
  );

  const auditEntitiesPanel = renderRelatedPanel(
    copy.auditEntitiesTitle,
    copy.auditEntitiesDescription,
    auditEntityGroups.map((group) => ({
      title: `<a class="detail-link" href="${escapeHtml(
        buildDashboardViewUrl("job-history", undefined, undefined, {
          ...currentJobFilters,
          auditEntity: group.key
        })
      )}">${escapeHtml(group.key)}</a>`,
      meta: escapeHtml(`${group.items.length} event(s)`),
      summary: escapeHtml(group.items.slice(0, 2).map((event) => event.eventType).join(" · ")),
      tone: "default" as const
    })),
    copy.noRelatedRecords
  );

  const jobNodesPanel = renderRelatedPanel(
    copy.jobNodesTitle,
    copy.jobNodesDescription,
    jobNodeGroups.map((group) => ({
      title: `<a class="detail-link mono" href="${escapeHtml(
        buildDashboardViewUrl("job-history", undefined, undefined, {
          ...currentJobFilters,
          jobNode: group.key
        })
      )}">${escapeHtml(group.key)}</a>`,
      meta: escapeHtml(`${group.items.length} job(s)`),
      summary: escapeHtml(summarizeGroupStatuses(group.items)),
      tone: group.items.some((job) => job.status === "failed")
        ? ("danger" as const)
        : group.items.some((job) => job.status === "applied")
          ? ("success" as const)
          : ("default" as const)
    })),
    copy.noJobs
  );

  const jobKindsPanel = renderRelatedPanel(
    copy.jobKindsTitle,
    copy.jobKindsDescription,
    jobKindGroups.map((group) => ({
      title: `<a class="detail-link" href="${escapeHtml(
        buildDashboardViewUrl("job-history", undefined, undefined, {
          ...currentJobFilters,
          jobKind: group.key
        })
      )}">${escapeHtml(group.key)}</a>`,
      meta: escapeHtml(`${group.items.length} job(s)`),
      summary: escapeHtml(summarizeGroupStatuses(group.items)),
      tone: group.items.some((job) => job.status === "failed")
        ? ("danger" as const)
        : group.items.some((job) => job.status === "applied")
          ? ("success" as const)
          : ("default" as const)
    })),
    copy.noJobs
  );

  const jobStatusesPanel = renderRelatedPanel(
    copy.jobStatusesTitle,
    copy.jobStatusesDescription,
    jobStatusGroups.map((group) => ({
      title: `<a class="detail-link" href="${escapeHtml(
        buildDashboardViewUrl("job-history", undefined, undefined, {
          ...currentJobFilters,
          jobStatus: group.key
        })
      )}">${escapeHtml(group.key)}</a>`,
      meta: escapeHtml(`${group.items.length} job(s)`),
      summary: escapeHtml(
        group.items
          .slice(0, 2)
          .map((job) => `${job.kind} · ${job.nodeId}`)
          .join(" · ")
      ),
      tone:
        group.key === "failed"
          ? ("danger" as const)
          : group.key === "applied"
            ? ("success" as const)
            : ("default" as const)
    })),
    copy.noJobs
  );

  const jobResourceHotspotsPanel = renderRelatedPanel(
    copy.jobResourceHotspotsTitle,
    copy.jobResourceHotspotsDescription,
    jobResourceGroups.map((group) => ({
      title: `<a class="detail-link mono" href="${escapeHtml(
        buildDashboardViewUrl("job-history", undefined, undefined, {
          ...currentJobFilters,
          jobResource: group.key
        })
      )}">${escapeHtml(group.key)}</a>`,
      meta: escapeHtml(`${group.items.length} job(s)`),
      summary: escapeHtml(summarizeGroupStatuses(group.items)),
      tone: group.items.some((job) => job.status === "failed")
        ? ("danger" as const)
        : group.items.some((job) => job.status === "applied")
          ? ("success" as const)
          : ("default" as const)
    })),
    copy.noJobs
  );

  const jobActiveFiltersPanel = renderActiveFiltersPanel(
    copy,
    activeJobFilterItems,
    buildDashboardViewUrl("job-history")
  );
  const selectedJobRelatedJobsPanel = renderJobFeedPanel(
    copy,
    locale,
    selectedJobRelatedJobs,
    copy.linkedOperationsTitle
  );
  const selectedJobAuditPanel = renderAuditPanel(
    copy,
    locale,
    selectedJobAuditEvents.length > 0 ? selectedJobAuditEvents : data.auditEvents.slice(0, 8)
  );

  return [
    jobActiveFiltersPanel,
    failureFocusPanel,
    jobStatusesPanel,
    jobNodesPanel,
    jobKindsPanel,
    jobResourceHotspotsPanel,
    auditSignalsPanel,
    auditActorsPanel,
    auditEntitiesPanel,
    selectedJobRelatedJobsPanel,
    selectedJobAuditPanel
  ].join("");
}
