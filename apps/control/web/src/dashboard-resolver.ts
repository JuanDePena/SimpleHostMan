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

type DnsResolver = NonNullable<DashboardData["nodeHealth"][number]["dnsResolver"]>;
type DnsResolverRecord = RuntimeSelectionRecord<DnsResolver>;

function formatList(values: string[], copy: WebCopy): string {
  return values.length > 0 ? values.join(", ") : copy.none;
}

function resolverTone(
  resolver: DnsResolver | undefined
): "default" | "success" | "danger" | "muted" {
  if (!resolver) {
    return "muted";
  }

  return resolver.nameservers.length > 0 || resolver.resolvedServers.length > 0
    ? "success"
    : "danger";
}

function resolverLabel(resolver: DnsResolver | undefined, copy: WebCopy): string {
  if (!resolver) {
    return copy.notReportedLabel;
  }

  return resolver.nameservers.length > 0 || resolver.resolvedServers.length > 0
    ? copy.resolverConfiguredLabel
    : copy.resolverMissingLabel;
}

function buildResolverRows(args: {
  copy: WebCopy;
  records: DnsResolverRecord[];
  selectedRecord: DnsResolverRecord | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, records, selectedRecord, locale, formatDate, renderFocusLink, renderPill } = args;

  return records.map((record) => {
    const { node, item: resolver, key } = record;
    const selected = isRuntimeRecordSelected(record, selectedRecord);

    return {
      selectionKey: key,
      selected,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("resolver", undefined, key),
          selected,
          copy.selectedStateLabel
        ),
        escapeHtml(node.hostname),
        renderPill(resolverLabel(resolver, copy), resolverTone(resolver)),
        escapeHtml(formatList(resolver.nameservers, copy)),
        escapeHtml(formatList(resolver.searchDomains, copy)),
        escapeHtml(formatList(resolver.resolvedServers, copy)),
        renderPill(
          resolver.systemdResolvedActive === undefined
            ? copy.notReportedLabel
            : resolver.systemdResolvedActive
              ? copy.yesLabel
              : copy.noLabel,
          resolver.systemdResolvedActive ? "success" : "muted"
        ),
        escapeHtml(formatDate(resolver.checkedAt, locale))
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        ...resolver.nameservers,
        ...resolver.searchDomains,
        ...resolver.options,
        ...resolver.resolvedServers,
        ...resolver.resolvedDomains
      ].join(" ")
    };
  });
}

function renderSelectedResolverPanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedRecord: DnsResolverRecord | undefined;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, locale, selectedRecord, formatDate, renderPill } = args;

  if (!selectedRecord) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noResolver)}</p></article>`;
  }

  const { node: selectedNode, item: resolver } = selectedRecord;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.resolverSelectedNodeTitle)}</h3>
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
          <p class="muted section-description">${escapeHtml(resolver.resolvConfPath)}</p>
        </div>
        ${renderPill(resolverLabel(resolver, copy), resolverTone(resolver))}
      </div>
      ${renderActionFacts(
        [
          { label: copy.resolverNameserversLabel, value: escapeHtml(formatList(resolver.nameservers, copy)) },
          { label: copy.resolverSearchDomainsLabel, value: escapeHtml(formatList(resolver.searchDomains, copy)) },
          { label: copy.resolverOptionsLabel, value: escapeHtml(formatList(resolver.options, copy)) },
          { label: copy.resolverResolvedServersLabel, value: escapeHtml(formatList(resolver.resolvedServers, copy)) },
          { label: copy.resolverResolvedDomainsLabel, value: escapeHtml(formatList(resolver.resolvedDomains, copy)) },
          {
            label: copy.resolverSystemdResolvedLabel,
            value: escapeHtml(
              resolver.systemdResolvedActive === undefined
                ? copy.notReportedLabel
                : resolver.systemdResolvedActive
                  ? copy.yesLabel
                  : copy.noLabel
            )
          },
          { label: copy.generatedAt, value: escapeHtml(formatDate(resolver.checkedAt, locale)) }
        ],
        { className: "action-card-facts-wide-labels" }
      )}
    </article>
  </article>`;
}

export function renderResolverWorkspace(args: {
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
  const resolverRecords = data.nodeHealth.flatMap((node) =>
    node.dnsResolver
      ? [
          {
            node,
            item: node.dnsResolver,
            key: node.nodeId
          }
        ]
      : []
  );
  const selectedResolver = selectRuntimeRecord(resolverRecords, focus);
  const missingResolverCount = resolverRecords.filter(
    (record) => record.item.nameservers.length === 0 && record.item.resolvedServers.length === 0
  ).length;
  const resolvedActiveCount = resolverRecords.filter(
    (record) => record.item.systemdResolvedActive
  ).length;
  const rows = buildResolverRows({
    copy,
    records: resolverRecords,
    selectedRecord: selectedResolver,
    locale,
    formatDate,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-resolver-table",
    heading: copy.resolverInventoryTitle,
    description: copy.resolverInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.configStatusLabel },
      { label: copy.resolverNameserversLabel },
      { label: copy.resolverSearchDomainsLabel },
      { label: copy.resolverResolvedServersLabel },
      { label: copy.resolverSystemdResolvedLabel },
      { label: copy.generatedAt }
    ],
    rows,
    emptyMessage: copy.noResolver,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-resolver" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.rebootsReportedLabel, value: String(resolverRecords.length), tone: resolverRecords.length > 0 ? "success" : "muted" },
      { label: copy.resolverSystemdResolvedLabel, value: String(resolvedActiveCount), tone: resolvedActiveCount > 0 ? "success" : "muted" },
      { label: copy.resolverMissingLabel, value: String(missingResolverCount), tone: missingResolverCount > 0 ? "danger" : "success" }
    ])}
    ${table}
    ${renderSelectedResolverPanel({
      copy,
      locale,
      selectedRecord: selectedResolver,
      formatDate,
      renderPill
    })}
  </section>`;
}
