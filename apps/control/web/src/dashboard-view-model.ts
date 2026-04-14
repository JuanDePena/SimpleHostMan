import { type DashboardData } from "./api-client.js";
import {
  appWorkspaceTabIds,
  backupPolicyWorkspaceTabIds,
  databaseWorkspaceTabIds,
  normalizeDesiredStateTab,
  normalizeFilterValue,
  normalizeWorkspaceTab,
  proxyWorkspaceTabIds,
  resolveDesiredStateTabForView,
  tenantWorkspaceTabIds,
  type DashboardView,
  type DesiredStateTabId,
  zoneWorkspaceTabIds
} from "./dashboard-routing.js";

export type DashboardJobFilters = {
  jobStatus?: string;
  jobKind?: string;
  jobNode?: string;
  jobResource?: string;
  auditType?: string;
  auditActor?: string;
  auditEntity?: string;
};

export type DashboardDriftFilters = {
  driftStatus?: string;
  driftKind?: string;
  driftNode?: string;
};

export type DashboardBackupFilters = {
  backupStatus?: string;
  backupNode?: string;
  backupTenant?: string;
  backupPolicy?: string;
};

export type DashboardPackageFilters = {
  packageNode?: string;
  packageName?: string;
  packageArch?: string;
};

export function buildDashboardViewModel(args: {
  data: DashboardData;
  currentPath: string;
  view: DashboardView;
  desiredStateTab: DesiredStateTabId;
  focus?: string;
  payloadContainsValue: (payload: unknown, needle: string) => boolean;
}) {
  const { data, currentPath, view, desiredStateTab, focus, payloadContainsValue } = args;
  const currentUrl = new URL(`http://localhost${currentPath}`);
  const resolvedDesiredStateTab = resolveDesiredStateTabForView(view, desiredStateTab);
  const tenantWorkspaceTab = normalizeWorkspaceTab(
    currentUrl.searchParams.get("tab"),
    tenantWorkspaceTabIds,
    "tenants-summary"
  );
  const zoneWorkspaceTab = normalizeWorkspaceTab(
    currentUrl.searchParams.get("tab"),
    zoneWorkspaceTabIds,
    "zones-summary"
  );
  const proxyWorkspaceTab = normalizeWorkspaceTab(
    currentUrl.searchParams.get("tab"),
    proxyWorkspaceTabIds,
    "proxies-summary"
  );
  const appWorkspaceTab = normalizeWorkspaceTab(
    currentUrl.searchParams.get("tab"),
    appWorkspaceTabIds,
    "apps-summary"
  );
  const databaseWorkspaceTab = normalizeWorkspaceTab(
    currentUrl.searchParams.get("tab"),
    databaseWorkspaceTabIds,
    "databases-summary"
  );
  const backupPolicyWorkspaceTab = normalizeWorkspaceTab(
    currentUrl.searchParams.get("tab"),
    backupPolicyWorkspaceTabIds,
    "backup-policies-summary"
  );
  const jobStatusFilter = normalizeFilterValue(currentUrl.searchParams.get("jobStatus"));
  const jobKindFilter = normalizeFilterValue(currentUrl.searchParams.get("jobKind"));
  const jobNodeFilter = normalizeFilterValue(currentUrl.searchParams.get("jobNode"));
  const jobResourceFilter = normalizeFilterValue(currentUrl.searchParams.get("jobResource"));
  const auditTypeFilter = normalizeFilterValue(currentUrl.searchParams.get("auditType"));
  const auditActorFilter = normalizeFilterValue(currentUrl.searchParams.get("auditActor"));
  const auditEntityFilter = normalizeFilterValue(currentUrl.searchParams.get("auditEntity"));
  const driftStatusFilter = normalizeFilterValue(currentUrl.searchParams.get("driftStatus"));
  const driftKindFilter = normalizeFilterValue(currentUrl.searchParams.get("driftKind"));
  const driftNodeFilter = normalizeFilterValue(currentUrl.searchParams.get("driftNode"));
  const backupStatusFilter = normalizeFilterValue(currentUrl.searchParams.get("backupStatus"));
  const backupNodeFilter = normalizeFilterValue(currentUrl.searchParams.get("backupNode"));
  const backupTenantFilter = normalizeFilterValue(currentUrl.searchParams.get("backupTenant"));
  const backupPolicyFilter = normalizeFilterValue(currentUrl.searchParams.get("backupPolicy"));
  const packageNodeFilter = normalizeFilterValue(currentUrl.searchParams.get("packageNode"));
  const packageNameFilter = normalizeFilterValue(currentUrl.searchParams.get("packageName"));
  const packageArchFilter = normalizeFilterValue(currentUrl.searchParams.get("packageArch"));
  const backupPoliciesBySlug = new Map(
    data.backups.policies.map((policy) => [policy.policySlug, policy] as const)
  );

  const filteredJobHistory = data.jobHistory.filter((job) => {
    if (jobStatusFilter && (job.status ?? "queued") !== jobStatusFilter) {
      return false;
    }

    if (jobKindFilter && job.kind !== jobKindFilter) {
      return false;
    }

    if (jobNodeFilter && job.nodeId !== jobNodeFilter) {
      return false;
    }

    if (jobResourceFilter && job.resourceKey !== jobResourceFilter) {
      return false;
    }

    return true;
  });

  const filteredAuditEvents = data.auditEvents.filter((event) => {
    if (auditTypeFilter && event.eventType !== auditTypeFilter) {
      return false;
    }

    if (auditActorFilter) {
      const actorKey = `${event.actorType}:${event.actorId ?? "unknown"}`.toLowerCase();
      const actorType = event.actorType.toLowerCase();
      const actorId = (event.actorId ?? "").toLowerCase();

      if (
        !actorKey.includes(auditActorFilter) &&
        !actorType.includes(auditActorFilter) &&
        !actorId.includes(auditActorFilter)
      ) {
        return false;
      }
    }

    if (
      auditEntityFilter &&
      ![
        event.entityType ? `${event.entityType}:${event.entityId ?? ""}` : "",
        event.entityType ?? "",
        event.entityId ?? "",
        event.actorId ?? ""
      ]
        .filter(Boolean)
        .includes(auditEntityFilter) &&
      !payloadContainsValue(event.payload, auditEntityFilter)
    ) {
      return false;
    }

    return true;
  });

  const filteredDrift = data.drift.filter((entry) => {
    if (driftStatusFilter && entry.driftStatus !== driftStatusFilter) {
      return false;
    }

    if (driftKindFilter && entry.resourceKind !== driftKindFilter) {
      return false;
    }

    if (driftNodeFilter && entry.nodeId !== driftNodeFilter) {
      return false;
    }

    return true;
  });

  const filteredBackupPolicies = data.backups.policies.filter((policy) => {
    if (backupTenantFilter && policy.tenantSlug !== backupTenantFilter) {
      return false;
    }

    if (backupNodeFilter && policy.targetNodeId !== backupNodeFilter) {
      return false;
    }

    if (backupPolicyFilter && policy.policySlug !== backupPolicyFilter) {
      return false;
    }

    return true;
  });

  const filteredBackupRuns = data.backups.latestRuns.filter((run) => {
    const policy = backupPoliciesBySlug.get(run.policySlug);

    if (backupStatusFilter && run.status !== backupStatusFilter) {
      return false;
    }

    if (backupNodeFilter && run.nodeId !== backupNodeFilter) {
      return false;
    }

    if (backupPolicyFilter && run.policySlug !== backupPolicyFilter) {
      return false;
    }

    if (backupTenantFilter && policy?.tenantSlug !== backupTenantFilter) {
      return false;
    }

    return true;
  });

  const filteredPackages = data.packages.packages.filter((entry) => {
    if (packageNodeFilter && entry.nodeId !== packageNodeFilter) {
      return false;
    }

    if (packageArchFilter && entry.arch !== packageArchFilter) {
      return false;
    }

    if (packageNameFilter) {
      const needle = packageNameFilter.toLowerCase();

      if (
        ![
          entry.packageName,
          entry.version,
          entry.release,
          entry.nevra,
          entry.hostname,
          entry.nodeId
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(needle))
      ) {
        return false;
      }
    }

    return true;
  });

  const currentJobFilters: DashboardJobFilters = {
    jobStatus: jobStatusFilter,
    jobKind: jobKindFilter,
    jobNode: jobNodeFilter,
    jobResource: jobResourceFilter,
    auditType: auditTypeFilter,
    auditActor: auditActorFilter,
    auditEntity: auditEntityFilter
  };
  const currentDriftFilters: DashboardDriftFilters = {
    driftStatus: driftStatusFilter,
    driftKind: driftKindFilter,
    driftNode: driftNodeFilter
  };
  const currentBackupFilters: DashboardBackupFilters = {
    backupStatus: backupStatusFilter,
    backupNode: backupNodeFilter,
    backupTenant: backupTenantFilter,
    backupPolicy: backupPolicyFilter
  };
  const currentPackageFilters: DashboardPackageFilters = {
    packageNode: packageNodeFilter,
    packageName: packageNameFilter,
    packageArch: packageArchFilter
  };

  const selectedNodeHealth =
    view === "node-health" || view === "nodes"
      ? data.nodeHealth.find((node) => node.nodeId === focus) ?? data.nodeHealth[0]
      : undefined;
  const selectedDrift =
    view === "resource-drift"
      ? filteredDrift.find((entry) => entry.resourceKey === focus) ??
        filteredDrift[0] ??
        data.drift[0]
      : undefined;
  const selectedJob =
    view === "job-history" || view === "jobs"
      ? filteredJobHistory.find((job) => job.jobId === focus) ??
        filteredJobHistory[0] ??
        data.jobHistory[0]
      : undefined;
  const selectedBackupViewRun =
    view === "backups"
      ? filteredBackupRuns.find((run) => run.policySlug === focus || run.runId === focus) ??
        filteredBackupRuns[0] ??
        data.backups.latestRuns[0]
      : undefined;
  const selectedBackupPolicySummary = selectedBackupViewRun
    ? filteredBackupPolicies.find((policy) => policy.policySlug === selectedBackupViewRun.policySlug) ??
      data.backups.policies.find((policy) => policy.policySlug === selectedBackupViewRun.policySlug)
    : view === "backups"
      ? filteredBackupPolicies.find((policy) => policy.policySlug === focus) ??
        filteredBackupPolicies[0] ??
        data.backups.policies.find((policy) => policy.policySlug === focus) ??
        data.backups.policies[0]
      : undefined;
  const selectedPackage =
    view === "packages"
      ? filteredPackages.find(
          (entry) => `${entry.nodeId}:${entry.packageName}:${entry.arch}` === focus
        ) ??
        filteredPackages[0] ??
        data.packages.packages[0]
      : undefined;

  return {
    resolvedDesiredStateTab: normalizeDesiredStateTab(resolvedDesiredStateTab),
    tenantWorkspaceTab,
    zoneWorkspaceTab,
    proxyWorkspaceTab,
    appWorkspaceTab,
    databaseWorkspaceTab,
    backupPolicyWorkspaceTab,
    jobStatusFilter,
    jobKindFilter,
    jobNodeFilter,
    jobResourceFilter,
    auditTypeFilter,
    auditActorFilter,
    auditEntityFilter,
    driftStatusFilter,
    driftKindFilter,
    driftNodeFilter,
    backupStatusFilter,
    backupNodeFilter,
    backupTenantFilter,
    backupPolicyFilter,
    packageNodeFilter,
    packageNameFilter,
    packageArchFilter,
    filteredJobHistory,
    filteredAuditEvents,
    filteredDrift,
    filteredBackupPolicies,
    filteredBackupRuns,
    filteredPackages,
    currentJobFilters,
    currentDriftFilters,
    currentBackupFilters,
    currentPackageFilters,
    selectedNodeHealth,
    selectedDrift,
    selectedJob,
    selectedBackupViewRun,
    selectedBackupPolicySummary,
    selectedPackage
  };
}
