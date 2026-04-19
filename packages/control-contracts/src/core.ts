export type ControlServiceName = "api" | "web" | "worker";
export type ControlHealthStatus = "ok" | "degraded";

export const controlGlobalRoles = ["platform_admin", "platform_operator"] as const;
export type ControlGlobalRole = (typeof controlGlobalRoles)[number];

export const tenantMembershipRoles = [
  "tenant_owner",
  "tenant_admin",
  "tenant_readonly"
] as const;
export type TenantMembershipRole = (typeof tenantMembershipRoles)[number];

export type DispatchedJobStatus = "applied" | "skipped" | "failed";
