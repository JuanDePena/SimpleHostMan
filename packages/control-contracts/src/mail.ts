import type {
  DesiredStateMailAliasInput,
  DesiredStateMailDomainInput,
  DesiredStateMailPolicyInput,
  MailboxCredentialState,
  DesiredStateMailboxInput,
  DesiredStateMailboxQuotaInput
} from "./desired-state.js";

export interface MailDomainSummary extends DesiredStateMailDomainInput {
  mailboxCount: number;
  aliasCount: number;
}

export interface MailboxSummary
  extends Omit<DesiredStateMailboxInput, "desiredPassword"> {
  hasCredential: boolean;
  credentialState: MailboxCredentialState;
  quotaBytes?: number;
  credentialUpdatedAt?: string;
}

export interface MailAliasSummary extends DesiredStateMailAliasInput {}

export interface MailboxQuotaSummary extends DesiredStateMailboxQuotaInput {
  domainName: string;
}

export interface MailOverview {
  generatedAt: string;
  policy?: DesiredStateMailPolicyInput;
  domains: MailDomainSummary[];
  mailboxes: MailboxSummary[];
  aliases: MailAliasSummary[];
  quotas: MailboxQuotaSummary[];
}

export interface UpsertMailDomainRequest extends DesiredStateMailDomainInput {}

export interface UpsertMailPolicyRequest extends DesiredStateMailPolicyInput {}

export interface UpsertMailboxRequest extends DesiredStateMailboxInput {}

export interface UpsertMailAliasRequest extends DesiredStateMailAliasInput {}

export interface UpsertMailboxQuotaRequest extends DesiredStateMailboxQuotaInput {}

export interface ResetMailboxCredentialRequest {
  mailboxAddress: string;
}

export interface RotateMailboxCredentialRequest {
  mailboxAddress: string;
}

export type MailboxCredentialAction =
  | "missing"
  | "configured"
  | "generated"
  | "rotated"
  | "reset";

export interface MailboxCredentialMutationResult {
  mailboxAddress: string;
  credentialState: MailboxCredentialState;
  action: MailboxCredentialAction;
  revealId?: string;
}

export interface MailboxCredentialReveal {
  revealId: string;
  mailboxAddress: string;
  credential: string;
  action: Extract<MailboxCredentialAction, "generated" | "rotated">;
  generatedAt: string;
}
