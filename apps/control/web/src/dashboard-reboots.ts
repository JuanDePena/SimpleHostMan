import {
  escapeHtml,
  renderDataTable,
  type DataTableRow
} from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import {
  isRuntimeRecordSelected,
  selectRuntimeRecord,
  type RuntimeSelectionRecord
} from "./dashboard-runtime-selection.js";
import { renderActionFacts } from "./panel-renderers.js";
import { type WebLocale } from "./request.js";
import { type WebCopy } from "./web-copy.js";

type RebootState = NonNullable<DashboardData["nodeHealth"][number]["rebootState"]>;
type RebootRecord = RuntimeSelectionRecord<RebootState>;

function formatDuration(seconds: number | undefined, copy: WebCopy): string {
  if (seconds === undefined) {
    return copy.none;
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return [
    days > 0 ? `${days}d` : "",
    hours > 0 ? `${hours}h` : "",
    `${minutes}m`
  ].filter(Boolean).join(" ");
}

function rebootTone(state: RebootState | undefined): "default" | "success" | "danger" | "muted" {
  if (!state || state.needsReboot === undefined) {
    return "muted";
  }

  return state.needsReboot ? "danger" : "success";
}

function rebootLabel(state: RebootState | undefined, copy: WebCopy): string {
  if (!state || state.needsReboot === undefined) {
    return copy.notReportedLabel;
  }

  return state.needsReboot ? copy.rebootRequiredLabel : copy.rebootNotRequiredLabel;
}

function buildRebootRows(args: {
  copy: WebCopy;
  records: RebootRecord[];
  selectedRecord: RebootRecord | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, records, selectedRecord, locale, formatDate, renderFocusLink, renderPill } = args;

  return records.map((record) => {
    const { node, item: state, key } = record;
    const selected = isRuntimeRecordSelected(record, selectedRecord);

    return {
      selectionKey: key,
      selected,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("reboots", undefined, key),
          selected,
          copy.selectedStateLabel
        ),
        escapeHtml(node.hostname),
        renderPill(rebootLabel(state, copy), rebootTone(state)),
        `<span class="mono">${escapeHtml(state.kernelRelease ?? copy.none)}</span>`,
        `<span class="mono">${escapeHtml(state.latestKernelRelease ?? copy.none)}</span>`,
        escapeHtml(formatDuration(state.uptimeSeconds, copy)),
        escapeHtml(formatDate(state.bootedAt, locale)),
        escapeHtml(formatDate(state.checkedAt, locale))
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        state.kernelRelease ?? "",
        state.latestKernelRelease ?? "",
        state.needsRebootReason ?? "",
        state.bootId ?? ""
      ].join(" ")
    };
  });
}

function renderSelectedRebootPanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedRecord: RebootRecord | undefined;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, locale, selectedRecord, formatDate, renderPill } = args;

  if (!selectedRecord) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noReboots)}</p></article>`;
  }

  const { node: selectedNode, item: state } = selectedRecord;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.rebootsSelectedNodeTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    <article class="panel panel-nested detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(selectedNode.nodeId)}</h3>
          <p class="muted section-description">${escapeHtml(state.needsRebootReason ?? copy.rebootsSelectedNodeDescription)}</p>
        </div>
        ${renderPill(rebootLabel(state, copy), rebootTone(state))}
      </div>
      ${renderActionFacts(
        [
          { label: copy.kernelLabel, value: `<span class="mono">${escapeHtml(state.kernelRelease ?? copy.none)}</span>` },
          { label: copy.latestKernelLabel, value: `<span class="mono">${escapeHtml(state.latestKernelRelease ?? copy.none)}</span>` },
          { label: copy.processUptimeLabel, value: escapeHtml(formatDuration(state.uptimeSeconds, copy)) },
          { label: copy.bootedAtLabel, value: escapeHtml(formatDate(state.bootedAt, locale)) },
          { label: copy.bootIdLabel, value: `<span class="mono">${escapeHtml(state.bootId ?? copy.none)}</span>` },
          { label: copy.generatedAt, value: escapeHtml(formatDate(state.checkedAt, locale)) }
        ],
        { className: "action-card-facts-wide-labels" }
      )}
    </article>
  </article>`;
}

export function renderRebootsWorkspace(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  focus?: string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
  renderSignalStrip: (
    items: Array<{
      label: string;
      value: string;
      tone?: "default" | "success" | "danger" | "muted";
    }>
  ) => string;
}): string {
  const {
    copy,
    data,
    locale,
    focus,
    formatDate,
    renderFocusLink,
    renderPill,
    renderSignalStrip
  } = args;
  const rebootRecords = data.nodeHealth.flatMap((node) =>
    node.rebootState
      ? [
          {
            node,
            item: node.rebootState,
            key: node.nodeId
          }
        ]
      : []
  );
  const selectedReboot = selectRuntimeRecord(rebootRecords, focus);
  const rebootRequiredCount = rebootRecords.filter((record) => record.item.needsReboot).length;
  const kernelMismatchCount = rebootRecords.filter(
    (record) =>
      record.item.kernelRelease &&
      record.item.latestKernelRelease &&
      record.item.kernelRelease !== record.item.latestKernelRelease
  ).length;
  const rows = buildRebootRows({
    copy,
    records: rebootRecords,
    selectedRecord: selectedReboot,
    locale,
    formatDate,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-reboots-table",
    heading: copy.rebootsInventoryTitle,
    description: copy.rebootsInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.rebootRequiredLabel },
      { label: copy.kernelLabel, className: "mono" },
      { label: copy.latestKernelLabel, className: "mono" },
      { label: copy.processUptimeLabel },
      { label: copy.bootedAtLabel },
      { label: copy.generatedAt }
    ],
    rows,
    emptyMessage: copy.noReboots,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-reboots" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.rebootsReportedLabel, value: String(rebootRecords.length), tone: rebootRecords.length > 0 ? "success" : "muted" },
      { label: copy.rebootRequiredLabel, value: String(rebootRequiredCount), tone: rebootRequiredCount > 0 ? "danger" : "success" },
      { label: copy.kernelMismatchLabel, value: String(kernelMismatchCount), tone: kernelMismatchCount > 0 ? "danger" : "success" }
    ])}
    ${table}
    ${renderSelectedRebootPanel({
      copy,
      locale,
      selectedRecord: selectedReboot,
      formatDate,
      renderPill
    })}
  </section>`;
}
