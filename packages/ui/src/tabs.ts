import { escapeHtml } from "./html.js";
import type { TabsProps } from "./ui-types.js";

export function renderTabs(props: TabsProps): string {
  const firstTabId = props.defaultTabId ?? props.tabs[0]?.id ?? "";

  const buttonsHtml = props.tabs
    .map(
      (tab, index) => `<button
        type="button"
        class="tab-button${tab.id === firstTabId || (!firstTabId && index === 0) ? " active" : ""}"
        data-tab-button
        data-tab-target="${escapeHtml(tab.id)}"
        ${tab.href ? `data-tab-href="${escapeHtml(tab.href)}"` : ""}
        aria-selected="${tab.id === firstTabId || (!firstTabId && index === 0) ? "true" : "false"}"
      ><span>${escapeHtml(tab.label)}</span>${
        tab.badge
          ? `<span class="tab-badge${tab.badge === "0" ? " tab-badge-zero" : ""}">${escapeHtml(tab.badge)}</span>`
          : ""
      }</button>`
    )
    .join("");

  const panelsHtml = props.tabs
    .map(
      (tab, index) => `<section
        id="${escapeHtml(tab.id)}"
        class="tab-panel"
        data-tab-panel
        ${tab.id === firstTabId || (!firstTabId && index === 0) ? "" : "hidden"}
      >${tab.panelHtml}</section>`
    )
    .join("");

  return `<section id="${escapeHtml(props.id)}" class="tabs" data-tabs data-default-tab="${escapeHtml(
    firstTabId
  )}">
    <div class="tab-list" role="tablist">${buttonsHtml}</div>
    <div class="tab-panels">${panelsHtml}</div>
  </section>`;
}
