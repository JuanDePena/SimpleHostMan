export type PanelServiceName = "api" | "web" | "worker";
export type PanelHealthStatus = "ok" | "degraded";

export const panelGlobalRoles = ["platform_admin", "platform_operator"] as const;
export type PanelGlobalRole = (typeof panelGlobalRoles)[number];

export const tenantMembershipRoles = [
  "tenant_owner",
  "tenant_admin",
  "tenant_readonly"
] as const;
export type TenantMembershipRole = (typeof tenantMembershipRoles)[number];

export type DispatchedJobStatus = "applied" | "skipped" | "failed";
