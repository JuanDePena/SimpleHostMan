import { escapeHtml } from "@simplehost/ui";

import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { type JobHistoryWorkspaceArgs, type JobsCopy } from "./dashboard-jobs-types.js";

export function renderSelectedJobPanel<Copy extends JobsCopy>(
  args: Pick<
    JobHistoryWorkspaceArgs<Copy>,
    | "copy"
    | "formatDate"
    | "locale"
    | "renderCodeBlock"
    | "renderDetailGrid"
    | "renderPill"
    | "selectedJob"
  > & {
    selectedJobResourceTarget: {
      desiredStateHref?: string;
      driftHref?: string;
    };
  }
): string {
  const {
    copy,
    formatDate,
    locale,
    renderCodeBlock,
    renderDetailGrid,
    renderPill,
    selectedJob,
    selectedJobResourceTarget
  } = args;

  if (!selectedJob) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noJobs)}</p></article>`;
  }

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(selectedJob.kind)}</h3>
        <p class="muted section-description">${escapeHtml(copy.jobHistoryDescription)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedJob.nodeId)
      )}">${escapeHtml(copy.nodeColNode)}</a>
    </div>
    ${renderDetailGrid([
      {
        label: copy.jobColJob,
        value: `<span class="mono">${escapeHtml(selectedJob.jobId)}</span>`,
        className: "detail-item-span-two"
      },
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
      {
        label: copy.jobColReason,
        value: escapeHtml(selectedJob.dispatchReason ?? "-"),
        className: "detail-item-span-two"
      },
      { label: copy.jobColCreated, value: escapeHtml(formatDate(selectedJob.createdAt, locale)) },
      {
        label: copy.linkedResource,
        value: selectedJob.resourceKey
          ? `<span class="mono">${escapeHtml(selectedJob.resourceKey)}</span>`
          : escapeHtml(copy.none),
        className: "detail-item-span-two"
      },
      {
        label: copy.latestCompleted,
        value: escapeHtml(
          selectedJob.completedAt ? formatDate(selectedJob.completedAt, locale) : copy.none
        )
      },
      {
        label: copy.jobColSummary,
        value: escapeHtml(selectedJob.summary ?? "-"),
        className: "detail-item-span-two"
      },
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
        label: copy.openNodeHealth,
        value: `<a class="detail-link" href="${escapeHtml(
          buildDashboardViewUrl("node-health", undefined, selectedJob.nodeId)
        )}">${escapeHtml(copy.openNodeHealth)}</a>`
      }
    ])}
    <article class="panel detail-shell panel-nested">
      <h4>${escapeHtml(copy.payloadTitle)}</h4>
      <div class="stack">
        ${renderCodeBlock(selectedJob.payload)}
        ${selectedJob.details ? renderCodeBlock(selectedJob.details) : ""}
      </div>
    </article>
  </article>`;
}
