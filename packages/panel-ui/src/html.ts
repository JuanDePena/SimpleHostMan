import type { PanelNotice } from "./ui-types.js";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderNotice(notice?: PanelNotice): string {
  if (!notice) {
    return "";
  }

  return `<aside class="notice notice-${escapeHtml(notice.kind)}">${escapeHtml(
    notice.message
  )}</aside>`;
}
