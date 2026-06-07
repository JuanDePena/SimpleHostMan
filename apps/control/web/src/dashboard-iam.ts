import {
  escapeHtml,
  renderDataTable,
  type DataTableRow
} from "@simplehost/ui";

import {
  iamAuthModes,
  iamBindingStatuses,
  iamMfaPolicies,
  type IamBindingSummary,
  type IamProviderSummary
} from "@simplehost/control-contracts";

import { type DashboardData } from "./api-client.js";
import { renderSelectOptions } from "./dashboard-formatters.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { renderActionFacts } from "./panel-renderers.js";
import { type WebCopy } from "./web-copy.js";

function toneForStatus(status: string): "default" | "success" | "danger" | "muted" {
  switch (status) {
    case "active":
      return "success";
    case "disabled":
      return "danger";
    case "candidate":
      return "default";
    default:
      return "muted";
  }
}

function renderList(values: string[], emptyValue: string): string {
  return values.length > 0 ? escapeHtml(values.join(", ")) : escapeHtml(emptyValue);
}

function selectBinding(
  bindings: IamBindingSummary[],
  focus: string | undefined
): IamBindingSummary | undefined {
  return (
    bindings.find(
      (binding) =>
        binding.bindingId === focus ||
        binding.targetSlug === focus ||
        `${binding.targetKind}:${binding.targetSlug}` === focus
    ) ?? bindings[0]
  );
}

function buildProviderRows(args: {
  providers: IamProviderSummary[];
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
  copy: WebCopy;
}): DataTableRow[] {
  const { providers, renderPill, copy } = args;

  return providers.map((provider) => ({
    selectionKey: provider.slug,
    cells: [
      `<span class="mono">${escapeHtml(provider.slug)}</span>`,
      escapeHtml(provider.displayName),
      renderPill(provider.status, toneForStatus(provider.status)),
      renderList(provider.capabilities, copy.none),
      provider.baseUrl ? `<span class="mono">${escapeHtml(provider.baseUrl)}</span>` : escapeHtml(copy.none)
    ],
    searchText: [
      provider.slug,
      provider.displayName,
      provider.status,
      provider.capabilities.join(" "),
      provider.baseUrl ?? "",
      provider.notes ?? ""
    ].join(" ")
  }));
}

function buildBindingRows(args: {
  bindings: IamBindingSummary[];
  selectedBinding: IamBindingSummary | undefined;
  renderFocusLink: (label: string, href: string, active: boolean, activeLabel: string) => string;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
  copy: WebCopy;
}): DataTableRow[] {
  const { bindings, selectedBinding, renderFocusLink, renderPill, copy } = args;

  return bindings.map((binding) => {
    const selected = binding.bindingId === selectedBinding?.bindingId;

    return {
      selectionKey: binding.bindingId,
      selected,
      cells: [
        renderFocusLink(
          `${binding.targetKind}:${binding.targetSlug}`,
          buildDashboardViewUrl("iam", undefined, binding.bindingId),
          selected,
          copy.selectedStateLabel
        ),
        escapeHtml(binding.providerDisplayName),
        renderPill(binding.authMode, binding.authMode === "ui_auth" ? "success" : "default"),
        renderPill(binding.mfaPolicy, binding.mfaPolicy === "required" ? "success" : "muted"),
        renderPill(binding.status, toneForStatus(binding.status))
      ],
      searchText: [
        binding.targetKind,
        binding.targetSlug,
        binding.providerSlug,
        binding.providerDisplayName,
        binding.authMode,
        binding.mfaPolicy,
        binding.status,
        binding.externalUrl ?? "",
        binding.notes ?? ""
      ].join(" ")
    };
  });
}

function renderBindingDetailPanel(args: {
  binding: IamBindingSummary | undefined;
  providers: IamProviderSummary[];
  currentPath: string;
  currentUserIsAdmin: boolean;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
  copy: WebCopy;
}): string {
  const { binding, providers, currentPath, currentUserIsAdmin, renderPill, copy } = args;

  if (!binding) {
    return `<article class="panel"><p class="empty">${escapeHtml(copy.iamNoBindings)}</p></article>`;
  }

  const authModeOptions = iamAuthModes.map((mode) => ({
    value: mode,
    label: mode
  }));
  const disabledAttribute = currentUserIsAdmin ? "" : " disabled";

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.iamSelectedBindingTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.iamSelectedBindingDescription)}</p>
      </div>
      ${renderPill(binding.status, toneForStatus(binding.status))}
    </div>
    ${renderActionFacts(
      [
        {
          label: copy.iamTargetLabel,
          value: `<span class="mono">${escapeHtml(`${binding.targetKind}:${binding.targetSlug}`)}</span>`
        },
        {
          label: copy.iamExternalUrlLabel,
          value: binding.externalUrl
            ? `<span class="mono">${escapeHtml(binding.externalUrl)}</span>`
            : escapeHtml(copy.none)
        },
        {
          label: copy.iamInternalUrlLabel,
          value: binding.internalUrl
            ? `<span class="mono">${escapeHtml(binding.internalUrl)}</span>`
            : escapeHtml(copy.none)
        },
        {
          label: copy.iamAllowedGroupsLabel,
          value: renderList(binding.allowedGroups, copy.none)
        }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
    <form method="post" action="/actions/iam/binding" class="stack">
      <input type="hidden" name="returnTo" value="${escapeHtml(currentPath)}" />
      <input type="hidden" name="bindingId" value="${escapeHtml(binding.bindingId)}" />
      <div class="form-grid">
        <label>
          <span>${escapeHtml(copy.iamProviderLabel)}</span>
          <select name="providerSlug"${disabledAttribute}>
            ${renderSelectOptions(
              providers.map((provider) => ({
                value: provider.slug,
                label: provider.displayName
              })),
              binding.providerSlug
            )}
          </select>
        </label>
        <label>
          <span>${escapeHtml(copy.iamAuthModeLabel)}</span>
          <select name="authMode"${disabledAttribute}>
            ${renderSelectOptions(authModeOptions, binding.authMode)}
          </select>
        </label>
        <label>
          <span>${escapeHtml(copy.iamMfaPolicyLabel)}</span>
          <select name="mfaPolicy"${disabledAttribute}>
            ${renderSelectOptions(
              iamMfaPolicies.map((policy) => ({ value: policy, label: policy })),
              binding.mfaPolicy
            )}
          </select>
        </label>
        <label>
          <span>${escapeHtml(copy.iamStatusLabel)}</span>
          <select name="status"${disabledAttribute}>
            ${renderSelectOptions(
              iamBindingStatuses.map((status) => ({ value: status, label: status })),
              binding.status
            )}
          </select>
        </label>
      </div>
      ${
        currentUserIsAdmin
          ? `<div class="toolbar"><button type="submit">${escapeHtml(copy.iamSaveBindingAction)}</button></div>`
          : `<p class="empty">${escapeHtml(copy.iamAdminRequired)}</p>`
      }
    </form>
    ${binding.notes ? `<p class="muted">${escapeHtml(binding.notes)}</p>` : ""}
  </article>`;
}

export function renderIamWorkspace(args: {
  copy: WebCopy;
  data: DashboardData;
  currentPath: string;
  focus?: string;
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
  const { copy, data, currentPath, focus, renderFocusLink, renderPill, renderSignalStrip } = args;
  const providers = data.iam.providers;
  const bindings = data.iam.bindings;
  const activeBindings = bindings.filter((binding) => binding.status === "active");
  const selectedBinding = selectBinding(bindings, focus);
  const currentUserIsAdmin = data.currentUser.globalRoles.includes("platform_admin");

  return `<section id="section-iam" class="panel section-panel">
    ${renderSignalStrip([
      { label: copy.iamProvidersTitle, value: String(providers.length), tone: providers.length > 0 ? "success" : "muted" },
      { label: copy.iamBindingsTitle, value: String(bindings.length), tone: bindings.length > 0 ? "success" : "muted" },
      { label: copy.iamActiveBindingsLabel, value: String(activeBindings.length), tone: activeBindings.length > 0 ? "success" : "muted" },
      { label: copy.iamPyrosaAccountsLabel, value: providers.some((provider) => provider.slug === "pyrosa-accounts") ? copy.availableLabel : copy.unavailableLabel, tone: providers.some((provider) => provider.slug === "pyrosa-accounts") ? "success" : "muted" }
    ])}
    ${renderDataTable({
      id: "section-iam-providers-table",
      heading: copy.iamProvidersTitle,
      description: copy.iamProvidersDescription,
      headingBadgeClassName: "section-badge-lime",
      columns: [
        { label: copy.iamProviderLabel, className: "mono" },
        { label: copy.iamDisplayNameLabel },
        { label: copy.iamStatusLabel },
        { label: copy.iamCapabilitiesLabel },
        { label: copy.iamBaseUrlLabel, className: "mono" }
      ],
      rows: buildProviderRows({ providers, renderPill, copy }),
      emptyMessage: copy.iamNoProviders,
      filterPlaceholder: copy.dataFilterPlaceholder,
      rowsPerPageLabel: copy.rowsPerPage,
      showingLabel: copy.showing,
      ofLabel: copy.of,
      recordsLabel: copy.records,
      defaultPageSize: 10
    })}
    <div class="grid-two-desktop">
      ${renderDataTable({
        id: "section-iam-bindings-table",
        heading: copy.iamBindingsTitle,
        description: copy.iamBindingsDescription,
        headingBadgeClassName: "section-badge-lime",
        columns: [
          { label: copy.iamTargetLabel, className: "mono" },
          { label: copy.iamProviderLabel },
          { label: copy.iamAuthModeLabel },
          { label: copy.iamMfaPolicyLabel },
          { label: copy.iamStatusLabel }
        ],
        rows: buildBindingRows({
          bindings,
          selectedBinding,
          renderFocusLink,
          renderPill,
          copy
        }),
        emptyMessage: copy.iamNoBindings,
        filterPlaceholder: copy.dataFilterPlaceholder,
        rowsPerPageLabel: copy.rowsPerPage,
        showingLabel: copy.showing,
        ofLabel: copy.of,
        recordsLabel: copy.records,
        defaultPageSize: 10
      })}
      ${renderBindingDetailPanel({
        binding: selectedBinding,
        providers,
        currentPath,
        currentUserIsAdmin,
        renderPill,
        copy
      })}
    </div>
  </section>`;
}
