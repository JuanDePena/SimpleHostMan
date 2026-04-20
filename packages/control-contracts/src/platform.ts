import type {
  DispatchedJobStatus,
  ControlHealthStatus,
  ControlServiceName
} from "./core.js";

export interface CodeServerServiceSnapshot {
  serviceName: string;
  enabled: boolean;
  active: boolean;
  version?: string;
  bindAddress?: string;
  authMode?: string;
  settingsProfileHash?: string;
  checkedAt: string;
}

export interface RustDeskListenerSnapshot {
  protocol: "tcp" | "udp";
  address: string;
  port: number;
}

export interface RustDeskServiceSnapshot {
  hbbsServiceName: string;
  hbbsEnabled: boolean;
  hbbsActive: boolean;
  hbbrServiceName: string;
  hbbrEnabled: boolean;
  hbbrActive: boolean;
  publicKey?: string;
  publicKeyPath?: string;
  listeners: RustDeskListenerSnapshot[];
  checkedAt: string;
}

export interface MailManagedDomainSnapshot {
  domainName: string;
  mailHost: string;
  webmailHostname: string;
  deliveryRole: "primary" | "standby";
  mailboxCount: number;
  aliasCount: number;
}

export interface MailServiceSnapshot {
  postfixServiceName: string;
  postfixEnabled: boolean;
  postfixActive: boolean;
  postfixInstalled?: boolean;
  dovecotServiceName: string;
  dovecotEnabled: boolean;
  dovecotActive: boolean;
  dovecotInstalled?: boolean;
  rspamdServiceName: string;
  rspamdEnabled: boolean;
  rspamdActive: boolean;
  rspamdInstalled?: boolean;
  redisServiceName: string;
  redisEnabled: boolean;
  redisActive: boolean;
  redisInstalled?: boolean;
  configRoot?: string;
  statePath?: string;
  vmailRoot?: string;
  dkimRoot?: string;
  roundcubeRoot?: string;
  roundcubeSharedRoot?: string;
  roundcubeConfigPath?: string;
  roundcubeDatabasePath?: string;
  roundcubeDeployment?: "packaged" | "placeholder" | "absent";
  firewallServiceName?: string;
  firewallConfigured?: boolean;
  configuredMailboxCount?: number;
  resetRequiredMailboxCount?: number;
  managedDomains: MailManagedDomainSnapshot[];
  checkedAt: string;
}

export interface AppServiceSnapshot {
  appSlug: string;
  serviceName: string;
  containerName: string;
  enabled: boolean;
  active: boolean;
  image?: string;
  backendPort?: number;
  stateRoot?: string;
  envFilePath?: string;
  quadletPath?: string;
  checkedAt: string;
}

export interface NodeRuntimeSnapshot {
  appServices?: AppServiceSnapshot[];
  codeServer?: CodeServerServiceSnapshot;
  rustdesk?: RustDeskServiceSnapshot;
  mail?: MailServiceSnapshot;
}

export interface ControlHealthSnapshot {
  service: ControlServiceName;
  status: ControlHealthStatus;
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
}

export interface NodeHealthSnapshot {
  nodeId: string;
  hostname: string;
  desiredRole: "inventory";
  currentVersion?: string;
  desiredVersion?: string;
  lastSeenAt?: string;
  pendingJobCount: number;
  latestJobStatus?: DispatchedJobStatus;
  latestJobSummary?: string;
  driftedResourceCount?: number;
  primaryZoneCount?: number;
  primaryAppCount?: number;
  backupPolicyCount?: number;
  appServices?: AppServiceSnapshot[];
  codeServer?: CodeServerServiceSnapshot;
  rustdesk?: RustDeskServiceSnapshot;
  mail?: MailServiceSnapshot;
}

export interface RustDeskNodeSummary {
  nodeId: string;
  hostname: string;
  role?: "primary" | "secondary";
  dnsTarget?: string;
  lastSeenAt?: string;
  rustdesk?: RustDeskServiceSnapshot;
}

export interface RustDeskOverview {
  generatedAt: string;
  publicHostname?: string;
  txtRecordFqdn?: string;
  txtRecordValue?: string;
  publicKey?: string;
  keyConsistency: "match" | "mismatch" | "unknown";
  nodes: RustDeskNodeSummary[];
}

export interface RustDeskPublicConnectionInfo {
  generatedAt: string;
  publicHostname?: string;
  publicKey?: string;
  relayHostname?: string;
  txtRecordFqdn?: string;
  txtRecordValue?: string;
  status: "ready" | "incomplete";
}

export interface ControlApiMetadata {
  product: "SimpleHost";
  service: ControlServiceName;
  runtime: "nodejs";
  version: string;
}

export function createControlApiMetadata(
  service: ControlServiceName,
  version: string
): ControlApiMetadata {
  return {
    product: "SimpleHost",
    service,
    runtime: "nodejs",
    version
  };
}
