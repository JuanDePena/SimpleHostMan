import { escapeHtml } from "@simplehost/panel-ui";

import { buildDashboardViewUrl } from "./dashboard-routing.js";
import { type RenderAppProxyDesiredStatePanelsArgs } from "./desired-state-app-proxy-types.js";

export function renderProxyEditorPanel(args: RenderAppProxyDesiredStatePanelsArgs): string {
  const {
    copy,
    selectedApp,
    selectedAppDatabases,
    nodeOptions,
    renderers,
    tenantOptions,
    zoneOptions
  } = args;

  if (!selectedApp) {
    return "";
  }

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.desiredStateEditorsTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
      </div>
    </div>
    <form method="post" action="/resources/apps/upsert" class="stack">
      <input type="hidden" name="originalSlug" value="${escapeHtml(selectedApp.slug)}" />
      <div class="form-grid">
        <label>Slug
          <input name="slug" value="${escapeHtml(selectedApp.slug)}" required spellcheck="false" />
        </label>
        <label>Tenant slug
          <select name="tenantSlug" required>
            ${renderers.renderSelectOptions(tenantOptions, selectedApp.tenantSlug)}
          </select>
        </label>
        <label>Zone name
          <select name="zoneName" required>
            ${renderers.renderSelectOptions(zoneOptions, selectedApp.zoneName)}
          </select>
        </label>
        <label>Primary node
          <select name="primaryNodeId" required>
            ${renderers.renderSelectOptions(nodeOptions, selectedApp.primaryNodeId)}
          </select>
        </label>
        <label>Standby node
          <select name="standbyNodeId">
            ${renderers.renderSelectOptions(nodeOptions, selectedApp.standbyNodeId, {
              allowBlank: true,
              blankLabel: "none"
            })}
          </select>
        </label>
        <label>Canonical domain
          <input name="canonicalDomain" value="${escapeHtml(selectedApp.canonicalDomain)}" required spellcheck="false" />
        </label>
        <label>Aliases
          <input name="aliases" value="${escapeHtml(selectedApp.aliases.join(", "))}" />
        </label>
        <label>Backend port
          <input name="backendPort" type="number" min="1" max="65535" value="${escapeHtml(String(selectedApp.backendPort))}" required />
        </label>
        <label>Runtime image
          <input name="runtimeImage" value="${escapeHtml(selectedApp.runtimeImage)}" required />
        </label>
        <label>Storage root
          <input name="storageRoot" value="${escapeHtml(selectedApp.storageRoot)}" required />
        </label>
        <label>Mode
          <select name="mode">
            <option value="active-passive"${selectedApp.mode === "active-passive" ? " selected" : ""}>active-passive</option>
            <option value="active-active"${selectedApp.mode === "active-active" ? " selected" : ""}>active-active</option>
          </select>
        </label>
      </div>
      <div class="toolbar">
        <button type="submit">Save app</button>
        <button class="secondary" type="submit" formaction="/actions/app-reconcile" data-confirm="${escapeHtml(
          `Run full reconcile for app ${selectedApp.slug}? This will queue ${
            selectedApp.standbyNodeId ? 3 : 2
          } job(s) across ${selectedApp.standbyNodeId ? "primary and standby nodes" : "the primary node"} plus DNS.`
        )}">Full reconcile</button>
        <button class="secondary" type="submit" formaction="/actions/app-render-proxy" data-confirm="${escapeHtml(
          `Dispatch proxy.render for app ${selectedApp.slug}? This will queue ${
            selectedApp.standbyNodeId ? 2 : 1
          } proxy.render job(s) for ${selectedApp.canonicalDomain}.`
        )}">Dispatch proxy.render</button>
      </div>
    </form>
    <article class="panel panel-nested detail-shell danger-shell">
      <div>
        <h3>${escapeHtml(copy.dangerZoneTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
      </div>
      ${renderers.renderActionFacts([
        {
          label: copy.affectedResourcesLabel,
          value: escapeHtml(
            `${selectedApp.zoneName} · ${selectedAppDatabases.length} database(s) · ${selectedApp.aliases.length} alias(es)`
          )
        },
        {
          label: copy.targetedNodesLabel,
          value: `<span class="mono">${escapeHtml(
            selectedApp.standbyNodeId
              ? `${selectedApp.primaryNodeId} -> ${selectedApp.standbyNodeId}`
              : selectedApp.primaryNodeId
          )}</span>`
        },
        {
          label: copy.relatedResourcesTitle,
          value: escapeHtml(`${selectedAppDatabases.length} database(s)`)
        }
      ])}
      <form method="post" action="/resources/apps/delete" class="toolbar">
        <input type="hidden" name="slug" value="${escapeHtml(selectedApp.slug)}" />
        <button class="danger" type="submit" data-confirm="${escapeHtml(
          `Delete app ${selectedApp.slug} from desired state? ${selectedAppDatabases.length} linked database definition(s) and ${selectedApp.aliases.length} alias(es) should be reviewed first.`
        )}">Delete app</button>
      </form>
    </article>
  </article>`;
}

export function renderAppEditorPanel(args: RenderAppProxyDesiredStatePanelsArgs): string {
  const {
    copy,
    selectedApp,
    selectedAppActionPreviewItems,
    selectedAppDatabases,
    selectedAppLatestFailure,
    selectedAppPlanItems,
    selectedAppProxyDrifts,
    appComparisonRows,
    nodeOptions,
    renderers,
    tenantOptions,
    zoneOptions
  } = args;

  if (!selectedApp) {
    return "";
  }

  const primaryProxyResourceKey = `app:${selectedApp.slug}:proxy:${selectedApp.primaryNodeId}`;

  return `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(copy.desiredStateEditorsTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
      </div>
    </div>
    <form method="post" action="/resources/apps/upsert" class="stack">
      <input type="hidden" name="originalSlug" value="${escapeHtml(selectedApp.slug)}" />
      <div class="grid grid-two">
        <article class="panel panel-nested detail-shell">
          <div>
            <h3>${escapeHtml(copy.detailActionsTitle)}</h3>
            <p class="muted section-description">${escapeHtml(copy.desiredStateEditorsDescription)}</p>
          </div>
          <div class="form-grid">
            <label>Slug
              <input name="slug" value="${escapeHtml(selectedApp.slug)}" required spellcheck="false" />
            </label>
            <label>Tenant slug
              <select name="tenantSlug" required>
                ${renderers.renderSelectOptions(tenantOptions, selectedApp.tenantSlug)}
              </select>
            </label>
            <label>Zone name
              <select name="zoneName" required>
                ${renderers.renderSelectOptions(zoneOptions, selectedApp.zoneName)}
              </select>
            </label>
            <label>Primary node
              <select name="primaryNodeId" required>
                ${renderers.renderSelectOptions(nodeOptions, selectedApp.primaryNodeId)}
              </select>
            </label>
            <label>Standby node
              <select name="standbyNodeId">
                ${renderers.renderSelectOptions(nodeOptions, selectedApp.standbyNodeId, {
                  allowBlank: true,
                  blankLabel: "none"
                })}
              </select>
            </label>
            <label>Canonical domain
              <input name="canonicalDomain" value="${escapeHtml(selectedApp.canonicalDomain)}" required spellcheck="false" />
            </label>
            <label>Aliases
              <input name="aliases" value="${escapeHtml(selectedApp.aliases.join(", "))}" />
            </label>
            <label>Backend port
              <input name="backendPort" type="number" min="1" max="65535" value="${escapeHtml(String(selectedApp.backendPort))}" required />
            </label>
            <label>Runtime image
              <input name="runtimeImage" value="${escapeHtml(selectedApp.runtimeImage)}" required />
            </label>
            <label>Storage root
              <input name="storageRoot" value="${escapeHtml(selectedApp.storageRoot)}" required />
            </label>
            <label>Mode
              <select name="mode">
                <option value="active-passive"${selectedApp.mode === "active-passive" ? " selected" : ""}>active-passive</option>
                <option value="active-active"${selectedApp.mode === "active-active" ? " selected" : ""}>active-active</option>
              </select>
            </label>
          </div>
          <div class="toolbar">
            <button type="submit">Save app</button>
            <button class="secondary" type="submit" formaction="/actions/app-reconcile" data-confirm="${escapeHtml(
              `Run full reconcile for app ${selectedApp.slug}? This will queue ${
                selectedApp.standbyNodeId ? 3 : 2
              } job(s) across ${selectedApp.standbyNodeId ? "primary and standby nodes" : "the primary node"} plus DNS.`
            )}">Full reconcile</button>
            <button class="secondary" type="submit" formaction="/actions/app-render-proxy" data-confirm="${escapeHtml(
              `Dispatch proxy.render for app ${selectedApp.slug}? This will queue ${
                selectedApp.standbyNodeId ? 2 : 1
              } proxy.render job(s) for ${selectedApp.canonicalDomain}.`
            )}">Dispatch proxy.render</button>
          </div>
        </article>
        <article class="panel panel-nested detail-shell">
          <div>
            <h3>${escapeHtml(copy.previewTitle)}</h3>
            <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
          </div>
          ${renderers.renderActionFacts([
            {
              label: copy.targetedNodesLabel,
              value: `<span class="mono">${escapeHtml(
                selectedApp.standbyNodeId
                  ? `${selectedApp.primaryNodeId} -> ${selectedApp.standbyNodeId}`
                  : selectedApp.primaryNodeId
              )}</span>`
            },
            {
              label: copy.affectedResourcesLabel,
              value: escapeHtml(
                `${selectedApp.zoneName} · ${selectedAppDatabases.length} database(s) · ${selectedApp.aliases.length} alias(es)`
              )
            },
            {
              label: copy.latestFailureLabel,
              value: selectedAppLatestFailure
                ? `<a class="detail-link mono" href="${escapeHtml(
                    buildDashboardViewUrl("job-history", undefined, selectedAppLatestFailure.jobId)
                  )}">${escapeHtml(selectedAppLatestFailure.jobId)}</a>`
                : escapeHtml(copy.none)
            },
            {
              label: copy.linkedResource,
              value: `<a class="detail-link mono" href="${escapeHtml(
                buildDashboardViewUrl("resource-drift", undefined, primaryProxyResourceKey)
              )}">${escapeHtml(primaryProxyResourceKey)}</a>`
            },
            {
              label: copy.dispatchRecommended,
              value:
                selectedAppProxyDrifts.length > 0
                  ? renderers.renderPill(
                      selectedAppProxyDrifts.some((entry) => entry.dispatchRecommended)
                        ? copy.yesLabel
                        : copy.noLabel,
                      selectedAppProxyDrifts.some((entry) => entry.dispatchRecommended)
                        ? "danger"
                        : "success"
                    )
                  : renderers.renderPill(copy.none, "muted")
            }
          ])}
          ${renderers.renderComparisonTable(
            copy.desiredAppliedTitle,
            copy.desiredAppliedDescription,
            appComparisonRows
          )}
          ${renderers.renderRelatedPanel(
            copy.queuedWorkTitle,
            copy.queuedWorkDescription,
            selectedAppPlanItems,
            copy.noRelatedRecords
          )}
          ${renderers.renderRelatedPanel(
            copy.fieldDeltaTitle,
            copy.fieldDeltaDescription,
            renderers.createComparisonDeltaItems(appComparisonRows),
            copy.noFieldDeltas
          )}
          ${renderers.renderRelatedPanel(
            copy.plannedChangesTitle,
            copy.plannedChangesDescription,
            selectedAppActionPreviewItems,
            copy.noRelatedRecords
          )}
          ${renderers.renderRelatedPanel(
            copy.relatedResourcesTitle,
            copy.relatedResourcesDescription,
            selectedAppDatabases.map((database) => ({
              title: `<a class="detail-link" href="${escapeHtml(
                buildDashboardViewUrl("desired-state", "desired-state-databases", database.appSlug)
              )}">${escapeHtml(database.databaseName)}</a>`,
              meta: escapeHtml(database.engine),
              summary: escapeHtml(database.databaseUser),
              tone: "default" as const
            })),
            copy.noRelatedRecords
          )}
        </article>
      </div>
    </form>
    <article class="panel panel-nested detail-shell danger-shell">
      <div>
        <h3>${escapeHtml(copy.dangerZoneTitle)}</h3>
        <p class="muted section-description">${escapeHtml(copy.selectedResourceDescription)}</p>
      </div>
      ${renderers.renderActionFacts([
        {
          label: copy.affectedResourcesLabel,
          value: escapeHtml(
            `${selectedApp.zoneName} · ${selectedAppDatabases.length} database(s) · ${selectedApp.aliases.length} alias(es)`
          )
        },
        {
          label: copy.targetedNodesLabel,
          value: `<span class="mono">${escapeHtml(
            selectedApp.standbyNodeId
              ? `${selectedApp.primaryNodeId} -> ${selectedApp.standbyNodeId}`
              : selectedApp.primaryNodeId
          )}</span>`
        },
        {
          label: copy.relatedResourcesTitle,
          value: escapeHtml(`${selectedAppDatabases.length} database(s)`)
        }
      ])}
      <form method="post" action="/resources/apps/delete" class="toolbar">
        <input type="hidden" name="slug" value="${escapeHtml(selectedApp.slug)}" />
        <button class="danger" type="submit" data-confirm="${escapeHtml(
          `Delete app ${selectedApp.slug} from desired state? ${selectedAppDatabases.length} linked database definition(s) and ${selectedApp.aliases.length} alias(es) should be reviewed first.`
        )}">Delete app</button>
      </form>
    </article>
  </article>`;
}
