import { escapeHtml, type DataTableRow } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl, type DashboardView } from "./dashboard-routing.js";
import { createUniqueSelectOptions } from "./dashboard-utils.js";
import { type DashboardJobFilters } from "./dashboard-view-model.js";
import { type WebCopy } from "./web-copy.js";
import { type WebLocale } from "./request.js";
import { type WorkspaceFilterField } from "./web-types.js";

type CurrentAuditFilters = Pick<
  DashboardJobFilters,
  "auditType" | "auditActor" | "auditEntity"
>;

function formatActorLabel(event: DashboardData["auditEvents"][number]): string {
  return `${event.actorType}:${event.actorId ?? "unknown"}`;
}

function formatEntityKey(event: DashboardData["auditEvents"][number]): string {
  if (event.entityType && event.entityId) {
    return `${event.entityType}:${event.entityId}`;
  }

  return event.entityType ?? event.entityId ?? "";
}

function formatEntityLabel(
  copy: WebCopy,
  event: DashboardData["auditEvents"][number]
): string {
  return formatEntityKey(event) || copy.none;
}

function renderAuditFilterForm(args: {
  copy: WebCopy;
  data: DashboardData;
  auditTypeFilter?: string;
  auditActorFilter?: string;
  auditEntityFilter?: string;
  renderWorkspaceFilterForm: (
    copy: WebCopy,
    props: {
      view: DashboardView;
      clearHref: string;
      fields: WorkspaceFilterField[];
    }
  ) => string;
}): string {
  const {
    copy,
    data,
    auditTypeFilter,
    auditActorFilter,
    auditEntityFilter,
    renderWorkspaceFilterForm
  } = args;

  return renderWorkspaceFilterForm(copy, {
    view: "audit",
    clearHref: buildDashboardViewUrl("audit"),
    fields: [
      {
        name: "auditType",
        label: copy.filterEventLabel,
        value: auditTypeFilter,
        options: createUniqueSelectOptions(data.auditEvents.map((event) => event.eventType))
      },
      {
        name: "auditActor",
        label: copy.filterActorLabel,
        type: "search",
        value: auditActorFilter,
        placeholder: copy.filterActorLabel
      },
      {
        name: "auditEntity",
        label: copy.filterEntityLabel,
        type: "search",
        value: auditEntityFilter,
        placeholder: copy.filterEntityLabel
      }
    ]
  });
}

function buildAuditRows(args: {
  copy: WebCopy;
  locale: WebLocale;
  filteredAuditEvents: DashboardData["auditEvents"];
  selectedAuditEvent: DashboardData["auditEvents"][number] | undefined;
  currentAuditFilters: CurrentAuditFilters;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
}): DataTableRow[] {
  const {
    copy,
    locale,
    filteredAuditEvents,
    selectedAuditEvent,
    currentAuditFilters,
    formatDate,
    renderFocusLink
  } = args;

  return filteredAuditEvents.map((event) => ({
    selectionKey: event.eventId,
    selected: selectedAuditEvent?.eventId === event.eventId,
    cells: [
      renderFocusLink(
        event.eventType,
        buildDashboardViewUrl("audit", undefined, event.eventId, currentAuditFilters),
        selectedAuditEvent?.eventId === event.eventId,
        copy.selectedStateLabel
      ),
      `<span class="mono">${escapeHtml(formatActorLabel(event))}</span>`,
      `<span class="mono">${escapeHtml(formatEntityLabel(copy, event))}</span>`,
      escapeHtml(formatDate(event.occurredAt, locale))
    ],
    searchText: [
      event.eventId,
      event.eventType,
      formatActorLabel(event),
      formatEntityKey(event),
      JSON.stringify(event.payload)
    ].join(" ")
  }));
}

function renderSelectedAuditPanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedAuditEvent: DashboardData["auditEvents"][number] | undefined;
  currentAuditFilters: CurrentAuditFilters;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderCodeBlock: (value: unknown) => string;
  renderDetailGrid: (
    entries: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
}): string {
  const {
    copy,
    locale,
    selectedAuditEvent,
    currentAuditFilters,
    formatDate,
    renderCodeBlock,
    renderDetailGrid
  } = args;

  if (!selectedAuditEvent) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noRelatedRecords)}</p></article>`;
  }

  const actorLabel = formatActorLabel(selectedAuditEvent);
  const entityLabel = formatEntityLabel(copy, selectedAuditEvent);

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.auditTrailTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.auditTrailDescription)}</p>
      </div>
    </div>
    <div>
      <h3>${escapeHtml(selectedAuditEvent.eventType)}</h3>
      <p class="muted mono">${escapeHtml(selectedAuditEvent.eventId)}</p>
    </div>
    ${renderDetailGrid([
      {
        label: copy.filterEventLabel,
        value: `<a class="detail-link" href="${escapeHtml(
          buildDashboardViewUrl("audit", undefined, undefined, {
            ...currentAuditFilters,
            auditType: selectedAuditEvent.eventType
          })
        )}">${escapeHtml(selectedAuditEvent.eventType)}</a>`
      },
      {
        label: copy.filterActorLabel,
        value: `<a class="detail-link mono" href="${escapeHtml(
          buildDashboardViewUrl("audit", undefined, undefined, {
            ...currentAuditFilters,
            auditActor: actorLabel
          })
        )}">${escapeHtml(actorLabel)}</a>`
      },
      {
        label: copy.filterEntityLabel,
        value:
          entityLabel !== copy.none
            ? `<a class="detail-link mono" href="${escapeHtml(
                buildDashboardViewUrl("audit", undefined, undefined, {
                  ...currentAuditFilters,
                  auditEntity: selectedAuditEvent.entityId ?? formatEntityKey(selectedAuditEvent)
                })
              )}">${escapeHtml(entityLabel)}</a>`
            : escapeHtml(copy.none)
      },
      {
        label: copy.jobColCreated,
        value: escapeHtml(formatDate(selectedAuditEvent.occurredAt, locale))
      }
    ])}
    <article class="panel detail-shell panel-nested">
      <h4>${escapeHtml(copy.payloadTitle)}</h4>
      ${renderCodeBlock(selectedAuditEvent.payload)}
    </article>
  </article>`;
}

export function renderAuditWorkspace(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  filteredAuditEvents: DashboardData["auditEvents"];
  selectedAuditEvent: DashboardData["auditEvents"][number] | undefined;
  currentAuditFilters: CurrentAuditFilters;
  auditTypeFilter?: string;
  auditActorFilter?: string;
  auditEntityFilter?: string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderCodeBlock: (value: unknown) => string;
  renderDataTable: (args: {
    id: string;
    heading: string;
    description: string;
    headingBadgeClassName?: string;
    restoreSelectionHref?: boolean;
    columns: Array<{ label: string; className?: string }>;
    rows: DataTableRow[];
    emptyMessage: string;
    filterPlaceholder: string;
    rowsPerPageLabel: string;
    showingLabel: string;
    ofLabel: string;
    recordsLabel: string;
    defaultPageSize?: number;
  }) => string;
  renderDetailGrid: (
    entries: Array<{ label: string; value: string }>,
    options?: { className?: string }
  ) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderSignalStrip: (
    items: Array<{
      label: string;
      value: string;
      tone?: "default" | "success" | "danger" | "muted";
    }>
  ) => string;
  renderWorkspaceFilterForm: (
    copy: WebCopy,
    props: {
      view: DashboardView;
      clearHref: string;
      fields: WorkspaceFilterField[];
    }
  ) => string;
}): string {
  const {
    copy,
    data,
    locale,
    filteredAuditEvents,
    selectedAuditEvent,
    currentAuditFilters,
    auditTypeFilter,
    auditActorFilter,
    auditEntityFilter,
    formatDate,
    renderCodeBlock,
    renderDataTable,
    renderDetailGrid,
    renderFocusLink,
    renderSignalStrip,
    renderWorkspaceFilterForm
  } = args;

  const auditRows = buildAuditRows({
    copy,
    locale,
    filteredAuditEvents,
    selectedAuditEvent,
    currentAuditFilters,
    formatDate,
    renderFocusLink
  });

  const auditFilterForm = renderAuditFilterForm({
    copy,
    data,
    auditTypeFilter,
    auditActorFilter,
    auditEntityFilter,
    renderWorkspaceFilterForm
  });
  const selectedAuditPanel = renderSelectedAuditPanel({
    copy,
    locale,
    selectedAuditEvent,
    currentAuditFilters,
    formatDate,
    renderCodeBlock,
    renderDetailGrid
  });

  const eventTypeCount = new Set(filteredAuditEvents.map((event) => event.eventType)).size;
  const actorCount = new Set(filteredAuditEvents.map((event) => formatActorLabel(event))).size;
  const entityCount = new Set(
    filteredAuditEvents.map((event) => formatEntityKey(event)).filter(Boolean)
  ).size;

  return `<section id="section-audit-history" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.auditTrailTitle, value: String(filteredAuditEvents.length), tone: filteredAuditEvents.length > 0 ? "default" : "muted" },
      { label: copy.auditSignalsTitle, value: String(eventTypeCount), tone: eventTypeCount > 0 ? "default" : "muted" },
      { label: copy.auditActorsTitle, value: String(actorCount), tone: actorCount > 0 ? "default" : "muted" },
      { label: copy.auditEntitiesTitle, value: String(entityCount), tone: entityCount > 0 ? "default" : "muted" }
    ])}
    ${auditFilterForm}
    ${renderDataTable({
      id: "section-audit-history-table",
      heading: copy.auditTrailTitle,
      description: copy.auditTrailDescription,
      headingBadgeClassName: "section-badge-lime",
      restoreSelectionHref: true,
      columns: [
        { label: copy.filterEventLabel },
        { label: copy.filterActorLabel, className: "mono" },
        { label: copy.filterEntityLabel, className: "mono" },
        { label: copy.jobColCreated }
      ],
      rows: auditRows,
      emptyMessage: copy.noRelatedRecords,
      filterPlaceholder: copy.dataFilterPlaceholder,
      rowsPerPageLabel: copy.rowsPerPage,
      showingLabel: copy.showing,
      ofLabel: copy.of,
      recordsLabel: copy.records,
      defaultPageSize: 10
    })}
    ${selectedAuditPanel}
  </section>`;
}
