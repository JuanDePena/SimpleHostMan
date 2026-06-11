import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { IamBindingSummary } from "./iam.js";
import {
  normalizeApacheVhostForParity,
  renderPyrosaIamGatewayApacheVhost
} from "./iam-apache-renderer.js";

function createPgadminGatewayBinding(): IamBindingSummary {
  const now = "2026-06-11T00:00:00.000Z";

  return {
    bindingId: "iam-binding-pyrosa-pgadmin-pyrosa-iam-gateway",
    providerSlug: "pyrosa-iam",
    providerDisplayName: "Pyrosa IAM",
    targetKind: "app",
    targetSlug: "pyrosa-pgadmin",
    externalUrl: "https://pgadmin.pyrosa.com.do/",
    internalUrl: "http://host.containers.internal:10143",
    authMode: "proxy",
    mfaPolicy: "required",
    status: "active",
    renderMode: "metadata_only",
    renderEnabled: false,
    providerProvisioningStatus: "manual_ready",
    allowedGroups: ["PYROSA Operators"],
    config: {
      gatewayProxy: {
        provider: "pyrosa-iam",
        bridgeMode: "local_outpost",
        bridgeListenUrl: "http://127.0.0.1:10144",
        requiredGroups: ["PYROSA Operators"],
        requiredAssuranceLevel: "aal2"
      },
      render: {
        mode: "metadata_only",
        enabled: false,
        candidateVhost: "platform/httpd/vhosts/pyrosa-pgadmin-iam-bridge.conf.candidate",
        liveVhost: "/etc/httpd/conf.d/pyrosa-pgadmin.conf",
        parityRequiredBeforeApply: true
      }
    },
    notes: "Pyrosa IAM gateway bridge is manually active for pgAdmin.",
    createdAt: now,
    updatedAt: now
  };
}

function createLdapGatewayBinding(): IamBindingSummary {
  const now = "2026-06-11T00:00:00.000Z";

  return {
    bindingId: "iam-binding-pyrosa-ldap-pyrosa-iam-gateway",
    providerSlug: "pyrosa-iam",
    providerDisplayName: "Pyrosa IAM",
    targetKind: "app",
    targetSlug: "pyrosa-ldap",
    externalUrl: "https://ldap.pyrosa.com.do/",
    internalUrl: "http://host.containers.internal:10142",
    authMode: "proxy",
    mfaPolicy: "required",
    status: "candidate",
    renderMode: "metadata_only",
    renderEnabled: false,
    providerProvisioningStatus: "pending",
    allowedGroups: ["PYROSA Operators"],
    config: {
      gatewayProxy: {
        provider: "pyrosa-iam",
        bridgeMode: "local_outpost",
        bridgeListenUrl: "http://127.0.0.1:10145",
        requiredGroups: ["PYROSA Operators"],
        requiredAssuranceLevel: "aal2"
      },
      render: {
        mode: "metadata_only",
        enabled: false,
        candidateVhost: "platform/httpd/vhosts/pyrosa-ldap-iam-bridge.conf.candidate",
        liveVhost: "/etc/httpd/conf.d/pyrosa-ldap.conf",
        parityRequiredBeforeApply: true
      }
    },
    notes: "Candidate Pyrosa IAM gateway metadata for LDAP Account Manager.",
    createdAt: now,
    updatedAt: now
  };
}

test("renders the pgAdmin Pyrosa IAM Apache bridge vhost from IAM binding metadata", async () => {
  const rendered = renderPyrosaIamGatewayApacheVhost(createPgadminGatewayBinding());
  const candidate = await readFile(
    new URL("../../../platform/httpd/vhosts/pyrosa-pgadmin-iam-bridge.conf.candidate", import.meta.url),
    "utf8"
  );

  assert.equal(rendered.serverName, "pgadmin.pyrosa.com.do");
  assert.equal(rendered.upstreamUrl, "http://127.0.0.1:10144/");
  assert.equal(rendered.certificateName, "pyrosa.com.do");
  assert.equal(rendered.logName, "pyrosa-pgadmin_iam_bridge");
  assert.equal(
    normalizeApacheVhostForParity(rendered.content),
    normalizeApacheVhostForParity(candidate)
  );
});

test("renders the LDAP Pyrosa IAM Apache bridge vhost from IAM binding metadata", async () => {
  const rendered = renderPyrosaIamGatewayApacheVhost(createLdapGatewayBinding());
  const candidate = await readFile(
    new URL("../../../platform/httpd/vhosts/pyrosa-ldap-iam-bridge.conf.candidate", import.meta.url),
    "utf8"
  );

  assert.equal(rendered.serverName, "ldap.pyrosa.com.do");
  assert.equal(rendered.upstreamUrl, "http://127.0.0.1:10145/");
  assert.equal(rendered.certificateName, "pyrosa.com.do");
  assert.equal(rendered.logName, "pyrosa-ldap_iam_bridge");
  assert.equal(
    normalizeApacheVhostForParity(rendered.content),
    normalizeApacheVhostForParity(candidate)
  );
});

test("rejects non Pyrosa IAM proxy bindings for Apache gateway rendering", () => {
  assert.throws(
    () =>
      renderPyrosaIamGatewayApacheVhost({
        ...createPgadminGatewayBinding(),
        providerSlug: "authentik"
      }),
    /not a pyrosa-iam proxy gateway binding/
  );
});
