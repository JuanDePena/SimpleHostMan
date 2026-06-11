import {
  escapeHtml,
  renderDataTable,
  type DataTableRow
} from "@simplehost/ui";

import {
  iamAuthModes,
  iamBindingRenderModes,
  iamBindingStatuses,
  iamMfaPolicies,
  iamProviderProvisioningStatuses,
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

function renderCapabilityStatus(
  provider: IamProviderSummary,
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string,
  emptyValue: string
): string {
  if (provider.capabilityStatus.length === 0) {
    return renderList(provider.capabilities, emptyValue);
  }

  return provider.capabilityStatus
    .map((capability) => {
      const tone =
        capability.status === "available"
          ? "success"
          : capability.status === "pilot_validated"
            ? "default"
          : capability.status === "disabled"
            ? "danger"
            : "muted";

      return `${escapeHtml(capability.key)} ${renderPill(capability.status, tone)}`;
    })
    .join(" ");
}

function renderUiAuthMetadata(binding: IamBindingSummary, copy: WebCopy): string {
  const uiAuth =
    binding.config.uiAuth && typeof binding.config.uiAuth === "object"
      ? (binding.config.uiAuth as Record<string, unknown>)
      : undefined;

  if (!uiAuth) {
    return "";
  }

  const facts = [
    {
      label: copy.iamClientSlugLabel,
      value:
        typeof uiAuth.clientSlug === "string"
          ? `<span class="mono">${escapeHtml(uiAuth.clientSlug)}</span>`
          : escapeHtml(copy.none)
    },
    {
      label: copy.iamCallbackUrlLabel,
      value:
        typeof uiAuth.callbackUrl === "string"
          ? `<span class="mono">${escapeHtml(uiAuth.callbackUrl)}</span>`
          : escapeHtml(copy.none)
    },
    {
      label: copy.iamSecretStorageLabel,
      value:
        typeof uiAuth.secretStorage === "string"
          ? escapeHtml(uiAuth.secretStorage)
          : escapeHtml(copy.none)
    }
  ];

  return `<div class="stack">
    <h4>${escapeHtml(copy.iamUiAuthTitle)}</h4>
    ${renderActionFacts(facts, { className: "action-card-facts-wide-labels" })}
  </div>`;
}

function renderOauthLoginMetadata(binding: IamBindingSummary, copy: WebCopy): string {
  const oauthLogin =
    binding.config.oauthLogin && typeof binding.config.oauthLogin === "object"
      ? (binding.config.oauthLogin as Record<string, unknown>)
      : undefined;

  if (!oauthLogin) {
    return "";
  }

  const requiredScopes = Array.isArray(oauthLogin.requiredScopes)
    ? oauthLogin.requiredScopes.filter((value): value is string => typeof value === "string")
    : [];
  const facts = [
    {
      label: copy.iamClientIdLabel,
      value:
        typeof oauthLogin.clientId === "string"
          ? `<span class="mono">${escapeHtml(oauthLogin.clientId)}</span>`
          : escapeHtml(copy.none)
    },
    {
      label: copy.iamLoginStartPathLabel,
      value:
        typeof oauthLogin.loginStartPath === "string"
          ? `<span class="mono">${escapeHtml(oauthLogin.loginStartPath)}</span>`
          : escapeHtml(copy.none)
    },
    {
      label: copy.iamCallbackUrlLabel,
      value:
        typeof oauthLogin.loginCallbackPath === "string"
          ? `<span class="mono">${escapeHtml(oauthLogin.loginCallbackPath)}</span>`
          : escapeHtml(copy.none)
    },
    {
      label: copy.iamRequiredAudienceLabel,
      value:
        typeof oauthLogin.requiredAudience === "string"
          ? `<span class="mono">${escapeHtml(oauthLogin.requiredAudience)}</span>`
          : escapeHtml(copy.none)
    },
    {
      label: copy.iamRequiredScopesLabel,
      value: requiredScopes.length > 0
        ? `<span class="mono">${escapeHtml(requiredScopes.join(" "))}</span>`
        : escapeHtml(copy.none)
    },
    {
      label: copy.iamAssuranceLevelLabel,
      value:
        typeof oauthLogin.requiredAssuranceLevel === "string"
          ? escapeHtml(oauthLogin.requiredAssuranceLevel)
          : escapeHtml(copy.none)
    },
    {
      label: copy.iamPromotionStateLabel,
      value:
        typeof oauthLogin.promotionState === "string"
          ? escapeHtml(oauthLogin.promotionState)
          : escapeHtml(copy.none)
    }
  ];

  return `<div class="stack">
    <h4>${escapeHtml(copy.iamOauthLoginTitle)}</h4>
    ${renderActionFacts(facts, { className: "action-card-facts-wide-labels" })}
  </div>`;
}

function renderOperationalState(args: {
  data: DashboardData;
  renderPill: (value: string, tone?: "default" | "success" | "danger" | "muted") => string;
  copy: WebCopy;
}): string {
  const { data, renderPill, copy } = args;
  const state = data.iam.operationalState;
  const activeProvider = state.activeControlProviderSlug
    ? `${state.activeControlProviderSlug} / ${state.activeControlAuthMode ?? copy.none}`
    : copy.none;
  const candidateProvider = state.candidateControlProviderSlug
    ? `${state.candidateControlProviderSlug} / ${state.candidateControlAuthMode ?? copy.none}`
    : copy.none;
  const nativeProvider = state.nativeControlProviderSlug
    ? `${state.nativeControlProviderSlug} / ${state.nativeControlAuthMode ?? copy.none}`
    : copy.none;
  const lastLogin = state.lastOAuthLoginAt
    ? [
        state.lastOAuthLoginEmail ?? copy.none,
        state.lastOAuthLoginProvider ?? copy.none,
        state.lastOAuthLoginAssuranceLevel ?? copy.none,
        state.lastOAuthLoginAt
      ].join(" / ")
    : copy.never;
  const lastFailure = state.lastOAuthFailureAt
    ? [
        state.lastOAuthFailureReason ?? copy.none,
        state.lastOAuthFailureProvider ?? copy.none,
        state.lastOAuthFailureAt
      ].join(" / ")
    : copy.never;

  return `<article class="panel">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.iamOperationalStateTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.iamOperationalStateDescription)}</p>
      </div>
      ${renderPill(state.candidateControlAuthMode ?? copy.none, state.candidateControlAuthMode ? "default" : "muted")}
    </div>
    ${renderActionFacts(
      [
        {
          label: copy.iamActiveProviderLabel,
          value: `<span class="mono">${escapeHtml(activeProvider)}</span>`
        },
        {
          label: copy.iamCandidateProviderLabel,
          value: `<span class="mono">${escapeHtml(candidateProvider)}</span>`
        },
        {
          label: copy.iamNativeProviderLabel,
          value: `<span class="mono">${escapeHtml(nativeProvider)}</span>`
        },
        {
          label: copy.iamNativePolicyLabel,
          value: state.nativeControlPromotionPolicy
            ? `<span class="mono">${escapeHtml(state.nativeControlPromotionPolicy)}</span>`
            : escapeHtml(copy.none)
        },
        {
          label: copy.iamOuterGateLabel,
          value: state.nativeControlOuterGateProviderSlug
            ? `<span class="mono">${escapeHtml(state.nativeControlOuterGateProviderSlug)}</span>`
            : escapeHtml(copy.none)
        },
        {
          label: copy.iamRollbackProviderLabel,
          value: state.nativeControlRollbackProviderSlug
            ? `<span class="mono">${escapeHtml(state.nativeControlRollbackProviderSlug)}</span>`
            : escapeHtml(copy.none)
        },
        {
          label: copy.iamLastOAuthLoginLabel,
          value: escapeHtml(lastLogin)
        },
        {
          label: copy.iamLastOAuthFailureLabel,
          value: escapeHtml(lastFailure)
        }
      ],
      { className: "action-card-facts-wide-labels" }
    )}
  </article>`;
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
      renderCapabilityStatus(provider, renderPill, copy.none),
      provider.baseUrl ? `<span class="mono">${escapeHtml(provider.baseUrl)}</span>` : escapeHtml(copy.none)
    ],
    searchText: [
      provider.slug,
      provider.displayName,
      provider.status,
      provider.capabilities.join(" "),
      provider.capabilityStatus
        .map((capability) => `${capability.key} ${capability.status} ${capability.notes ?? ""}`)
        .join(" "),
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
        renderPill(
          binding.authMode,
          binding.authMode === "ui_auth"
            ? "success"
            : binding.authMode === "oauth_login"
              ? "default"
              : "default"
        ),
        renderPill(binding.renderMode, binding.renderEnabled ? "success" : "muted"),
        renderPill(
          binding.providerProvisioningStatus,
          binding.providerProvisioningStatus === "manual_ready" ||
            binding.providerProvisioningStatus === "not_required"
            ? "success"
            : binding.providerProvisioningStatus === "pending"
              ? "default"
              : "muted"
        ),
        renderPill(binding.mfaPolicy, binding.mfaPolicy === "required" ? "success" : "muted"),
        renderPill(binding.status, toneForStatus(binding.status))
      ],
      searchText: [
        binding.targetKind,
        binding.targetSlug,
        binding.providerSlug,
        binding.providerDisplayName,
        binding.authMode,
        binding.renderMode,
        binding.providerProvisioningStatus,
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
  const canApplyApache =
    currentUserIsAdmin &&
    binding.renderMode === "apache_managed" &&
    binding.status === "active" &&
    binding.providerSlug === "pyrosa-iam" &&
    binding.authMode === "proxy" &&
    binding.providerProvisioningStatus === "manual_ready";

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
        },
        {
          label: copy.iamRenderModeLabel,
          value: renderPill(binding.renderMode, binding.renderEnabled ? "success" : "muted")
        },
        {
          label: copy.iamProviderProvisioningLabel,
          value: renderPill(
            binding.providerProvisioningStatus,
            binding.providerProvisioningStatus === "manual_ready" ||
              binding.providerProvisioningStatus === "not_required"
              ? "success"
              : binding.providerProvisioningStatus === "pending"
                ? "default"
                : "muted"
          )
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
        <label>
          <span>${escapeHtml(copy.iamRenderModeLabel)}</span>
          <select name="renderMode"${disabledAttribute}>
            ${renderSelectOptions(
              iamBindingRenderModes.map((mode) => ({ value: mode, label: mode })),
              binding.renderMode
            )}
          </select>
        </label>
        <label>
          <span>${escapeHtml(copy.iamProviderProvisioningLabel)}</span>
          <select name="providerProvisioningStatus"${disabledAttribute}>
            ${renderSelectOptions(
              iamProviderProvisioningStatuses.map((status) => ({
                value: status,
                label: status
              })),
              binding.providerProvisioningStatus
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
    ${
      currentUserIsAdmin
        ? `<form method="post" action="/actions/iam/apache-apply" class="toolbar">
            <input type="hidden" name="returnTo" value="${escapeHtml(currentPath)}" />
            <input type="hidden" name="bindingId" value="${escapeHtml(binding.bindingId)}" />
            <button type="submit"${canApplyApache ? "" : " disabled"}>${escapeHtml(copy.iamApplyApacheAction)}</button>
          </form>`
        : ""
    }
    ${renderUiAuthMetadata(binding, copy)}
    ${renderOauthLoginMetadata(binding, copy)}
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
      { label: copy.iamPyrosaIamLabel, value: providers.some((provider) => provider.slug === "pyrosa-iam") ? copy.availableLabel : copy.unavailableLabel, tone: providers.some((provider) => provider.slug === "pyrosa-iam") ? "success" : "muted" }
    ])}
    ${renderOperationalState({ data, renderPill, copy })}
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
        { label: copy.iamCapabilityStatusLabel },
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
          { label: copy.iamRenderModeLabel },
          { label: copy.iamProviderProvisioningLabel },
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
