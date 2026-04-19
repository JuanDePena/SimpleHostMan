import { escapeHtml } from "@simplehost/ui";

import {
  type DnsRecordPayload,
  type OperationsOverview
} from "@simplehost/control-contracts";

import { type WebLocale } from "./request.js";
import { type SelectOption, type PillTone } from "./web-types.js";

type StatsCopy = {
  managedNodes: string;
  pendingJobs: string;
  failedJobs: string;
  resourcesWithDrift: string;
  backupPolicies: string;
  generatedAt: string;
};

export function formatDate(value: string | undefined, locale: WebLocale): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale === "es" ? "es-DO" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(new Date(value));
}

export function formatList(values: string[], emptyValue = "-"): string {
  return values.length > 0 ? values.join(", ") : emptyValue;
}

export function getInitials(value: string): string {
  const initials = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "SH";
}

export function interpolateCopy(
  template: string,
  values: Record<string, string | number>
): string {
  let next = template;

  for (const [key, value] of Object.entries(values)) {
    next = next.replaceAll(`{${key}}`, String(value));
  }

  return next;
}

export function renderSelectOptions(
  options: SelectOption[],
  selectedValue: string | undefined,
  optionsConfig: {
    allowBlank?: boolean;
    blankLabel?: string;
  } = {}
): string {
  const rendered: string[] = [];
  const seen = new Set<string>();

  if (optionsConfig.allowBlank) {
    const blankValue = selectedValue ?? "";
    rendered.push(
      `<option value=""${blankValue.length === 0 ? " selected" : ""}>${escapeHtml(
        optionsConfig.blankLabel ?? "-"
      )}</option>`
    );
  }

  for (const option of options) {
    if (seen.has(option.value)) {
      continue;
    }

    seen.add(option.value);
    rendered.push(
      `<option value="${escapeHtml(option.value)}"${
        option.value === selectedValue ? " selected" : ""
      }>${escapeHtml(option.label)}</option>`
    );
  }

  if (selectedValue && !seen.has(selectedValue)) {
    rendered.push(
      `<option value="${escapeHtml(selectedValue)}" selected>${escapeHtml(selectedValue)}</option>`
    );
  }

  return rendered.join("");
}

export function renderPill(
  value: string,
  tone: PillTone = "default"
): string {
  const className =
    tone === "success"
      ? "pill pill-success"
      : tone === "danger"
        ? "pill pill-danger"
        : tone === "muted"
          ? "pill pill-muted"
          : "pill";
  return `<span class="${className}">${escapeHtml(value)}</span>`;
}

export function renderStats<Copy extends StatsCopy>(
  overview: OperationsOverview,
  copy: Copy,
  locale: WebLocale
): string {
  return `<div class="stats">
    <article class="stat"><strong>${overview.nodeCount}</strong><span>${escapeHtml(copy.managedNodes)}</span></article>
    <article class="stat"><strong>${overview.pendingJobCount}</strong><span>${escapeHtml(copy.pendingJobs)}</span></article>
    <article class="stat"><strong>${overview.failedJobCount}</strong><span>${escapeHtml(copy.failedJobs)}</span></article>
    <article class="stat"><strong>${overview.driftedResourceCount}</strong><span>${escapeHtml(copy.resourcesWithDrift)}</span></article>
    <article class="stat"><strong>${overview.backupPolicyCount}</strong><span>${escapeHtml(copy.backupPolicies)}</span></article>
  </div>
  <p class="muted">${escapeHtml(copy.generatedAt)} ${escapeHtml(
    formatDate(overview.generatedAt, locale)
  )}</p>`;
}

export function readStringPayloadValue(
  payload: Record<string, unknown> | undefined,
  key: string
): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readBooleanPayloadValue(
  payload: Record<string, unknown> | undefined,
  key: string
): boolean | null {
  const value = payload?.[key];
  return typeof value === "boolean" ? value : null;
}

export function readStringArrayPayloadValue(
  payload: Record<string, unknown> | undefined,
  key: string
): string[] {
  const value = payload?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

export function readObjectArrayPayloadValue(
  payload: Record<string, unknown> | undefined,
  key: string
): Array<Record<string, unknown>> {
  const value = payload?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry)
  );
}

export function formatDnsRecordPreview(
  record: DnsRecordPayload | Record<string, unknown> | undefined
): string {
  if (!record) {
    return "";
  }

  const name = "name" in record && typeof record.name === "string" ? record.name : "";
  const type = "type" in record && typeof record.type === "string" ? record.type : "";
  const value = "value" in record && typeof record.value === "string" ? record.value : "";

  return [name, type, value].filter(Boolean).join(" ");
}
