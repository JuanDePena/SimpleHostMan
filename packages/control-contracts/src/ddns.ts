import type { JobDispatchResponse } from "./jobs.js";

export type DdnsRecordType = "A" | "AAAA";

export interface DdnsHostSummary {
  hostname: string;
  zoneName: string;
  recordName: string;
  recordType: DdnsRecordType;
  username: string;
  ttl: number;
  enabled: boolean;
  lastIp?: string;
  lastSeenAt?: string;
  lastUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DdnsHostsResponse {
  hosts: DdnsHostSummary[];
}

export interface UpsertDdnsHostRequest {
  hostname: string;
  zoneName?: string;
  recordType?: DdnsRecordType;
  username?: string;
  password?: string;
  ttl?: number;
  enabled?: boolean;
}

export interface DdnsHostMutationResponse {
  host: DdnsHostSummary;
  password?: string;
}

export interface DdnsHostUpdateRequest {
  hostname: string;
  username: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  remoteAddress?: string;
}

export type DdnsUpdateStatus = "good" | "nochg" | "nohost" | "badauth" | "badip";

export interface DdnsHostUpdateResponse {
  status: DdnsUpdateStatus;
  hostname?: string;
  ipAddress?: string;
  changed: boolean;
  dispatch?: JobDispatchResponse;
}
