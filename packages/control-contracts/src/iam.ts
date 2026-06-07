export const iamProviderKinds = ["authentik", "pyrosa_accounts"] as const;
export type IamProviderKind = (typeof iamProviderKinds)[number];

export const iamProviderStatuses = ["active", "candidate", "future", "disabled"] as const;
export type IamProviderStatus = (typeof iamProviderStatuses)[number];

export const iamAuthModes = [
  "proxy",
  "trusted_proxy_headers",
  "ui_auth",
  "oidc",
  "saml"
] as const;
export type IamAuthMode = (typeof iamAuthModes)[number];

export const iamMfaPolicies = ["provider_default", "required", "optional", "none"] as const;
export type IamMfaPolicy = (typeof iamMfaPolicies)[number];

export const iamBindingTargetKinds = ["control", "app", "host_service"] as const;
export type IamBindingTargetKind = (typeof iamBindingTargetKinds)[number];

export const iamBindingStatuses = ["active", "candidate", "future", "disabled"] as const;
export type IamBindingStatus = (typeof iamBindingStatuses)[number];

export interface IamProviderSummary {
  providerId: string;
  slug: string;
  displayName: string;
  kind: IamProviderKind;
  status: IamProviderStatus;
  baseUrl?: string;
  capabilities: IamAuthMode[];
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
  allowedGroups: string[];
  config: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IamOverview {
  providers: IamProviderSummary[];
  bindings: IamBindingSummary[];
}

export interface IamBindingMutationRequest {
  bindingId: string;
  providerSlug: string;
  authMode: IamAuthMode;
  mfaPolicy: IamMfaPolicy;
  status: IamBindingStatus;
}
