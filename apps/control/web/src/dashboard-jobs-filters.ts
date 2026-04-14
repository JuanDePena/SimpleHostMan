import { createUniqueSelectOptions } from "./dashboard-utils.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { type JobHistoryWorkspaceArgs, type JobsCopy } from "./dashboard-jobs-types.js";

export function buildActiveJobFilterItems<Copy extends JobsCopy>(
  args: Pick<
    JobHistoryWorkspaceArgs<Copy>,
    | "auditActorFilter"
    | "auditEntityFilter"
    | "auditTypeFilter"
    | "copy"
    | "jobKindFilter"
    | "jobNodeFilter"
    | "jobResourceFilter"
    | "jobStatusFilter"
  >
): Array<{ label: string; value: string }> {
  const {
    auditActorFilter,
    auditEntityFilter,
    auditTypeFilter,
    copy,
    jobKindFilter,
    jobNodeFilter,
    jobResourceFilter,
    jobStatusFilter
  } = args;

  return [
    jobStatusFilter ? { label: copy.filterStatusLabel, value: jobStatusFilter } : undefined,
    jobKindFilter ? { label: copy.filterKindLabel, value: jobKindFilter } : undefined,
    jobNodeFilter ? { label: copy.filterNodeLabel, value: jobNodeFilter } : undefined,
    jobResourceFilter ? { label: copy.filterResourceLabel, value: jobResourceFilter } : undefined,
    auditTypeFilter ? { label: copy.filterEventLabel, value: auditTypeFilter } : undefined,
    auditActorFilter ? { label: copy.filterActorLabel, value: auditActorFilter } : undefined,
    auditEntityFilter ? { label: copy.filterEntityLabel, value: auditEntityFilter } : undefined
  ].filter(Boolean) as Array<{ label: string; value: string }>;
}

export function renderJobHistoryFilterForm<Copy extends JobsCopy>(
  args: Pick<
    JobHistoryWorkspaceArgs<Copy>,
    | "auditActorFilter"
    | "auditEntityFilter"
    | "auditTypeFilter"
    | "copy"
    | "data"
    | "jobKindFilter"
    | "jobNodeFilter"
    | "jobResourceFilter"
    | "jobStatusFilter"
    | "renderWorkspaceFilterForm"
  >
): string {
  const {
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
  } = args;

  return renderWorkspaceFilterForm(copy, {
    view: "job-history",
    clearHref: buildDashboardViewUrl("job-history"),
    fields: [
      {
        name: "jobStatus",
        label: copy.filterStatusLabel,
        value: jobStatusFilter,
        options: createUniqueSelectOptions(data.jobHistory.map((job) => job.status ?? "queued"))
      },
      {
        name: "jobKind",
        label: copy.filterKindLabel,
        value: jobKindFilter,
        options: createUniqueSelectOptions(data.jobHistory.map((job) => job.kind))
      },
      {
        name: "jobNode",
        label: copy.filterNodeLabel,
        value: jobNodeFilter,
        options: createUniqueSelectOptions([
          ...data.jobHistory.map((job) => job.nodeId),
          ...data.nodeHealth.map((node) => node.nodeId)
        ])
      },
      {
        name: "jobResource",
        label: copy.filterResourceLabel,
        type: "search",
        value: jobResourceFilter,
        placeholder: copy.filterResourceLabel
      },
      {
        name: "auditType",
        label: copy.filterEventLabel,
        value: auditTypeFilter,
        options: createUniqueSelectOptions(data.auditEvents.map((event) => event.eventType))
      },
      {
        name: "auditActor",
        label: copy.filterActorLabel,
        type: "search",
        value: auditActorFilter,
        placeholder: copy.filterActorLabel
      },
      {
        name: "auditEntity",
        label: copy.filterEntityLabel,
        type: "search",
        value: auditEntityFilter,
        placeholder: copy.filterEntityLabel
      }
    ]
  });
}
