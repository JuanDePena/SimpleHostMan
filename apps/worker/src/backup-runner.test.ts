import assert from "node:assert/strict";
import test from "node:test";

import {
  matchesCronExpression,
  policyCoversDatabase,
  policyCoversMailDomain,
  resolveLocalNodeId,
  shouldRunPolicyAtTime
} from "./backup-runner.js";

test("matchesCronExpression supports wildcards, steps, and explicit values", () => {
  assert.equal(matchesCronExpression("0 3 * * *", new Date("2026-04-25T03:00:00Z")), true);
  assert.equal(matchesCronExpression("0 3 * * *", new Date("2026-04-25T03:01:00Z")), false);
  assert.equal(matchesCronExpression("*/5 * * * *", new Date("2026-04-25T03:10:00Z")), true);
  assert.equal(matchesCronExpression("*/5 * * * *", new Date("2026-04-25T03:12:00Z")), false);
});

test("shouldRunPolicyAtTime prevents duplicate runs in the same scheduled minute", () => {
  const now = new Date("2026-04-25T03:00:10Z");

  assert.equal(
    shouldRunPolicyAtTime({
      schedule: "0 3 * * *",
      latestRun: undefined,
      now
    }),
    true
  );
  assert.equal(
    shouldRunPolicyAtTime({
      schedule: "0 3 * * *",
      latestRun: {
        runId: "backup-run-1",
        policySlug: "mail-adudoc-daily",
        nodeId: "primary",
        status: "succeeded",
        summary: "ok",
        startedAt: "2026-04-25T03:00:05Z"
      },
      now
    }),
    false
  );
});

test("resolveLocalNodeId falls back to hostname matching", () => {
  assert.equal(
    resolveLocalNodeId(
      { SIMPLEHOST_HOSTNAME: "vps-3dbbfb0b.vps.ovh.ca" },
      [
        {
          nodeId: "primary",
          hostname: "vps-3dbbfb0b.vps.ovh.ca",
          publicIpv4: "51.222.204.86",
          wireguardAddress: "10.89.0.1/24"
        }
      ],
      []
    ),
    "primary"
  );
});

test("policyCoversMailDomain matches tenant, mail-stack, and explicit domain selectors", () => {
  const policy = {
    policySlug: "mail-adudoc-daily",
    tenantSlug: "adudoc",
    targetNodeId: "primary",
    schedule: "0 3 * * *",
    retentionDays: 14,
    storageLocation: "/srv/backups/mail-adudoc",
    resourceSelectors: ["mail-stack", "mail-domain:adudoc.com"]
  };

  assert.equal(
    policyCoversMailDomain(policy, {
      domainName: "adudoc.com",
      tenantSlug: "adudoc",
      zoneName: "adudoc.com",
      primaryNodeId: "primary",
      mailHost: "mail.adudoc.com",
      dkimSelector: "mail"
    }),
    true
  );
  assert.equal(
    policyCoversMailDomain(policy, {
      domainName: "other.com",
      tenantSlug: "other",
      zoneName: "other.com",
      primaryNodeId: "primary",
      mailHost: "mail.other.com",
      dkimSelector: "mail"
    }),
    false
  );
});

test("policyCoversDatabase recognizes app and database selectors", () => {
  const policy = {
    policySlug: "db-adudoc-daily",
    tenantSlug: "adudoc",
    targetNodeId: "primary",
    schedule: "0 1 * * *",
    retentionDays: 14,
    storageLocation: "/srv/backups/databases/adudoc",
    resourceSelectors: ["app:adudoc", "database:app_adudoc"]
  };

  assert.equal(
    policyCoversDatabase(
      policy,
      {
        appSlug: "adudoc",
        engine: "postgresql",
        databaseName: "app_adudoc",
        databaseUser: "app_adudoc",
        primaryNodeId: "primary"
      },
      "adudoc"
    ),
    true
  );
  assert.equal(
    policyCoversDatabase(
      policy,
      {
        appSlug: "gomezrosado",
        engine: "postgresql",
        databaseName: "app_gomezrosado",
        databaseUser: "app_gomezrosado",
        primaryNodeId: "primary"
      },
      "gomezrosado"
    ),
    false
  );
});

