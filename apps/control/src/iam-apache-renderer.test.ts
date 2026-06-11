import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { IamBindingSummary } from "@simplehost/control-contracts";

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

test("renders the pgAdmin Pyrosa IAM Apache bridge vhost from IAM binding metadata", async () => {
  const rendered = renderPyrosaIamGatewayApacheVhost(createPgadminGatewayBinding());
  const candidate = await readFile(
    new URL("../../../platform/httpd/vhosts/pyrosa-pgadmin-iam-bridge.conf.candidate", import.meta.url),
    "utf8"
  );

  assert.equal(rendered.serverName, "pgadmin.pyrosa.com.do");
  assert.equal(rendered.upstreamUrl, "http://127.0.0.1:10144/");
  assert.equal(rendered.certificateName, "pyrosa.com.do");
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
