export interface BackupPolicySummary {
  policySlug: string;
  tenantSlug: string;
  targetNodeId: string;
  schedule: string;
  retentionDays: number;
  storageLocation: string;
  resourceSelectors: string[];
}

export interface BackupMailArtifactPaths {
  maildir: string[];
  dkim: string[];
  runtimeConfig: string[];
  webmailState: string[];
}

export interface BackupMailRestoreCheckSummary {
  scope: "mailbox" | "domain" | "mail-stack";
  target: string;
  status: "validated" | "warning" | "failed";
  summary: string;
  validatedAt: string;
}

export interface BackupMailRunDetails {
  artifactPaths: BackupMailArtifactPaths;
  restoreChecks: BackupMailRestoreCheckSummary[];
}

export interface BackupRunDetails {
  mail?: BackupMailRunDetails;
}

export interface BackupRunSummary {
  runId: string;
  policySlug: string;
  nodeId: string;
  status: "running" | "succeeded" | "failed";
  summary: string;
  startedAt: string;
  completedAt?: string;
  details?: BackupRunDetails;
}

export interface BackupRunRecordRequest {
  policySlug: string;
  nodeId: string;
  status: "running" | "succeeded" | "failed";
  summary: string;
  completedAt?: string;
  details?: BackupRunDetails;
}

export interface BackupsOverview {
  policies: BackupPolicySummary[];
  latestRuns: BackupRunSummary[];
}
