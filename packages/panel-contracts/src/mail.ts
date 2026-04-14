import type {
  DesiredStateMailAliasInput,
  DesiredStateMailDomainInput,
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
  quotaBytes?: number;
}

export interface MailAliasSummary extends DesiredStateMailAliasInput {}

export interface MailboxQuotaSummary extends DesiredStateMailboxQuotaInput {
  domainName: string;
}

export interface MailOverview {
  generatedAt: string;
  domains: MailDomainSummary[];
  mailboxes: MailboxSummary[];
  aliases: MailAliasSummary[];
  quotas: MailboxQuotaSummary[];
}

export interface UpsertMailDomainRequest extends DesiredStateMailDomainInput {}

export interface UpsertMailboxRequest extends DesiredStateMailboxInput {}

export interface UpsertMailAliasRequest extends DesiredStateMailAliasInput {}

export interface UpsertMailboxQuotaRequest extends DesiredStateMailboxQuotaInput {}
