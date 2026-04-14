import { escapeHtml } from "@simplehost/panel-ui";

import {
  type DesiredStateComparisonRow,
  type DesiredStateComparisonState,
  type DesiredStateRelatedPanelItem
} from "./desired-state-shared.js";

type PillRenderer = (
  value: string,
  tone?: "default" | "success" | "danger" | "muted"
) => string;

export interface ComparisonCopyLabels {
  comparisonAppliedLabel: string;
  comparisonChangedLabel: string;
  comparisonDesiredLabel: string;
  comparisonFieldLabel: string;
  comparisonMatchLabel: string;
  comparisonStatusLabel: string;
  comparisonUnknownLabel: string;
  noRelatedRecords: string;
  none: string;
}

function renderComparisonStatePill<Copy extends ComparisonCopyLabels>(
  copy: Copy,
  state: DesiredStateComparisonState,
  renderPill: PillRenderer
): string {
  switch (state) {
    case "match":
      return renderPill(copy.comparisonMatchLabel, "success");
    case "changed":
      return renderPill(copy.comparisonChangedLabel, "danger");
    case "unknown":
    default:
      return renderPill(copy.comparisonUnknownLabel, "muted");
  }
}

export function createComparisonRow(
  label: string,
  desiredValue: string,
  appliedValue?: string | null
): DesiredStateComparisonRow {
  const normalizedDesired = desiredValue.trim();
  const normalizedApplied = appliedValue?.trim() ?? "";

  return {
    field: label,
    desiredValue: normalizedDesired,
    appliedValue: normalizedApplied || "",
    state: normalizedApplied
      ? normalizedDesired === normalizedApplied
        ? "match"
        : "changed"
      : "unknown"
  };
}

export function renderComparisonTable<Copy extends ComparisonCopyLabels>(
  copy: Copy,
  title: string,
  description: string,
  rows: DesiredStateComparisonRow[],
  renderPill: PillRenderer
): string {
  return `<article class="panel panel-nested detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p class="muted section-description">${escapeHtml(description)}</p>
      </div>
    </div>
    ${
      rows.length === 0
        ? `<p class="empty">${escapeHtml(copy.noRelatedRecords)}</p>`
        : `<div class="table-wrap comparison-table-wrap">
            <table class="comparison-table">
              <thead>
                <tr>
                  <th>${escapeHtml(copy.comparisonFieldLabel)}</th>
                  <th>${escapeHtml(copy.comparisonDesiredLabel)}</th>
                  <th>${escapeHtml(copy.comparisonAppliedLabel)}</th>
                  <th>${escapeHtml(copy.comparisonStatusLabel)}</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map(
                    (row) => `<tr>
                      <td>${escapeHtml(row.field)}</td>
                      <td>${escapeHtml(row.desiredValue || copy.none)}</td>
                      <td>${escapeHtml(row.appliedValue || copy.none)}</td>
                      <td class="comparison-state-cell">${renderComparisonStatePill(
                        copy,
                        row.state,
                        renderPill
                      )}</td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>`
    }
  </article>`;
}

export function summarizeComparisonRows<Copy extends ComparisonCopyLabels>(
  copy: Copy,
  rows: DesiredStateComparisonRow[]
): string {
  if (rows.length === 0) {
    return copy.none;
  }

  const changed = rows.filter((row) => row.state === "changed").length;
  const matched = rows.filter((row) => row.state === "match").length;
  const unknown = rows.filter((row) => row.state === "unknown").length;
  const parts = [
    changed > 0 ? `${changed} ${copy.comparisonChangedLabel}` : "",
    matched > 0 ? `${matched} ${copy.comparisonMatchLabel}` : "",
    unknown > 0 ? `${unknown} ${copy.comparisonUnknownLabel}` : ""
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : copy.none;
}

export function createComparisonDeltaItems<Copy extends ComparisonCopyLabels>(
  copy: Copy,
  rows: DesiredStateComparisonRow[],
  limit = 6
): DesiredStateRelatedPanelItem[] {
  const deltas = rows.filter((row) => row.state !== "match").slice(0, limit);

  if (deltas.length === 0) {
    return [];
  }

  return deltas.map((row) => ({
    title: row.field,
    meta:
      row.state === "changed"
        ? copy.comparisonChangedLabel
        : copy.comparisonUnknownLabel,
    summary: `${copy.comparisonDesiredLabel}: ${row.desiredValue || copy.none} · ${copy.comparisonAppliedLabel}: ${
      row.appliedValue || copy.none
    }`,
    tone: row.state === "changed" ? "danger" : "default"
  }));
}
