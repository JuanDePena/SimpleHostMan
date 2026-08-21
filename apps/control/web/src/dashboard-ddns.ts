import {
  escapeHtml,
  renderDataTable,
  type DataTableRow
} from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { type WebLocale } from "./request.js";
import { type WebCopy } from "./web-copy.js";

type DdnsHost = DashboardData["ddns"]["hosts"][number];

function selectDdnsHost(hosts: DdnsHost[], focus: string | undefined): DdnsHost | undefined {
  return hosts.find((host) => host.hostname === focus) ?? hosts[0];
}

function hostTone(host: DdnsHost): "success" | "muted" {
  return host.enabled ? "success" : "muted";
}

function renderZoneOptions(
  data: DashboardData,
  selectedZoneName: string | undefined,
  blankLabel: string
): string {
  const zoneOptions = data.desiredState.spec.zones
    .map((zone) => zone.zoneName)
    .sort((left, right) => left.localeCompare(right));

  return [
    `<option value="">${escapeHtml(blankLabel)}</option>`,
    ...zoneOptions.map(
      (zoneName) =>
        `<option value="${escapeHtml(zoneName)}"${
          zoneName === selectedZoneName ? " selected" : ""
        }>${escapeHtml(zoneName)}</option>`
    )
  ].join("");
}

function buildUniFiServerValue(host: DdnsHost | undefined): string {
  const zoneName = host?.zoneName ?? "ddns.pyrosa.com.do";
  return `https://${zoneName}/nic/update?hostname=%h&myip=%i`;
}

function buildRows(args: {
  copy: WebCopy;
  hosts: DdnsHost[];
  selectedHost: DdnsHost | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, hosts, selectedHost, locale, formatDate, renderFocusLink, renderPill } = args;

  return hosts.map((host) => {
    const selected = host.hostname === selectedHost?.hostname;

    return {
      selectionKey: host.hostname,
      selected,
      cells: [
        renderFocusLink(
          host.hostname,
          buildDashboardViewUrl("ddns", undefined, host.hostname),
          selected,
          copy.selectedStateLabel
        ),
        `<span class="mono">${escapeHtml(host.zoneName)}</span>`,
        renderPill(host.recordType),
        `<span class="mono">${escapeHtml(host.lastIp ?? copy.none)}</span>`,
        renderPill(host.enabled ? copy.ddnsEnabledLabel : copy.ddnsDisabledLabel, hostTone(host)),
        escapeHtml(formatDate(host.lastUpdatedAt ?? host.lastSeenAt, locale))
      ],
      searchText: [
        host.hostname,
        host.zoneName,
        host.recordName,
        host.recordType,
        host.username,
        host.lastIp ?? "",
        host.enabled ? "enabled" : "disabled"
      ].join(" ")
    };
  });
}

function renderCreatePanel(args: {
  copy: WebCopy;
  data: DashboardData;
  currentPath: string;
}): string {
  const { copy, data, currentPath } = args;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.ddnsCreateTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.ddnsCreateDescription)}</p>
      </div>
    </div>
    <form method="post" action="/actions/ddns/upsert" class="stack">
      <input type="hidden" name="returnTo" value="${escapeHtml(currentPath)}" />
      <div class="form-grid">
        <label class="form-field-span-full">
          <span>${escapeHtml(copy.ddnsHostnameLabel)}</span>
          <input name="hostname" required spellcheck="false" class="mono" placeholder="router.ddns.pyrosa.com.do" />
        </label>
        <label>
          <span>${escapeHtml(copy.ddnsZoneLabel)}</span>
          <select name="zoneName" data-native-select="true">
            ${renderZoneOptions(data, undefined, copy.ddnsAutoZoneLabel)}
          </select>
        </label>
        <label>
          <span>${escapeHtml(copy.ddnsRecordTypeLabel)}</span>
          <select name="recordType" data-native-select="true">
            <option value="A" selected>A</option>
            <option value="AAAA">AAAA</option>
          </select>
        </label>
        <label>
          <span>${escapeHtml(copy.ddnsUsernameLabel)}</span>
          <input name="username" required spellcheck="false" class="mono" />
        </label>
        <label>
          <span>${escapeHtml(copy.ddnsPasswordLabel)}</span>
          <input name="password" required autocomplete="new-password" spellcheck="false" class="mono" />
        </label>
        <label>
          <span>${escapeHtml(copy.ddnsTtlLabel)}</span>
          <input name="ttl" type="number" min="60" max="86400" value="300" required />
        </label>
      </div>
      <label class="checkbox-inline">
        <input type="checkbox" name="enabled" checked />
        <span>${escapeHtml(copy.ddnsEnabledLabel)}</span>
      </label>
      <div class="toolbar">
        <button type="submit">${escapeHtml(copy.ddnsCreateAction)}</button>
      </div>
    </form>
  </article>`;
}

function renderSelectedPanel(args: {
  copy: WebCopy;
  data: DashboardData;
  currentPath: string;
  selectedHost: DdnsHost | undefined;
  locale: WebLocale;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderDetailGrid: (entries: Array<{ label: string; value: string; className?: string }>) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, data, currentPath, selectedHost, locale, formatDate, renderDetailGrid, renderPill } =
    args;

  if (!selectedHost) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.ddnsNoHosts)}</p></article>`;
  }

  const serverValue = buildUniFiServerValue(selectedHost);

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(selectedHost.hostname)}</h3>
        <p class="muted section-description">${escapeHtml(copy.ddnsSelectedDescription)}</p>
      </div>
    </div>
    ${renderDetailGrid([
      {
        label: copy.ddnsHostnameLabel,
        value: `<span class="mono">${escapeHtml(selectedHost.hostname)}</span>`
      },
      {
        label: copy.ddnsZoneLabel,
        value: `<span class="mono">${escapeHtml(selectedHost.zoneName)}</span>`
      },
      {
        label: copy.ddnsRecordNameLabel,
        value: `<span class="mono">${escapeHtml(selectedHost.recordName)}</span>`
      },
      {
        label: copy.ddnsRecordTypeLabel,
        value: renderPill(selectedHost.recordType)
      },
      {
        label: copy.ddnsUsernameLabel,
        value: `<span class="mono">${escapeHtml(selectedHost.username)}</span>`
      },
      {
        label: copy.ddnsCurrentIpLabel,
        value: `<span class="mono">${escapeHtml(selectedHost.lastIp ?? copy.none)}</span>`
      },
      {
        label: copy.ddnsStatusLabel,
        value: renderPill(
          selectedHost.enabled ? copy.ddnsEnabledLabel : copy.ddnsDisabledLabel,
          hostTone(selectedHost)
        )
      },
      {
        label: copy.ddnsLastSeenLabel,
        value: escapeHtml(formatDate(selectedHost.lastSeenAt, locale))
      },
      {
        label: copy.ddnsLastUpdatedLabel,
        value: escapeHtml(formatDate(selectedHost.lastUpdatedAt, locale))
      },
      {
        label: copy.ddnsTtlLabel,
        value: escapeHtml(String(selectedHost.ttl))
      }
    ])}
    <div class="grid grid-two">
      <div class="action-card-context">
        <span class="action-card-context-title">${escapeHtml(copy.ddnsUnifiTitle)}</span>
        <p class="muted">${escapeHtml(copy.ddnsUnifiDescription)}</p>
        <pre class="code-block">${escapeHtml([
          "Service: Custom",
          `Hostname: ${selectedHost.hostname}`,
          `Username: ${selectedHost.username}`,
          "Password: <DDNS password>",
          `Server: ${serverValue}`
        ].join("\n"))}</pre>
      </div>
      <div class="stack">
        <div>
          <h4>${escapeHtml(copy.ddnsEditTitle)}</h4>
          <p class="muted section-description">${escapeHtml(copy.ddnsEditDescription)}</p>
        </div>
        <form method="post" action="/actions/ddns/upsert" class="stack">
          <input type="hidden" name="returnTo" value="${escapeHtml(currentPath)}" />
          <input type="hidden" name="hostname" value="${escapeHtml(selectedHost.hostname)}" />
          <div class="form-grid">
            <label>
              <span>${escapeHtml(copy.ddnsHostnameLabel)}</span>
              <input value="${escapeHtml(selectedHost.hostname)}" disabled class="mono" />
            </label>
            <label>
              <span>${escapeHtml(copy.ddnsZoneLabel)}</span>
              <select name="zoneName" data-native-select="true">
                ${renderZoneOptions(data, selectedHost.zoneName, copy.ddnsAutoZoneLabel)}
              </select>
            </label>
            <label>
              <span>${escapeHtml(copy.ddnsRecordTypeLabel)}</span>
              <select name="recordType" data-native-select="true">
                <option value="A"${selectedHost.recordType === "A" ? " selected" : ""}>A</option>
                <option value="AAAA"${selectedHost.recordType === "AAAA" ? " selected" : ""}>AAAA</option>
              </select>
            </label>
            <label>
              <span>${escapeHtml(copy.ddnsUsernameLabel)}</span>
              <input name="username" value="${escapeHtml(selectedHost.username)}" required spellcheck="false" class="mono" />
            </label>
            <label>
              <span>${escapeHtml(copy.ddnsPasswordLabel)}</span>
              <input name="password" autocomplete="new-password" spellcheck="false" class="mono" placeholder="${escapeHtml(copy.ddnsKeepPasswordPlaceholder)}" />
            </label>
            <label>
              <span>${escapeHtml(copy.ddnsTtlLabel)}</span>
              <input name="ttl" type="number" min="60" max="86400" value="${escapeHtml(String(selectedHost.ttl))}" required />
            </label>
          </div>
          <label class="checkbox-inline">
            <input type="checkbox" name="enabled"${selectedHost.enabled ? " checked" : ""} />
            <span>${escapeHtml(copy.ddnsEnabledLabel)}</span>
          </label>
          <div class="toolbar">
            <button type="submit">${escapeHtml(copy.ddnsSaveAction)}</button>
          </div>
        </form>
        <form method="post" action="/actions/ddns/delete" class="toolbar">
          <input type="hidden" name="returnTo" value="${escapeHtml(buildDashboardViewUrl("ddns"))}" />
          <input type="hidden" name="hostname" value="${escapeHtml(selectedHost.hostname)}" />
          <button
            type="submit"
            class="danger"
            data-confirm="${escapeHtml(`Delete DDNS host ${selectedHost.hostname}? The current DNS record will remain unmanaged.`)}"
          >${escapeHtml(copy.ddnsDeleteAction)}</button>
        </form>
      </div>
    </div>
  </article>`;
}

export function renderDdnsWorkspace(args: {
  copy: WebCopy;
  data: DashboardData;
  locale: WebLocale;
  currentPath: string;
  focus?: string;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderDetailGrid: (entries: Array<{ label: string; value: string; className?: string }>) => string;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
  renderSignalStrip: (
    entries: Array<{ label: string; value: string; tone?: "default" | "success" | "danger" | "muted" }>
  ) => string;
}): string {
  const {
    copy,
    data,
    locale,
    currentPath,
    focus,
    formatDate,
    renderDetailGrid,
    renderFocusLink,
    renderPill,
    renderSignalStrip
  } = args;
  const hosts = [...data.ddns.hosts].sort((left, right) =>
    left.hostname.localeCompare(right.hostname)
  );
  const selectedHost = selectDdnsHost(hosts, focus);
  const enabledCount = hosts.filter((host) => host.enabled).length;
  const observedCount = hosts.filter((host) => host.lastIp).length;
  const rows = buildRows({
    copy,
    hosts,
    selectedHost,
    locale,
    formatDate,
    renderFocusLink,
    renderPill
  });

  return `<div class="stack">
    ${renderSignalStrip([
      { label: copy.ddnsHostsLabel, value: String(hosts.length) },
      { label: copy.ddnsEnabledHostsLabel, value: String(enabledCount), tone: "success" },
      { label: copy.ddnsObservedHostsLabel, value: String(observedCount), tone: observedCount > 0 ? "success" : "muted" }
    ])}
    <div class="grid grid-two-desktop">
      ${renderDataTable({
        id: "ddns-hosts",
        heading: copy.ddnsWorkspaceTitle,
        description: copy.ddnsWorkspaceDescription,
        columns: [
          { label: copy.ddnsHostnameLabel },
          { label: copy.ddnsZoneLabel },
          { label: copy.ddnsRecordTypeLabel },
          { label: copy.ddnsCurrentIpLabel },
          { label: copy.ddnsStatusLabel },
          { label: copy.ddnsLastUpdatedLabel }
        ],
        rows,
        emptyMessage: copy.ddnsNoHosts,
        filterPlaceholder: copy.dataFilterPlaceholder,
        rowsPerPageLabel: copy.rowsPerPage,
        showingLabel: copy.showing,
        ofLabel: copy.of,
        recordsLabel: copy.records,
        defaultPageSize: 10,
        restoreSelectionHref: true
      })}
      <div class="stack">
        ${renderCreatePanel({ copy, data, currentPath })}
        ${renderSelectedPanel({
          copy,
          data,
          currentPath,
          selectedHost,
          locale,
          formatDate,
          renderDetailGrid,
          renderPill
        })}
      </div>
    </div>
  </div>`;
}
