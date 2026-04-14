import { escapeHtml, renderTabs, type TabItem } from "@simplehost/panel-ui";

export interface DesiredStateLayoutPane {
  id: string;
  label: string;
  href: string;
  panelHtml?: string;
}

export interface DesiredStateLayoutFullSection {
  tableHtml: string;
  summaryHtml?: string;
  specHtml?: string;
  emptyPanelHtml: string;
}

export interface DesiredStateLayoutWorkspaceSection {
  sectionId: string;
  defaultTabId: string;
  tableHtml: string;
  emptyPanelHtml: string;
  singlePanelHtml?: string;
  singlePanelGrid?: boolean;
  summary: DesiredStateLayoutPane;
  spec: DesiredStateLayoutPane;
  activity?: DesiredStateLayoutPane;
}

export interface DesiredStateLayoutSection {
  id: string;
  label: string;
  badge?: string;
  href: string;
  full: DesiredStateLayoutFullSection;
  workspace?: DesiredStateLayoutWorkspaceSection;
}

export interface DesiredStateLayoutInput {
  mode?: "full" | "single" | "workspace";
  defaultTabId: string;
  createTab: TabItem;
  sections: DesiredStateLayoutSection[];
  singlePanelsOnly?: boolean;
}

function resolvePanelHtml(panelHtml: string | undefined, emptyPanelHtml: string): string {
  return panelHtml ?? emptyPanelHtml;
}

function renderObjectWorkspaceSection(
  id: string,
  tableHtml: string,
  tabs: TabItem[],
  defaultTabId: string
): string {
  return `<section id="${escapeHtml(id)}" class="panel section-panel">
    <div class="stack">
      ${tableHtml}
      ${renderTabs({
        id: `${id}-tabs`,
        tabs,
        defaultTabId
      })}
    </div>
  </section>`;
}

export function renderDesiredStateLayout(input: DesiredStateLayoutInput): string {
  const fullTabs: TabItem[] = [
    input.createTab,
    ...input.sections.map((section) => ({
      id: section.id,
      label: section.label,
      badge: section.badge,
      href: section.href,
      panelHtml: `<div class="stack">
        ${section.full.tableHtml}
        <div class="grid grid-two">
          ${resolvePanelHtml(section.full.summaryHtml, section.full.emptyPanelHtml)}
          ${resolvePanelHtml(section.full.specHtml, section.full.emptyPanelHtml)}
        </div>
      </div>`
    }))
  ];

  if (input.mode === "workspace") {
    const selectedSection = input.sections.find(
      (section) => section.id === input.defaultTabId
    )?.workspace;

    if (selectedSection) {
      if (selectedSection.singlePanelHtml) {
        const sectionBodyClass = selectedSection.singlePanelGrid ? "grid-two-desktop" : "stack";

        return `<section id="${escapeHtml(selectedSection.sectionId)}" class="panel section-panel">
          <div class="${sectionBodyClass}">
            ${selectedSection.tableHtml}
            ${resolvePanelHtml(selectedSection.singlePanelHtml, selectedSection.emptyPanelHtml)}
          </div>
        </section>`;
      }

      const workspaceTabs: TabItem[] = [
        {
          id: selectedSection.summary.id,
          label: selectedSection.summary.label,
          href: selectedSection.summary.href,
          panelHtml: resolvePanelHtml(
            selectedSection.summary.panelHtml,
            selectedSection.emptyPanelHtml
          )
        },
        {
          id: selectedSection.spec.id,
          label: selectedSection.spec.label,
          href: selectedSection.spec.href,
          panelHtml: resolvePanelHtml(
            selectedSection.spec.panelHtml,
            selectedSection.emptyPanelHtml
          )
        },
        ...(selectedSection.activity
          ? [
              {
                id: selectedSection.activity.id,
                label: selectedSection.activity.label,
                href: selectedSection.activity.href,
                panelHtml: resolvePanelHtml(
                  selectedSection.activity.panelHtml,
                  selectedSection.emptyPanelHtml
                )
              } satisfies TabItem
            ]
          : [])
      ];

      return renderObjectWorkspaceSection(
        selectedSection.sectionId,
        selectedSection.tableHtml,
        workspaceTabs,
        selectedSection.defaultTabId
      );
    }
  }

  if (input.mode === "single") {
    const selectedSection = input.sections.find((section) => section.id === input.defaultTabId);

    if (input.singlePanelsOnly && selectedSection) {
      return `<div class="grid grid-two">
        ${resolvePanelHtml(selectedSection.full.summaryHtml, selectedSection.full.emptyPanelHtml)}
        ${resolvePanelHtml(selectedSection.full.specHtml, selectedSection.full.emptyPanelHtml)}
      </div>`;
    }

    const selectedTab =
      fullTabs.find((tab) => tab.id === input.defaultTabId) ??
      fullTabs.find((tab) => tab.id === "desired-state-create") ??
      fullTabs[0];

    return `<section id="section-${escapeHtml(selectedTab.id)}" class="panel section-panel">
      ${selectedTab.panelHtml}
    </section>`;
  }

  return `<section id="section-desired-state" class="panel section-panel">
    ${renderTabs({
      id: "desired-state-tabs",
      tabs: fullTabs,
      defaultTabId: input.defaultTabId
    })}
  </section>`;
}
