import { escapeHtml, renderDataTable, type DataTableRow } from "@simplehost/ui";

import { type DashboardData } from "./api-client.js";
import { buildDashboardViewUrl } from "./dashboard-routing.js";
import {
  type LocalizedMailCopy,
  type MailSectionCopy,
  type MailSectionModel,
  type MailSectionRenderers
} from "./mail-section-types.js";
import { type WebLocale } from "./request.js";

export function renderMailSectionContent(args: {
  copy: MailSectionCopy;
  data: DashboardData;
  locale: WebLocale;
  mailCopy: LocalizedMailCopy;
  model: MailSectionModel;
  renderers: MailSectionRenderers;
  returnTo: string;
}): string {
  const { copy, data, locale, mailCopy, model, renderers, returnTo } = args;
  const {
    mailDomainOptions,
    mailboxOptions,
    healthyMailRuntimeCount,
    mailRuntimeNodes,
    nodeOptions,
    reportedMailRuntimeCount,
    selectedAlias,
    selectedAliasDefaults,
    selectedDomain,
    selectedDomainDefaults,
    selectedMailbox,
    selectedMailboxDefaults,
    selectedQuota,
    selectedQuotaDefaults,
    tenantOptions,
    zoneOptions
  } = model;

  const renderServiceStatus = (
    snapshot:
      | {
          postfixEnabled?: boolean;
          postfixActive?: boolean;
          dovecotEnabled?: boolean;
          dovecotActive?: boolean;
          rspamdEnabled?: boolean;
          rspamdActive?: boolean;
          redisEnabled?: boolean;
          redisActive?: boolean;
        }
      | undefined,
    serviceName: "postfix" | "dovecot" | "rspamd" | "redis"
  ): string => {
    if (!snapshot) {
      return renderers.renderPill(mailCopy.runtimeUnreported, "muted");
    }

    const enabled =
      serviceName === "postfix"
        ? snapshot.postfixEnabled
        : serviceName === "dovecot"
          ? snapshot.dovecotEnabled
          : serviceName === "rspamd"
            ? snapshot.rspamdEnabled
            : snapshot.redisEnabled;
    const active =
      serviceName === "postfix"
        ? snapshot.postfixActive
        : serviceName === "dovecot"
          ? snapshot.dovecotActive
          : serviceName === "rspamd"
            ? snapshot.rspamdActive
            : snapshot.redisActive;

    if (active) {
      return renderers.renderPill(mailCopy.serviceActive, "success");
    }

    if (enabled) {
      return renderers.renderPill(mailCopy.serviceInactive, "danger");
    }

    return renderers.renderPill(mailCopy.serviceDisabled, "muted");
  };

  const domainRows: DataTableRow[] = data.mail.domains.map((domain) => ({
    cells: [
      renderers.renderFocusLink(
        domain.domainName,
        buildDashboardViewUrl("mail", undefined, domain.domainName),
        selectedDomain?.domainName === domain.domainName,
        copy.selectedStateLabel
      ),
      escapeHtml(domain.tenantSlug),
      escapeHtml(domain.zoneName),
      `<span class="mono">${escapeHtml(domain.mailHost)}</span>`,
      `<span class="mono">${escapeHtml(domain.primaryNodeId)}</span>`,
      renderers.renderPill(
        String(domain.mailboxCount),
        domain.mailboxCount > 0 ? "success" : "muted"
      ),
      renderers.renderPill(
        String(domain.aliasCount),
        domain.aliasCount > 0 ? "success" : "muted"
      )
    ],
    searchText: [
      domain.domainName,
      domain.tenantSlug,
      domain.zoneName,
      domain.mailHost,
      domain.primaryNodeId,
      domain.standbyNodeId ?? "",
      domain.dkimSelector
    ].join(" ")
  }));

  const mailboxRows: DataTableRow[] = data.mail.mailboxes.map((mailbox) => ({
    cells: [
      renderers.renderFocusLink(
        mailbox.address,
        buildDashboardViewUrl("mail", undefined, mailbox.address),
        selectedMailbox?.address === mailbox.address,
        copy.selectedStateLabel
      ),
      escapeHtml(mailbox.domainName),
      `<span class="mono">${escapeHtml(mailbox.primaryNodeId)}</span>`,
      mailbox.hasCredential
        ? renderers.renderPill(mailCopy.credentialPresent, "success")
        : renderers.renderPill(mailCopy.credentialMissing, "danger"),
      mailbox.quotaBytes
        ? `<span class="mono">${escapeHtml(String(mailbox.quotaBytes))}</span>`
        : escapeHtml(copy.none)
    ],
    searchText: [
      mailbox.address,
      mailbox.domainName,
      mailbox.localPart,
      mailbox.primaryNodeId,
      mailbox.standbyNodeId ?? "",
      mailbox.hasCredential ? "present" : "missing",
      String(mailbox.quotaBytes ?? "")
    ].join(" ")
  }));

  const aliasRows: DataTableRow[] = data.mail.aliases.map((alias) => ({
    cells: [
      renderers.renderFocusLink(
        alias.address,
        buildDashboardViewUrl("mail", undefined, alias.address),
        selectedAlias?.address === alias.address,
        copy.selectedStateLabel
      ),
      escapeHtml(alias.domainName),
      `<span class="mono">${escapeHtml(alias.destinations.join(", "))}</span>`
    ],
    searchText: [alias.address, alias.domainName, alias.localPart, ...alias.destinations].join(" ")
  }));

  const quotaRows: DataTableRow[] = data.mail.quotas.map((quota) => ({
    cells: [
      renderers.renderFocusLink(
        quota.mailboxAddress,
        buildDashboardViewUrl("mail", undefined, quota.mailboxAddress),
        selectedQuota?.mailboxAddress === quota.mailboxAddress,
        copy.selectedStateLabel
      ),
      escapeHtml(quota.domainName),
      `<span class="mono">${escapeHtml(String(quota.storageBytes))}</span>`
    ],
    searchText: [quota.mailboxAddress, quota.domainName, String(quota.storageBytes)].join(" ")
  }));

  const runtimeRows: DataTableRow[] = mailRuntimeNodes.map((node) => ({
    cells: [
      `<span class="mono">${escapeHtml(node.nodeId)}</span><br /><span class="muted">${escapeHtml(node.hostname)}</span>`,
      renderServiceStatus(node.mail, "postfix"),
      renderServiceStatus(node.mail, "dovecot"),
      renderServiceStatus(node.mail, "rspamd"),
      renderServiceStatus(node.mail, "redis"),
      node.mail
        ? renderers.renderPill(
            String(node.mail.managedDomains.length),
            node.mail.managedDomains.length > 0 ? "success" : "muted"
          )
        : renderers.renderPill(mailCopy.runtimeUnreported, "muted"),
      node.mail?.checkedAt
        ? escapeHtml(renderers.formatDate(node.mail.checkedAt, locale))
        : escapeHtml(copy.none)
    ],
    searchText: [
      node.nodeId,
      node.hostname,
      ...(node.mail?.managedDomains.map((domain) => domain.domainName) ?? []),
      node.mail?.checkedAt ?? ""
    ].join(" ")
  }));

  const selectedDomainPanel = selectedDomain
    ? `<article class="panel detail-shell">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(mailCopy.selectedDomainTitle)}</h3>
            <p class="muted section-description">${escapeHtml(mailCopy.description)}</p>
          </div>
        </div>
        ${renderers.renderDetailGrid([
          {
            label: mailCopy.domainNameLabel,
            value: `<span class="mono">${escapeHtml(selectedDomain.domainName)}</span>`
          },
          { label: mailCopy.tenantSlugLabel, value: escapeHtml(selectedDomain.tenantSlug) },
          { label: mailCopy.zoneNameLabel, value: escapeHtml(selectedDomain.zoneName) },
          {
            label: mailCopy.mailHostLabel,
            value: `<span class="mono">${escapeHtml(selectedDomain.mailHost)}</span>`
          },
          {
            label: mailCopy.webmailHostnameLabel,
            value: `<span class="mono">${escapeHtml(`webmail.${selectedDomain.domainName}`)}</span>`
          },
          {
            label: mailCopy.dkimSelectorLabel,
            value: `<span class="mono">${escapeHtml(selectedDomain.dkimSelector)}</span>`
          },
          {
            label: mailCopy.primaryNodeLabel,
            value: `<span class="mono">${escapeHtml(selectedDomain.primaryNodeId)}</span>`
          },
          {
            label: mailCopy.standbyNodeLabel,
            value: selectedDomain.standbyNodeId
              ? `<span class="mono">${escapeHtml(selectedDomain.standbyNodeId)}</span>`
              : escapeHtml(copy.none)
          },
          {
            label: mailCopy.mailboxCountLabel,
            value: renderers.renderPill(
              String(selectedDomain.mailboxCount),
              selectedDomain.mailboxCount > 0 ? "success" : "muted"
            )
          },
          {
            label: mailCopy.aliasCountLabel,
            value: renderers.renderPill(
              String(selectedDomain.aliasCount),
              selectedDomain.aliasCount > 0 ? "success" : "muted"
            )
          }
        ])}
      </article>`
    : "";

  const selectedMailboxPanel = selectedMailbox
    ? `<article class="panel detail-shell">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(mailCopy.selectedMailboxTitle)}</h3>
            <p class="muted section-description">${escapeHtml(mailCopy.formsDescription)}</p>
          </div>
        </div>
        ${renderers.renderDetailGrid([
          {
            label: mailCopy.addressLabel,
            value: `<span class="mono">${escapeHtml(selectedMailbox.address)}</span>`
          },
          { label: mailCopy.domainNameLabel, value: escapeHtml(selectedMailbox.domainName) },
          {
            label: mailCopy.localPartLabel,
            value: `<span class="mono">${escapeHtml(selectedMailbox.localPart)}</span>`
          },
          {
            label: mailCopy.primaryNodeLabel,
            value: `<span class="mono">${escapeHtml(selectedMailbox.primaryNodeId)}</span>`
          },
          {
            label: mailCopy.standbyNodeLabel,
            value: selectedMailbox.standbyNodeId
              ? `<span class="mono">${escapeHtml(selectedMailbox.standbyNodeId)}</span>`
              : escapeHtml(copy.none)
          },
          {
            label: mailCopy.hasCredentialLabel,
            value: selectedMailbox.hasCredential
              ? renderers.renderPill(mailCopy.credentialPresent, "success")
              : renderers.renderPill(mailCopy.credentialMissing, "danger")
          },
          {
            label: mailCopy.quotaBytesLabel,
            value: selectedMailbox.quotaBytes
              ? `<span class="mono">${escapeHtml(String(selectedMailbox.quotaBytes))}</span>`
              : escapeHtml(copy.none)
          }
        ])}
      </article>`
    : "";

  const formsPanel = `<article class="panel detail-shell">
    <div class="section-head">
      <div>
        <h3>${escapeHtml(mailCopy.formsTitle)}</h3>
        <p class="muted section-description">${escapeHtml(mailCopy.formsDescription)}</p>
      </div>
    </div>
    <div class="grid grid-two">
      <form method="post" action="/resources/mail/domains/upsert" class="panel panel-nested detail-shell stack">
        <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" />
        <div>
          <h3>${escapeHtml(mailCopy.domainsTitle)}</h3>
        </div>
        <div class="form-grid">
          <label>${escapeHtml(mailCopy.domainNameLabel)}
            <input name="domainName" value="${escapeHtml(selectedDomainDefaults.domainName)}" required spellcheck="false" />
          </label>
          <label>${escapeHtml(mailCopy.tenantSlugLabel)}
            <select name="tenantSlug" required>${renderers.renderSelectOptions(tenantOptions, selectedDomainDefaults.tenantSlug)}</select>
          </label>
          <label>${escapeHtml(mailCopy.zoneNameLabel)}
            <select name="zoneName" required>${renderers.renderSelectOptions(zoneOptions, selectedDomainDefaults.zoneName)}</select>
          </label>
          <label>${escapeHtml(mailCopy.primaryNodeLabel)}
            <select name="primaryNodeId" required>${renderers.renderSelectOptions(nodeOptions, selectedDomainDefaults.primaryNodeId)}</select>
          </label>
          <label>${escapeHtml(mailCopy.standbyNodeLabel)}
            <select name="standbyNodeId">${renderers.renderSelectOptions(nodeOptions, selectedDomainDefaults.standbyNodeId || undefined, { allowBlank: true, blankLabel: "none" })}</select>
          </label>
          <label>${escapeHtml(mailCopy.mailHostLabel)}
            <input name="mailHost" value="${escapeHtml(selectedDomainDefaults.mailHost)}" required spellcheck="false" />
          </label>
          <label>${escapeHtml(mailCopy.dkimSelectorLabel)}
            <input name="dkimSelector" value="${escapeHtml(selectedDomainDefaults.dkimSelector)}" required spellcheck="false" />
          </label>
        </div>
        <div class="toolbar">
          <button type="submit">${escapeHtml(mailCopy.saveDomainLabel)}</button>
          ${
            selectedDomain
              ? renderers.renderActionForm(
                  "/resources/mail/domains/delete",
                  {
                    domainName: selectedDomain.domainName,
                    returnTo
                  },
                  mailCopy.deleteDomainLabel,
                  {
                    confirmMessage: `Delete mail domain ${selectedDomain.domainName}?`
                  }
                )
              : ""
          }
        </div>
      </form>
      <form method="post" action="/resources/mail/mailboxes/upsert" class="panel panel-nested detail-shell stack">
        <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" />
        <div>
          <h3>${escapeHtml(mailCopy.mailboxesTitle)}</h3>
        </div>
        <div class="form-grid">
          <label>${escapeHtml(mailCopy.addressLabel)}
            <input name="address" value="${escapeHtml(selectedMailboxDefaults.address)}" required spellcheck="false" />
          </label>
          <label>${escapeHtml(mailCopy.domainNameLabel)}
            <select name="domainName" required>${renderers.renderSelectOptions(mailDomainOptions, selectedMailboxDefaults.domainName)}</select>
          </label>
          <label>${escapeHtml(mailCopy.localPartLabel)}
            <input name="localPart" value="${escapeHtml(selectedMailboxDefaults.localPart)}" required spellcheck="false" />
          </label>
          <label>${escapeHtml(mailCopy.primaryNodeLabel)}
            <select name="primaryNodeId" required>${renderers.renderSelectOptions(nodeOptions, selectedMailboxDefaults.primaryNodeId)}</select>
          </label>
          <label>${escapeHtml(mailCopy.standbyNodeLabel)}
            <select name="standbyNodeId">${renderers.renderSelectOptions(nodeOptions, selectedMailboxDefaults.standbyNodeId || undefined, { allowBlank: true, blankLabel: "none" })}</select>
          </label>
          <label>${escapeHtml(mailCopy.desiredPasswordLabel)}
            <input name="desiredPassword" type="password" value="" autocomplete="new-password" />
          </label>
        </div>
        <div class="toolbar">
          <button type="submit">${escapeHtml(mailCopy.saveMailboxLabel)}</button>
          ${
            selectedMailbox
              ? renderers.renderActionForm(
                  "/resources/mail/mailboxes/delete",
                  {
                    address: selectedMailbox.address,
                    returnTo
                  },
                  mailCopy.deleteMailboxLabel,
                  {
                    confirmMessage: `Delete mailbox ${selectedMailbox.address}?`
                  }
                )
              : ""
          }
        </div>
      </form>
      <form method="post" action="/resources/mail/aliases/upsert" class="panel panel-nested detail-shell stack">
        <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" />
        <div>
          <h3>${escapeHtml(mailCopy.aliasesTitle)}</h3>
        </div>
        <div class="form-grid">
          <label>${escapeHtml(mailCopy.addressLabel)}
            <input name="address" value="${escapeHtml(selectedAliasDefaults.address)}" required spellcheck="false" />
          </label>
          <label>${escapeHtml(mailCopy.domainNameLabel)}
            <select name="domainName" required>${renderers.renderSelectOptions(mailDomainOptions, selectedAliasDefaults.domainName)}</select>
          </label>
          <label>${escapeHtml(mailCopy.localPartLabel)}
            <input name="localPart" value="${escapeHtml(selectedAliasDefaults.localPart)}" required spellcheck="false" />
          </label>
          <label>${escapeHtml(mailCopy.destinationsLabel)}
            <textarea name="destinations" rows="3">${escapeHtml(selectedAliasDefaults.destinations.join(", "))}</textarea>
          </label>
        </div>
        <div class="toolbar">
          <button type="submit">${escapeHtml(mailCopy.saveAliasLabel)}</button>
          ${
            selectedAlias
              ? renderers.renderActionForm(
                  "/resources/mail/aliases/delete",
                  {
                    address: selectedAlias.address,
                    returnTo
                  },
                  mailCopy.deleteAliasLabel,
                  {
                    confirmMessage: `Delete mail alias ${selectedAlias.address}?`
                  }
                )
              : ""
          }
        </div>
      </form>
      <form method="post" action="/resources/mail/quotas/upsert" class="panel panel-nested detail-shell stack">
        <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" />
        <div>
          <h3>${escapeHtml(mailCopy.quotasTitle)}</h3>
        </div>
        <div class="form-grid">
          <label>${escapeHtml(mailCopy.addressLabel)}
            <select name="mailboxAddress" required>${renderers.renderSelectOptions(mailboxOptions, selectedQuotaDefaults.mailboxAddress)}</select>
          </label>
          <label>${escapeHtml(mailCopy.quotaBytesLabel)}
            <input name="storageBytes" type="number" min="1" value="${escapeHtml(String(selectedQuotaDefaults.storageBytes))}" required />
          </label>
        </div>
        <div class="toolbar">
          <button type="submit">${escapeHtml(mailCopy.saveQuotaLabel)}</button>
          ${
            selectedQuota
              ? renderers.renderActionForm(
                  "/resources/mail/quotas/delete",
                  {
                    mailboxAddress: selectedQuota.mailboxAddress,
                    returnTo
                  },
                  mailCopy.deleteQuotaLabel,
                  {
                    confirmMessage: `Delete mailbox quota for ${selectedQuota.mailboxAddress}?`
                  }
                )
              : ""
          }
        </div>
      </form>
    </div>
  </article>`;

  return `<section id="section-mail" class="panel section-panel">
    <div class="section-head">
      <div>
        <h2>${escapeHtml(mailCopy.title)}</h2>
        <p class="muted section-description">${escapeHtml(mailCopy.description)}</p>
      </div>
    </div>
    ${renderers.renderSignalStrip([
      {
        label: mailCopy.domainCountLabel,
        value: String(data.mail.domains.length),
        tone: data.mail.domains.length > 0 ? "success" : "muted"
      },
      {
        label: mailCopy.mailboxTotalLabel,
        value: String(data.mail.mailboxes.length),
        tone: data.mail.mailboxes.length > 0 ? "success" : "muted"
      },
      {
        label: mailCopy.aliasTotalLabel,
        value: String(data.mail.aliases.length),
        tone: data.mail.aliases.length > 0 ? "success" : "muted"
      },
      {
        label: mailCopy.quotaTotalLabel,
        value: String(data.mail.quotas.length),
        tone: data.mail.quotas.length > 0 ? "success" : "muted"
      },
      {
        label: mailCopy.runtimeNodesLabel,
        value: String(reportedMailRuntimeCount),
        tone: reportedMailRuntimeCount > 0 ? "success" : "muted"
      },
      {
        label: mailCopy.runtimeHealthyLabel,
        value: String(healthyMailRuntimeCount),
        tone: healthyMailRuntimeCount > 0 ? "success" : "muted"
      }
    ])}
    <div class="grid-two-desktop">
      ${selectedDomainPanel}
      ${selectedMailboxPanel}
    </div>
    ${renderDataTable({
      id: "section-mail-runtime",
      heading: mailCopy.runtimeTitle,
      description: mailCopy.runtimeDescription,
      headingBadgeClassName: "section-badge-lime",
      columns: [
        { label: copy.navNodes, className: "mono" },
        { label: mailCopy.postfixLabel },
        { label: mailCopy.dovecotLabel },
        { label: mailCopy.rspamdLabel },
        { label: mailCopy.redisLabel },
        { label: mailCopy.managedDomainsLabel },
        { label: mailCopy.checkedAtLabel }
      ],
      rows: runtimeRows,
      emptyMessage: mailCopy.noRuntimeNodes,
      filterPlaceholder: copy.dataFilterPlaceholder,
      rowsPerPageLabel: copy.rowsPerPage,
      showingLabel: copy.showing,
      ofLabel: copy.of,
      recordsLabel: copy.records,
      defaultPageSize: 10
    })}
    ${renderDataTable({
      id: "section-mail-domains",
      heading: mailCopy.domainsTitle,
      description: mailCopy.description,
      headingBadgeClassName: "section-badge-lime",
      columns: [
        { label: mailCopy.domainNameLabel, className: "mono" },
        { label: mailCopy.tenantSlugLabel },
        { label: mailCopy.zoneNameLabel },
        { label: mailCopy.mailHostLabel },
        { label: mailCopy.primaryNodeLabel },
        { label: mailCopy.mailboxCountLabel },
        { label: mailCopy.aliasCountLabel }
      ],
      rows: domainRows,
      emptyMessage: mailCopy.noMailDomains,
      filterPlaceholder: copy.dataFilterPlaceholder,
      rowsPerPageLabel: copy.rowsPerPage,
      showingLabel: copy.showing,
      ofLabel: copy.of,
      recordsLabel: copy.records,
      defaultPageSize: 10
    })}
    ${renderDataTable({
      id: "section-mail-mailboxes",
      heading: mailCopy.mailboxesTitle,
      description: mailCopy.formsDescription,
      headingBadgeClassName: "section-badge-lime",
      columns: [
        { label: mailCopy.addressLabel, className: "mono" },
        { label: mailCopy.domainNameLabel },
        { label: mailCopy.primaryNodeLabel },
        { label: mailCopy.hasCredentialLabel },
        { label: mailCopy.quotaBytesLabel, className: "mono" }
      ],
      rows: mailboxRows,
      emptyMessage: mailCopy.noMailboxes,
      filterPlaceholder: copy.dataFilterPlaceholder,
      rowsPerPageLabel: copy.rowsPerPage,
      showingLabel: copy.showing,
      ofLabel: copy.of,
      recordsLabel: copy.records,
      defaultPageSize: 10
    })}
    <div class="grid-two-desktop">
      ${renderDataTable({
        id: "section-mail-aliases",
        heading: mailCopy.aliasesTitle,
        description: mailCopy.description,
        headingBadgeClassName: "section-badge-lime",
        columns: [
          { label: mailCopy.addressLabel, className: "mono" },
          { label: mailCopy.domainNameLabel },
          { label: mailCopy.destinationsLabel, className: "mono" }
        ],
        rows: aliasRows,
        emptyMessage: mailCopy.noAliases,
        filterPlaceholder: copy.dataFilterPlaceholder,
        rowsPerPageLabel: copy.rowsPerPage,
        showingLabel: copy.showing,
        ofLabel: copy.of,
        recordsLabel: copy.records,
        defaultPageSize: 10
      })}
      ${renderDataTable({
        id: "section-mail-quotas",
        heading: mailCopy.quotasTitle,
        description: mailCopy.formsDescription,
        headingBadgeClassName: "section-badge-lime",
        columns: [
          { label: mailCopy.addressLabel, className: "mono" },
          { label: mailCopy.domainNameLabel },
          { label: mailCopy.quotaBytesLabel, className: "mono" }
        ],
        rows: quotaRows,
        emptyMessage: mailCopy.noQuotas,
        filterPlaceholder: copy.dataFilterPlaceholder,
        rowsPerPageLabel: copy.rowsPerPage,
        showingLabel: copy.showing,
        ofLabel: copy.of,
        recordsLabel: copy.records,
        defaultPageSize: 10
      })}
    </div>
    ${formsPanel}
  </section>`;
}
