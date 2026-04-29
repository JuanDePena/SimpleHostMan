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

type PackageUpdate = NonNullable<
  DashboardData["nodeHealth"][number]["packageUpdates"]
>["updates"][number];
type PackageUpdateRecord = RuntimeSelectionRecord<PackageUpdate>;

function packageVersionLabel(update: PackageUpdate, versionKey: "current" | "available", copy: WebCopy): string {
  const version = versionKey === "current" ? update.currentVersion : update.availableVersion;
  const release = versionKey === "current" ? update.currentRelease : update.availableRelease;

  return [version, release].filter(Boolean).join("-") || copy.none;
}

function updateTone(update: PackageUpdate): "default" | "success" | "danger" | "muted" {
  if (update.advisoryType === "security") {
    return "danger";
  }

  return update.availableVersion ? "success" : "muted";
}

function updateAdvisoryLabel(update: PackageUpdate, copy: WebCopy): string {
  return [update.advisoryId, update.advisorySeverity, update.advisoryType]
    .filter(Boolean)
    .join(" / ") || copy.none;
}

function buildPackageUpdateRows(args: {
  copy: WebCopy;
  records: PackageUpdateRecord[];
  selectedRecord: PackageUpdateRecord | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, records, selectedRecord, locale, formatDate, renderFocusLink, renderPill } = args;

  return records.map((record) => {
    const { node, item: update, key } = record;
    const selected = isRuntimeRecordSelected(record, selectedRecord);

    return {
      selectionKey: key,
      selected,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("updates", undefined, key),
          selected,
          copy.selectedStateLabel
        ),
        escapeHtml(node.hostname),
        `<span class="mono">${escapeHtml(update.packageName)}</span>`,
        escapeHtml(update.arch ?? copy.none),
        escapeHtml(packageVersionLabel(update, "current", copy)),
        escapeHtml(packageVersionLabel(update, "available", copy)),
        escapeHtml(update.repository ?? copy.none),
        renderPill(updateAdvisoryLabel(update, copy), updateTone(update)),
        escapeHtml(formatDate(node.packageUpdates?.checkedAt, locale))
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        update.packageName,
        update.arch ?? "",
        update.repository ?? "",
        update.advisoryId ?? "",
        update.advisorySeverity ?? "",
        update.advisoryType ?? "",
        update.summary ?? ""
      ].join(" ")
    };
  });
}

function renderSelectedPackageUpdatePanel(args: {
  copy: WebCopy;
  selectedRecord: PackageUpdateRecord | undefined;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, selectedRecord, renderPill } = args;

  if (!selectedRecord) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noUpdates)}</p></article>`;
  }

  const { node: selectedNode, item: update } = selectedRecord;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.updatesSelectedPackageTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("packages", undefined, `${selectedNode.nodeId}:${update.packageName}:${update.arch ?? ""}`)
      )}">${escapeHtml(copy.navPackages)}</a>
    </div>
    <article class="panel panel-nested detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(update.packageName)}</h3>
          <p class="muted section-description">${escapeHtml(update.summary ?? copy.updatesSelectedPackageDescription)}</p>
        </div>
        ${renderPill(update.advisoryType ?? copy.updateAvailableLabel, updateTone(update))}
      </div>
      ${renderActionFacts(
        [
          { label: copy.packageColNode, value: escapeHtml(selectedNode.nodeId) },
          { label: copy.packageColHostname, value: escapeHtml(selectedNode.hostname) },
          { label: copy.packageColArch, value: escapeHtml(update.arch ?? copy.none) },
          { label: copy.updateCurrentLabel, value: escapeHtml(packageVersionLabel(update, "current", copy)) },
          { label: copy.updateAvailableLabel, value: escapeHtml(packageVersionLabel(update, "available", copy)) },
          { label: copy.updateRepositoryLabel, value: escapeHtml(update.repository ?? copy.none) },
          { label: copy.updateAdvisoryLabel, value: escapeHtml(updateAdvisoryLabel(update, copy)) },
          { label: copy.packageSourceLabel, value: escapeHtml(update.epoch ?? copy.none) }
        ],
        { className: "action-card-facts-wide-labels" }
      )}
    </article>
  </article>`;
}

export function renderUpdatesWorkspace(args: {
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
  const updateRecords = data.nodeHealth.flatMap((node) =>
    (node.packageUpdates?.updates ?? []).map((update) => ({
      node,
      item: update,
      key: `${node.nodeId}:${update.packageName}:${update.arch ?? ""}`
    }))
  );
  const selectedUpdate = selectRuntimeRecord(updateRecords, focus);
  const securityCount = updateRecords.filter(
    (record) => record.item.advisoryType === "security"
  ).length;
  const nodesWithUpdates = data.nodeHealth.filter(
    (node) => (node.packageUpdates?.updates.length ?? 0) > 0
  ).length;
  const rows = buildPackageUpdateRows({
    copy,
    records: updateRecords,
    selectedRecord: selectedUpdate,
    locale,
    formatDate,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-updates-table",
    heading: copy.updatesInventoryTitle,
    description: copy.updatesInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.packageColPackage, className: "mono" },
      { label: copy.packageColArch },
      { label: copy.updateCurrentLabel },
      { label: copy.updateAvailableLabel },
      { label: copy.updateRepositoryLabel },
      { label: copy.updateAdvisoryLabel },
      { label: copy.generatedAt }
    ],
    rows,
    emptyMessage: copy.noUpdates,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-updates" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.nodesWithUpdatesLabel, value: String(nodesWithUpdates), tone: nodesWithUpdates > 0 ? "danger" : "success" },
      { label: copy.updateAvailableLabel, value: String(updateRecords.length), tone: updateRecords.length > 0 ? "danger" : "success" },
      { label: copy.updateSecurityLabel, value: String(securityCount), tone: securityCount > 0 ? "danger" : "success" }
    ])}
    ${table}
    ${renderSelectedPackageUpdatePanel({
      copy,
      selectedRecord: selectedUpdate,
      renderPill
    })}
  </section>`;
}
