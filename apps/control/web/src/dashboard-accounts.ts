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

type LocalAccount = NonNullable<DashboardData["nodeHealth"][number]["accounts"]>["users"][number];
type AccountRecord = RuntimeSelectionRecord<LocalAccount>;

function booleanLabel(value: boolean | undefined, copy: WebCopy): string {
  if (value === undefined) {
    return copy.notReportedLabel;
  }

  return value ? copy.yesLabel : copy.noLabel;
}

function buildAccountRows(args: {
  copy: WebCopy;
  records: AccountRecord[];
  selectedRecord: AccountRecord | undefined;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): DataTableRow[] {
  const { copy, records, selectedRecord, renderFocusLink, renderPill } = args;

  return records.map((record) => {
    const { node, item: account, key } = record;
    const selected = isRuntimeRecordSelected(record, selectedRecord);

    return {
      selectionKey: key,
      selected,
      cells: [
        renderFocusLink(
          node.nodeId,
          buildDashboardViewUrl("accounts", undefined, key),
          selected,
          copy.selectedStateLabel
        ),
        escapeHtml(node.hostname),
        `<span class="mono">${escapeHtml(account.username)}</span>`,
        `<span class="mono">${escapeHtml(String(account.uid))}</span>`,
        `<span class="mono">${escapeHtml(String(account.gid))}</span>`,
        renderPill(
          booleanLabel(account.loginEnabled, copy),
          account.loginEnabled ? "danger" : "muted"
        ),
        renderPill(
          account.systemAccount ? copy.accountSystemLabel : copy.accountHumanLabel,
          account.systemAccount ? "muted" : "success"
        ),
        escapeHtml(account.shell ?? copy.none)
      ],
      searchText: [
        node.nodeId,
        node.hostname,
        account.username,
        String(account.uid),
        String(account.gid),
        account.gecos ?? "",
        account.homeDirectory ?? "",
        account.shell ?? "",
        account.passwordStatus ?? ""
      ].join(" ")
    };
  });
}

function formatAdminGroups(node: DashboardData["nodeHealth"][number], copy: WebCopy): string {
  const groups = node.accounts?.adminGroups ?? [];

  if (groups.length === 0) {
    return copy.none;
  }

  return groups
    .map((group) =>
      `${group.groupName}${group.members.length > 0 ? `: ${group.members.join(", ")}` : ""}`
    )
    .join("; ");
}

function renderSelectedAccountPanel(args: {
  copy: WebCopy;
  locale: WebLocale;
  selectedRecord: AccountRecord | undefined;
  formatDate: (value: string | undefined, locale: WebLocale) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
}): string {
  const { copy, locale, selectedRecord, formatDate, renderPill } = args;

  if (!selectedRecord) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.noAccounts)}</p></article>`;
  }

  const { node: selectedNode, item: account } = selectedRecord;
  const accounts = selectedNode.accounts;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.accountsSelectedUserTitle)}</h3>
        <p class="muted section-description">${escapeHtml(selectedNode.hostname)}</p>
      </div>
      <a class="button-link secondary" href="${escapeHtml(
        buildDashboardViewUrl("node-health", undefined, selectedNode.nodeId)
      )}">${escapeHtml(copy.openNodeHealth)}</a>
    </div>
    <article class="panel panel-nested detail-shell">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(account.username)}</h3>
          <p class="muted section-description">${escapeHtml(account.gecos ?? copy.accountsSelectedUserDescription)}</p>
        </div>
        ${renderPill(
          account.loginEnabled ? copy.accountLoginEnabledLabel : copy.accountLoginDisabledLabel,
          account.loginEnabled ? "danger" : "success"
        )}
      </div>
      ${renderActionFacts(
        [
          { label: copy.accountUidLabel, value: escapeHtml(String(account.uid)) },
          { label: copy.accountGidLabel, value: escapeHtml(String(account.gid)) },
          { label: copy.accountHomeLabel, value: `<span class="mono">${escapeHtml(account.homeDirectory ?? copy.none)}</span>` },
          { label: copy.accountShellLabel, value: `<span class="mono">${escapeHtml(account.shell ?? copy.none)}</span>` },
          { label: copy.accountPasswordStatusLabel, value: escapeHtml(account.passwordStatus ?? copy.none) },
          { label: copy.accountSystemLabel, value: escapeHtml(booleanLabel(account.systemAccount, copy)) },
          { label: copy.accountAdminGroupsLabel, value: escapeHtml(formatAdminGroups(selectedNode, copy)) },
          {
            label: copy.accountSudoersLabel,
            value: escapeHtml(
              accounts?.sudoersValid === undefined
                ? copy.notReportedLabel
                : accounts.sudoersValid
                  ? copy.configPassedLabel
                  : copy.configFailedLabel
            )
          },
          { label: copy.configSummaryLabel, value: escapeHtml(accounts?.sudoersSummary ?? copy.none) },
          { label: copy.generatedAt, value: escapeHtml(formatDate(accounts?.checkedAt, locale)) }
        ],
        { className: "action-card-facts-wide-labels" }
      )}
    </article>
  </article>`;
}

export function renderAccountsWorkspace(args: {
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
  const accountRecords = data.nodeHealth.flatMap((node) =>
    (node.accounts?.users ?? []).map((account) => ({
      node,
      item: account,
      key: `${node.nodeId}:${account.username}`
    }))
  );
  const selectedAccount = selectRuntimeRecord(accountRecords, focus);
  const loginEnabledCount = accountRecords.filter((record) => record.item.loginEnabled).length;
  const uidZeroCount = accountRecords.filter((record) => record.item.uid === 0).length;
  const failedSudoersCount = data.nodeHealth.filter(
    (node) => node.accounts?.sudoersValid === false
  ).length;
  const rows = buildAccountRows({
    copy,
    records: accountRecords,
    selectedRecord: selectedAccount,
    renderFocusLink,
    renderPill
  });

  const table = renderDataTable({
    id: "section-accounts-table",
    heading: copy.accountsInventoryTitle,
    description: copy.accountsInventoryDescription,
    headingBadgeClassName: "section-badge-lime",
    columns: [
      { label: copy.filterNodeLabel, className: "mono" },
      { label: copy.packageColHostname },
      { label: copy.accountUsernameLabel, className: "mono" },
      { label: copy.accountUidLabel, className: "mono" },
      { label: copy.accountGidLabel, className: "mono" },
      { label: copy.accountLoginEnabledLabel },
      { label: copy.accountTypeLabel },
      { label: copy.accountShellLabel }
    ],
    rows,
    emptyMessage: copy.noAccounts,
    filterPlaceholder: copy.dataFilterPlaceholder,
    rowsPerPageLabel: copy.rowsPerPage,
    showingLabel: copy.showing,
    ofLabel: copy.of,
    recordsLabel: copy.records,
    defaultPageSize: 25
  });

  return `<section id="section-accounts" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.managedNodes, value: String(data.nodeHealth.length), tone: data.nodeHealth.length > 0 ? "success" : "muted" },
      { label: copy.accountUsernameLabel, value: String(accountRecords.length), tone: accountRecords.length > 0 ? "success" : "muted" },
      { label: copy.accountLoginEnabledLabel, value: String(loginEnabledCount), tone: loginEnabledCount > 0 ? "danger" : "success" },
      { label: copy.accountUidZeroLabel, value: String(uidZeroCount), tone: uidZeroCount > 1 ? "danger" : "success" },
      { label: copy.accountSudoersLabel, value: String(failedSudoersCount), tone: failedSudoersCount > 0 ? "danger" : "success" }
    ])}
    ${table}
    ${renderSelectedAccountPanel({
      copy,
      locale,
      selectedRecord: selectedAccount,
      formatDate,
      renderPill
    })}
  </section>`;
}
