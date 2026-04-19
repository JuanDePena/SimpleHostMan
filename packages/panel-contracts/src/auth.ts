import type {
  ControlGlobalRole,
  TenantMembershipRole
} from "./core.js";

export interface TenantMembershipSummary {
  tenantId: string;
  tenantSlug: string;
  tenantDisplayName: string;
  role: TenantMembershipRole;
}

export interface AuthenticatedUserSummary {
  userId: string;
  email: string;
  displayName: string;
  status: string;
  globalRoles: ControlGlobalRole[];
  tenantMemberships: TenantMembershipSummary[];
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AuthLoginResponse {
  sessionToken: string;
  expiresAt: string;
  user: AuthenticatedUserSummary;
}

export interface AuthLogoutResponse {
  revoked: true;
}

export interface CreateUserTenantMembershipInput {
  tenantSlug: string;
  role: TenantMembershipRole;
}

export interface CreateUserRequest {
  email: string;
  displayName: string;
  password: string;
  globalRoles?: ControlGlobalRole[];
  tenantMemberships?: CreateUserTenantMembershipInput[];
}

export interface CreateUserResponse {
  user: AuthenticatedUserSummary;
}
