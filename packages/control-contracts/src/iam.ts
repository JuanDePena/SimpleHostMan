export const iamProviderKinds = ["authentik", "pyrosa_accounts"] as const;
export type IamProviderKind = (typeof iamProviderKinds)[number];

export const iamProviderStatuses = ["active", "candidate", "future", "disabled"] as const;
export type IamProviderStatus = (typeof iamProviderStatuses)[number];

export const iamAuthModes = [
  "proxy",
  "trusted_proxy_headers",
  "ui_auth",
  "oauth_login",
  "oidc",
  "saml"
] as const;
export type IamAuthMode = (typeof iamAuthModes)[number];

export const iamProviderCapabilityKeys = [
  "proxy",
  "trusted_proxy_headers",
  "ui_auth",
  "oauth",
  "oidc",
  "saml",
  "gateway_proxy"
] as const;
export type IamProviderCapabilityKey = (typeof iamProviderCapabilityKeys)[number];

export const iamProviderCapabilityStatuses = [
  "available",
  "pilot_validated",
  "future",
  "disabled"
] as const;
export type IamProviderCapabilityStatus = (typeof iamProviderCapabilityStatuses)[number];

export const iamMfaPolicies = ["provider_default", "required", "optional", "none"] as const;
export type IamMfaPolicy = (typeof iamMfaPolicies)[number];

export const iamBindingTargetKinds = ["control", "app", "host_service"] as const;
export type IamBindingTargetKind = (typeof iamBindingTargetKinds)[number];

export const iamBindingStatuses = ["active", "candidate", "future", "disabled"] as const;
export type IamBindingStatus = (typeof iamBindingStatuses)[number];

export const iamBindingRenderModes = ["metadata_only", "apache_managed"] as const;
export type IamBindingRenderMode = (typeof iamBindingRenderModes)[number];

export const iamProviderProvisioningStatuses = [
  "unknown",
  "not_required",
  "manual_ready",
  "pending",
  "future"
] as const;
export type IamProviderProvisioningStatus =
  (typeof iamProviderProvisioningStatuses)[number];

export interface IamProviderCapabilitySummary {
  key: IamProviderCapabilityKey;
  status: IamProviderCapabilityStatus;
  notes?: string;
}

export interface IamProviderSummary {
  providerId: string;
  slug: string;
  displayName: string;
  kind: IamProviderKind;
  status: IamProviderStatus;
  baseUrl?: string;
  capabilities: IamAuthMode[];
  capabilityStatus: IamProviderCapabilitySummary[];
  config: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IamBindingSummary {
  bindingId: string;
  providerSlug: string;
  providerDisplayName: string;
  targetKind: IamBindingTargetKind;
  targetSlug: string;
  externalUrl?: string;
  internalUrl?: string;
  authMode: IamAuthMode;
  mfaPolicy: IamMfaPolicy;
  status: IamBindingStatus;
  renderMode: IamBindingRenderMode;
  renderEnabled: boolean;
  providerProvisioningStatus: IamProviderProvisioningStatus;
  allowedGroups: string[];
  config: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IamOperationalState {
  activeControlProviderSlug?: string;
  activeControlAuthMode?: IamAuthMode;
  candidateControlProviderSlug?: string;
  candidateControlAuthMode?: IamAuthMode;
  lastOAuthLoginAt?: string;
  lastOAuthLoginProvider?: string;
  lastOAuthLoginEmail?: string;
  lastOAuthLoginAssuranceLevel?: string;
  lastOAuthFailureAt?: string;
  lastOAuthFailureProvider?: string;
  lastOAuthFailureReason?: string;
}

export interface IamOverview {
  providers: IamProviderSummary[];
  bindings: IamBindingSummary[];
  operationalState: IamOperationalState;
}

export interface IamBindingMutationRequest {
  bindingId: string;
  providerSlug: string;
  authMode: IamAuthMode;
  mfaPolicy: IamMfaPolicy;
  status: IamBindingStatus;
  renderMode?: IamBindingRenderMode;
  providerProvisioningStatus?: IamProviderProvisioningStatus;
}
