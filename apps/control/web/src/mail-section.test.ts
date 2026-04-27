import assert from "node:assert/strict";
import test from "node:test";

import { renderFocusLink, renderActionForm } from "./dashboard-links.js";
import { formatDate, renderPill, renderSelectOptions } from "./dashboard-formatters.js";
import { createMailReleaseBaselineData } from "./mail-release-baseline.js";
import { renderMailSection } from "./mail-section.js";
import { renderDetailGrid, renderSignalStripHtml } from "./panel-renderers.js";

test("renderMailSection scopes mailbox and alias tables to the selected mail domain", () => {
  const data = JSON.parse(JSON.stringify(createMailReleaseBaselineData()));

  data.desiredState.summary.mailDomainCount = 2;
  data.desiredState.summary.mailboxCount = 2;
  data.desiredState.summary.mailAliasCount = 1;
  data.desiredState.spec.zones.push({
    zoneName: "example.net",
    tenantSlug: "acme",
    primaryNodeId: "mail-a",
    records: []
  });
  data.desiredState.spec.mailDomains.push({
    domainName: "example.net",
    tenantSlug: "acme",
    zoneName: "example.net",
    primaryNodeId: "mail-a",
    mailHost: "mail.example.net",
    dkimSelector: "mail"
  });
  data.desiredState.spec.mailboxes.push({
    address: "alerts@example.net",
    domainName: "example.net",
    localPart: "alerts",
    primaryNodeId: "mail-a",
    credentialState: "configured"
  });
  data.desiredState.spec.mailAliases.push({
    address: "ops@example.net",
    domainName: "example.net",
    localPart: "ops",
    destinations: ["alerts@example.net"]
  });
  data.mail.domains.push({
    domainName: "example.net",
    tenantSlug: "acme",
    zoneName: "example.net",
    primaryNodeId: "mail-a",
    mailHost: "mail.example.net",
    dkimSelector: "mail",
    mailboxCount: 1,
    aliasCount: 1
  });
  data.mail.mailboxes.push({
    address: "alerts@example.net",
    domainName: "example.net",
    localPart: "alerts",
    primaryNodeId: "mail-a",
    hasCredential: true,
    credentialState: "configured"
  });
  data.mail.aliases.push({
    address: "ops@example.net",
    domainName: "example.net",
    localPart: "ops",
    destinations: ["alerts@example.net"]
  });

  const html = renderMailSection(
    data,
    {
      none: "none",
      navNodes: "Nodes",
      dataFilterPlaceholder: "Filter records",
      rowsPerPage: "Rows per page",
      showing: "Showing",
      of: "of",
      records: "records",
      selectedStateLabel: "Selected"
    },
    "en",
    "example.com",
    "/?view=mail&focus=example.com",
    undefined,
    {
      renderPill,
      renderFocusLink: (label, href, active, activeLabel) =>
        renderFocusLink(label, href, active, activeLabel, renderPill),
      renderDetailGrid,
      renderActionForm,
      renderSignalStrip: (entries) => renderSignalStripHtml(entries, renderPill),
      renderSelectOptions,
      formatDate
    }
  );
  const mailboxTableHtml =
    /<section id="section-mail-mailboxes"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";
  const aliasTableHtml =
    /<section id="section-mail-aliases"[\s\S]*?<\/section>/.exec(html)?.[0] ?? "";

  assert.match(mailboxTableHtml, /ops@example\.com/);
  assert.doesNotMatch(mailboxTableHtml, /alerts@example\.net/);
  assert.doesNotMatch(aliasTableHtml, /ops@example\.net/);
});
