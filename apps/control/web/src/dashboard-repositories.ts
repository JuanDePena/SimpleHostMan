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

type PackageRepository = NonNullable<
  DashboardData["nodeHealth"][number]["packageRepositories"]
>["repositories"][number];
type RepositoryRecord = RuntimeSelectionRecord<PackageRepository>;

function booleanStateLabel(
  value: boolean | undefined,
  trueLabel: string,
  falseLabel: string,
  copy: WebCopy
): string {
  if (value === undefined) {
    return copy.notReportedLabel;
  }

  return value ? trueLabel : falseLabel;
}

function booleanTone(value: boolean | undefined): "default" | "success" | "danger" | "muted" {
  if (value === undefined) {
    return "muted";
  }

  return value ? "success" : "danger";
}

function repositoryStatusLabel(repository: PackageRepository, copy: WebCopy): string {
  if (repository.enabled !== undefined) {
    return repository.enabled ? copy.repositoryEnabledLabel : copy.repositoryDisabledLabel;
  }

  return repository.status ?? copy.notReportedLabel;
}

function listLabel(values: string[], copy: WebCopy): string {
  return values.length > 0 ? values.join(", ") : copy.none;
}

function buildRepositoryRows(args: {
  copy: WebCopy;
  records: RepositoryRecord[];
  selectedRecord: RepositoryRecord | undefined;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, records, selectedRecord, renderFocusLink, renderPill } = args;

  return records.map((record) => {
    const { node, item: repository, key } = record;
    const selected = isRuntimeRecordSelected(record, selectedRecord);

    return {
      selectionKey: key,
      selected,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("repositories", undefined, key),
          selected,
          copy.selectedStateLabel
        ),
        escapeHtml(node.hostname),
        `<span class="mono">${escapeHtml(repository.repoId)}</span>`,
        escapeHtml(repository.name ?? copy.none),
        renderPill(repositoryStatusLabel(repository, copy), repository.enabled ? "success" : "muted"),
        escapeHtml(String(repository.packageCount ?? copy.none)),
        renderPill(
          booleanStateLabel(repository.gpgCheck, copy.yesLabel, copy.noLabel, copy),
          booleanTone(repository.gpgCheck)
        ),
        `<span class="mono">${escapeHtml(repository.repoFile ?? copy.none)}</span>`
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        repository.repoId,
        repository.name ?? "",
        repository.status ?? "",
        repository.repoFile ?? "",
        repository.baseUrl ?? "",
        repository.metalink ?? "",
        repository.mirrorList ?? "",
        repository.gpgKeys.join(" ")
      ].join(" ")
    };
  });
}

function renderSelectedRepositoryPanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedRecord: RepositoryRecord | undefined;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, locale, selectedRecord, formatDate, renderPill } = args;

  if (!selectedRecord) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noRepositories)}</p></article>`;
  }

  const { node: selectedNode, item: repository } = selectedRecord;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.repositoriesSelectedTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    <article class="panel panel-nested detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(repository.repoId)}</h3>
          <p class="muted section-description">${escapeHtml(repository.name ?? copy.none)}</p>
        </div>
        ${renderPill(repositoryStatusLabel(repository, copy), repository.enabled ? "success" : "muted")}
      </div>
      ${renderActionFacts(
        [
          { label: copy.repositoryStatusLabel, value: escapeHtml(repository.status ?? copy.none) },
          { label: copy.repositoryEnabledLabel, value: escapeHtml(repositoryStatusLabel(repository, copy)) },
          { label: copy.repositoryPackageCountLabel, value: escapeHtml(String(repository.packageCount ?? copy.none)) },
          { label: copy.repositorySizeLabel, value: escapeHtml(repository.size ?? copy.none) },
          { label: copy.repositoryRevisionLabel, value: escapeHtml(repository.revision ?? copy.none) },
          { label: copy.repositoryUpdatedLabel, value: escapeHtml(repository.updated ?? copy.none) },
          { label: copy.repositoryFileLabel, value: `<span class="mono">${escapeHtml(repository.repoFile ?? copy.none)}</span>` },
          { label: copy.repositoryBaseUrlLabel, value: `<span class="mono">${escapeHtml(repository.baseUrl ?? copy.none)}</span>` },
          { label: copy.repositoryMetalinkLabel, value: `<span class="mono">${escapeHtml(repository.metalink ?? copy.none)}</span>` },
          { label: copy.repositoryMirrorListLabel, value: `<span class="mono">${escapeHtml(repository.mirrorList ?? copy.none)}</span>` },
          {
            label: copy.repositoryGpgLabel,
            value: escapeHtml(booleanStateLabel(repository.gpgCheck, copy.yesLabel, copy.noLabel, copy))
          },
          {
            label: copy.repositoryRepoGpgLabel,
            value: escapeHtml(booleanStateLabel(repository.repoGpgCheck, copy.yesLabel, copy.noLabel, copy))
          },
          { label: copy.repositoryGpgKeysLabel, value: `<span class="mono">${escapeHtml(listLabel(repository.gpgKeys, copy))}</span>` },
          { label: copy.generatedAt, value: escapeHtml(formatDate(selectedNode.packageRepositories?.checkedAt, locale)) }
        ],
        { className: "action-card-facts-wide-labels" }
      )}
    </article>
  </article>`;
}

export function renderRepositoriesWorkspace(args: {
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
  const repositoryRecords = data.nodeHealth.flatMap((node) =>
    (node.packageRepositories?.repositories ?? []).map((repository) => ({
      node,
      item: repository,
      key: `${node.nodeId}:${repository.repoId}`
    }))
  );
  const selectedRepository = selectRuntimeRecord(repositoryRecords, focus);
  const enabledCount = repositoryRecords.filter((record) => record.item.enabled).length;
  const disabledCount = repositoryRecords.filter((record) => record.item.enabled === false).length;
  const gpgDisabledCount = repositoryRecords.filter(
    (record) => record.item.gpgCheck === false
  ).length;
  const rows = buildRepositoryRows({
    copy,
    records: repositoryRecords,
    selectedRecord: selectedRepository,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-repositories-table",
    heading: copy.repositoriesInventoryTitle,
    description: copy.repositoriesInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.repositoryIdLabel, className: "mono" },
      { label: copy.repositoryNameLabel },
      { label: copy.repositoryStatusLabel },
      { label: copy.repositoryPackageCountLabel },
      { label: copy.repositoryGpgLabel },
      { label: copy.repositoryFileLabel, className: "mono" }
    ],
    rows,
    emptyMessage: copy.noRepositories,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-repositories" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.repositoryIdLabel, value: String(repositoryRecords.length), tone: repositoryRecords.length > 0 ? "success" : "muted" },
      { label: copy.repositoryEnabledLabel, value: String(enabledCount), tone: enabledCount > 0 ? "success" : "muted" },
      { label: copy.repositoryDisabledLabel, value: String(disabledCount), tone: disabledCount > 0 ? "muted" : "success" },
      { label: copy.repositoryGpgDisabledLabel, value: String(gpgDisabledCount), tone: gpgDisabledCount > 0 ? "danger" : "success" }
    ])}
    ${table}
    ${renderSelectedRepositoryPanel({
      copy,
      locale,
      selectedRecord: selectedRepository,
      formatDate,
      renderPill
    })}
  </section>`;
}
