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

type MountEntry = NonNullable<DashboardData["nodeHealth"][number]["mounts"]>["entries"][number];
type MountRecord = RuntimeSelectionRecord<MountEntry>;

function booleanLabel(value: boolean, trueLabel: string, falseLabel: string): string {
  return value ? trueLabel : falseLabel;
}

function mountStateLabel(mount: MountEntry, copy: WebCopy): string {
  if (mount.mounted) {
    return copy.mountPresentLabel;
  }

  return mount.inFstab ? copy.mountFstabOnlyLabel : copy.mountMissingLabel;
}

function mountStateTone(mount: MountEntry): "default" | "success" | "danger" | "muted" {
  if (mount.mounted) {
    return "success";
  }

  return mount.inFstab ? "danger" : "muted";
}

function optionLabel(options: string[], copy: WebCopy): string {
  return options.length > 0 ? options.join(",") : copy.none;
}

function buildMountRows(args: {
  copy: WebCopy;
  records: MountRecord[];
  selectedRecord: MountRecord | undefined;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, records, selectedRecord, renderFocusLink, renderPill } = args;

  return records.map((record) => {
    const { node, item: mount, key } = record;
    const selected = isRuntimeRecordSelected(record, selectedRecord);

    return {
      selectionKey: key,
      selected,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("mounts", undefined, key),
          selected,
          copy.selectedStateLabel
        ),
        escapeHtml(node.hostname),
        `<span class="mono">${escapeHtml(mount.mountpoint)}</span>`,
        `<span class="mono">${escapeHtml(mount.source ?? mount.fstabSource ?? copy.none)}</span>`,
        escapeHtml(mount.filesystemType ?? mount.fstabType ?? copy.none),
        renderPill(mountStateLabel(mount, copy), mountStateTone(mount)),
        renderPill(
          booleanLabel(mount.inFstab, copy.yesLabel, copy.noLabel),
          mount.inFstab ? "success" : "muted"
        ),
        `<span class="mono">${escapeHtml(optionLabel(mount.options, copy))}</span>`
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        mount.mountpoint,
        mount.source ?? "",
        mount.filesystemType ?? "",
        mount.options.join(" "),
        mount.fstabSource ?? "",
        mount.fstabType ?? "",
        mount.fstabOptions.join(" ")
      ].join(" ")
    };
  });
}

function renderSelectedMountPanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedRecord: MountRecord | undefined;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, locale, selectedRecord, formatDate, renderPill } = args;

  if (!selectedRecord) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noMounts)}</p></article>`;
  }

  const { node: selectedNode, item: mount } = selectedRecord;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.mountsSelectedTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    <article class="panel panel-nested detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(mount.mountpoint)}</h3>
          <p class="muted section-description">${escapeHtml(mount.source ?? mount.fstabSource ?? copy.none)}</p>
        </div>
        ${renderPill(mountStateLabel(mount, copy), mountStateTone(mount))}
      </div>
      ${renderActionFacts(
        [
          { label: copy.mountSourceLabel, value: `<span class="mono">${escapeHtml(mount.source ?? copy.none)}</span>` },
          { label: copy.mountFsTypeLabel, value: escapeHtml(mount.filesystemType ?? copy.none) },
          { label: copy.mountMountedLabel, value: escapeHtml(booleanLabel(mount.mounted, copy.yesLabel, copy.noLabel)) },
          { label: copy.mountOptionsLabel, value: `<span class="mono">${escapeHtml(optionLabel(mount.options, copy))}</span>` },
          { label: copy.mountFstabLabel, value: escapeHtml(booleanLabel(mount.inFstab, copy.yesLabel, copy.noLabel)) },
          { label: copy.mountFstabSourceLabel, value: `<span class="mono">${escapeHtml(mount.fstabSource ?? copy.none)}</span>` },
          { label: copy.mountFstabTypeLabel, value: escapeHtml(mount.fstabType ?? copy.none) },
          { label: copy.mountFstabOptionsLabel, value: `<span class="mono">${escapeHtml(optionLabel(mount.fstabOptions, copy))}</span>` },
          { label: copy.mountDumpPassLabel, value: escapeHtml([mount.fstabDump, mount.fstabPass].filter(Boolean).join("/") || copy.none) },
          { label: copy.generatedAt, value: escapeHtml(formatDate(selectedNode.mounts?.checkedAt, locale)) }
        ],
        { className: "action-card-facts-wide-labels" }
      )}
    </article>
  </article>`;
}

export function renderMountsWorkspace(args: {
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
  const mountRecords = data.nodeHealth.flatMap((node) =>
    (node.mounts?.entries ?? []).map((mount) => ({
      node,
      item: mount,
      key: `${node.nodeId}:${mount.mountpoint}`
    }))
  );
  const selectedMount = selectRuntimeRecord(mountRecords, focus);
  const fstabCount = mountRecords.filter((record) => record.item.inFstab).length;
  const missingCount = mountRecords.filter(
    (record) => record.item.inFstab && !record.item.mounted
  ).length;
  const mountedCount = mountRecords.filter((record) => record.item.mounted).length;
  const rows = buildMountRows({
    copy,
    records: mountRecords,
    selectedRecord: selectedMount,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-mounts-table",
    heading: copy.mountsInventoryTitle,
    description: copy.mountsInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.mountpointLabel, className: "mono" },
      { label: copy.mountSourceLabel, className: "mono" },
      { label: copy.mountFsTypeLabel },
      { label: copy.mountMountedLabel },
      { label: copy.mountFstabLabel },
      { label: copy.mountOptionsLabel, className: "mono" }
    ],
    rows,
    emptyMessage: copy.noMounts,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-mounts" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.mountpointLabel, value: String(mountRecords.length), tone: mountRecords.length > 0 ? "success" : "muted" },
      { label: copy.mountMountedLabel, value: String(mountedCount), tone: mountedCount > 0 ? "success" : "muted" },
      { label: copy.mountFstabLabel, value: String(fstabCount), tone: fstabCount > 0 ? "success" : "muted" },
      { label: copy.mountMissingLabel, value: String(missingCount), tone: missingCount > 0 ? "danger" : "success" }
    ])}
    ${table}
    ${renderSelectedMountPanel({
      copy,
      locale,
      selectedRecord: selectedMount,
      formatDate,
      renderPill
    })}
  </section>`;
}
