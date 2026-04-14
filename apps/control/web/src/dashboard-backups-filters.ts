import { createUniqueSelectOptions } from "./dashboard-utils.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { type BackupCopy, type BackupsWorkspaceArgs } from "./dashboard-backups-types.js";

export function buildActiveBackupFilterItems<Copy extends BackupCopy>(
  args: Pick<
    BackupsWorkspaceArgs<Copy>,
    "backupNodeFilter" | "backupPolicyFilter" | "backupStatusFilter" | "backupTenantFilter" | "copy"
  >
): Array<{ label: string; value: string }> {
  const {
    backupNodeFilter,
    backupPolicyFilter,
    backupStatusFilter,
    backupTenantFilter,
    copy
  } = args;

  return [
    backupStatusFilter ? { label: copy.filterStatusLabel, value: backupStatusFilter } : undefined,
    backupNodeFilter ? { label: copy.filterNodeLabel, value: backupNodeFilter } : undefined,
    backupTenantFilter ? { label: copy.filterTenantLabel, value: backupTenantFilter } : undefined,
    backupPolicyFilter ? { label: copy.filterPolicyLabel, value: backupPolicyFilter } : undefined
  ].filter(Boolean) as Array<{ label: string; value: string }>;
}

export function renderBackupsFilterForm<Copy extends BackupCopy>(
  args: Pick<
    BackupsWorkspaceArgs<Copy>,
    | "backupNodeFilter"
    | "backupPolicyFilter"
    | "backupStatusFilter"
    | "backupTenantFilter"
    | "copy"
    | "data"
    | "renderWorkspaceFilterForm"
  >
): string {
  const {
    backupNodeFilter,
    backupPolicyFilter,
    backupStatusFilter,
    backupTenantFilter,
    copy,
    data,
    renderWorkspaceFilterForm
  } = args;

  return renderWorkspaceFilterForm(copy, {
    view: "backups",
    clearHref: buildDashboardViewUrl("backups"),
    fields: [
      {
        name: "backupStatus",
        label: copy.filterStatusLabel,
        value: backupStatusFilter,
        options: createUniqueSelectOptions(data.backups.latestRuns.map((run) => run.status))
      },
      {
        name: "backupNode",
        label: copy.filterNodeLabel,
        value: backupNodeFilter,
        options: createUniqueSelectOptions([
          ...data.backups.latestRuns.map((run) => run.nodeId),
          ...data.backups.policies.map((policy) => policy.targetNodeId)
        ])
      },
      {
        name: "backupTenant",
        label: copy.filterTenantLabel,
        value: backupTenantFilter,
        options: createUniqueSelectOptions(data.backups.policies.map((policy) => policy.tenantSlug))
      },
      {
        name: "backupPolicy",
        label: copy.filterPolicyLabel,
        value: backupPolicyFilter,
        options: createUniqueSelectOptions(data.backups.policies.map((policy) => policy.policySlug))
      }
    ]
  });
}
