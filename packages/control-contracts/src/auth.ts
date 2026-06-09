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

export interface PyrosaAccountsOAuthLoginResponse extends AuthLoginResponse {
  oauthLogoutToken: string;
}

export interface TrustedProxyLoginRequest {
  email: string;
  provider: string;
  username?: string;
  displayName?: string;
  groups?: string[];
  remoteAddress?: string;
  externalSubject?: string;
  mfaSatisfied?: boolean;
  assuranceLevel?: string;
}

export interface PyrosaAccountsOAuthLoginRequest {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface OAuthIdentityLoginRequest {
  provider: "pyrosa-accounts";
  email: string;
  username?: string;
  displayName?: string;
  externalSubject?: string;
  mfaSatisfied?: boolean;
  assuranceLevel?: string;
  clientId?: string;
  scopes?: string[];
  audience?: string | string[];
  issuer?: string;
  oauthClientId?: string;
  oauthScopes?: string[];
  oauthTokenHash?: string;
  oauthIssuer?: string;
}

export interface AuthLogoutResponse {
  revoked: true;
  authProviderSlug?: string;
  externalSubject?: string;
  assuranceLevel?: string;
  oauthClientId?: string;
  oauthScopes?: string[];
  oauthTokenHash?: string;
  oauthIssuer?: string;
}

export interface PyrosaAccountsOAuthRevokeRequest {
  token: string;
}

export interface OAuthLoginRejectedAuditRequest {
  provider: "pyrosa-accounts";
  reason: string;
  email?: string;
  clientId?: string;
  externalSubject?: string;
  assuranceLevel?: string;
}

export interface OAuthTokenRevokedAuditRequest {
  provider: "pyrosa-accounts";
  tokenHash?: string;
  clientId?: string;
  externalSubject?: string;
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
