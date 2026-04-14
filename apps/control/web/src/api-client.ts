import { createPanelRuntimeConfig } from "@simplehost/panel-config";
import {
  type AuditEventSummary,
  type AuthenticatedUserSummary,
  type BackupsOverview,
  type DesiredStateApplyRequest,
  type DesiredStateExportResponse,
  type DesiredStateSpec,
  type JobHistoryEntry,
  type MailOverview,
  type NodeHealthSnapshot,
  type OperationsOverview,
  type PackageInventorySnapshot,
  type ResourceDriftSummary,
  type RustDeskOverview,
  type RustDeskPublicConnectionInfo,
  type InventoryStateSnapshot
} from "@simplehost/panel-contracts";
import { type PanelNotice } from "@simplehost/panel-ui";

import { sanitizeReturnTo } from "./request.js";

const config = createPanelRuntimeConfig();

export interface DashboardData {
  currentUser: AuthenticatedUserSummary;
  overview: OperationsOverview;
  inventory: InventoryStateSnapshot;
  desiredState: DesiredStateExportResponse;
  drift: ResourceDriftSummary[];
  nodeHealth: NodeHealthSnapshot[];
  jobHistory: JobHistoryEntry[];
  auditEvents: AuditEventSummary[];
  backups: BackupsOverview;
  rustdesk: RustDeskOverview;
  mail: MailOverview;
  packages: PackageInventorySnapshot;
}

export class WebApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "WebApiError";
  }
}

function createApiBaseUrl(): string {
  return `http://${config.api.host}:${config.api.port}`;
}

export async function apiRequest<T>(
  pathname: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
    responseType?: "json" | "text";
  } = {}
): Promise<T> {
  const response = await fetch(new URL(pathname, createApiBaseUrl()), {
    method: options.method ?? "GET",
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.body !== undefined
        ? { "content-type": "application/json; charset=utf-8" }
        : {})
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const responseText = await response.text();

  if (!response.ok) {
    let message = responseText || response.statusText;

    try {
      const parsed = JSON.parse(responseText) as Record<string, unknown>;
      message =
        typeof parsed.message === "string"
          ? parsed.message
          : typeof parsed.error === "string"
            ? parsed.error
            : message;
    } catch {
      // Keep plain text.
    }

    throw new WebApiError(response.status, message);
  }

  if ((options.responseType ?? "json") === "text") {
    return responseText as T;
  }

  return (responseText ? JSON.parse(responseText) : null) as T;
}

export async function loadDashboardData(token: string): Promise<DashboardData> {
  const [
    currentUser,
    overview,
    inventory,
    desiredState,
    drift,
    nodeHealth,
    jobHistory,
    auditEvents,
    backups,
    rustdesk,
    mail,
    packages
  ] = await Promise.all([
    apiRequest<AuthenticatedUserSummary>("/v1/auth/me", { token }),
    apiRequest<OperationsOverview>("/v1/operations/overview", { token }),
    apiRequest<InventoryStateSnapshot>("/v1/inventory/summary", { token }),
    apiRequest<DesiredStateExportResponse>("/v1/resources/spec", { token }),
    apiRequest<ResourceDriftSummary[]>("/v1/resources/drift", { token }),
    apiRequest<NodeHealthSnapshot[]>("/v1/nodes/health", { token }),
    apiRequest<JobHistoryEntry[]>("/v1/jobs/history?limit=30", { token }),
    apiRequest<AuditEventSummary[]>("/v1/audit/events?limit=30", { token }),
    apiRequest<BackupsOverview>("/v1/backups/summary", { token }),
    apiRequest<RustDeskOverview>("/v1/platform/rustdesk", { token }),
    apiRequest<MailOverview>("/v1/mail/overview", { token }),
    apiRequest<PackageInventorySnapshot>("/v1/packages/summary", { token })
  ]);

  return {
    currentUser,
    overview,
    inventory,
    desiredState,
    drift,
    nodeHealth,
    jobHistory,
    auditEvents,
    backups,
    rustdesk,
    mail,
    packages
  };
}

export async function loadRustDeskPublicConnection(): Promise<RustDeskPublicConnectionInfo> {
  return apiRequest<RustDeskPublicConnectionInfo>("/v1/public/rustdesk");
}

export function getNoticeFromUrl(url: URL): PanelNotice | undefined {
  const message = url.searchParams.get("notice");
  const kind = url.searchParams.get("kind");

  if (!message) {
    return undefined;
  }

  return {
    kind:
      kind === "success" || kind === "error" || kind === "info"
        ? kind
        : "info",
    message
  };
}

export function noticeLocation(
  message: string,
  kind: PanelNotice["kind"] = "success"
): string {
  const url = new URL("http://localhost/");
  url.searchParams.set("notice", message);
  url.searchParams.set("kind", kind);
  return `${url.pathname}${url.search}`;
}

export function noticeReturnTo(
  returnTo: string,
  message: string,
  kind: PanelNotice["kind"] = "success"
): string {
  const url = new URL(sanitizeReturnTo(returnTo), "http://localhost");
  url.searchParams.set("notice", message);
  url.searchParams.set("kind", kind);
  return `${url.pathname}${url.search}`;
}

export async function loadDesiredStateSpec(token: string): Promise<DesiredStateSpec> {
  const exported = await apiRequest<DesiredStateExportResponse>("/v1/resources/spec", {
    token
  });
  return exported.spec;
}

export async function applyDesiredStateSpec(
  token: string,
  spec: DesiredStateSpec,
  reason: string
): Promise<void> {
  await apiRequest<unknown>("/v1/resources/spec", {
    method: "PUT",
    token,
    body: {
      spec,
      reason
    } satisfies DesiredStateApplyRequest
  });
}

export async function mutateDesiredState(
  token: string,
  reason: string,
  action: (spec: DesiredStateSpec) => DesiredStateSpec
): Promise<void> {
  const spec = await loadDesiredStateSpec(token);
  await applyDesiredStateSpec(token, action(spec), reason);
}
