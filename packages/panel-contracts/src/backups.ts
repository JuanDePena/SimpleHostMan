export interface BackupPolicySummary {
  policySlug: string;
  tenantSlug: string;
  targetNodeId: string;
  schedule: string;
  retentionDays: number;
  storageLocation: string;
  resourceSelectors: string[];
}

export interface BackupRunSummary {
  runId: string;
  policySlug: string;
  nodeId: string;
  status: "running" | "succeeded" | "failed";
  summary: string;
  startedAt: string;
  completedAt?: string;
}

export interface BackupRunRecordRequest {
  policySlug: string;
  nodeId: string;
  status: "running" | "succeeded" | "failed";
  summary: string;
  completedAt?: string;
}

export interface BackupsOverview {
  policies: BackupPolicySummary[];
  latestRuns: BackupRunSummary[];
}
