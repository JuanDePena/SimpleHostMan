import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import type { PoolClient } from "pg";

import {
  createDefaultMailPolicy,
  createDispatchedJobEnvelope
} from "@simplehost/control-contracts";

import { createQueuedDispatchJob } from "./control-plane-store-helpers.js";
import {
  buildAppContainerPlans,
  buildIamOverview,
  buildProxyPayload,
  buildZoneDnsPlans,
  mergeJobHistoryRows,
  purgeOperationalHistoryRows,
  shouldDispatchQueuedJob
} from "./control-plane-store-operations.js";
import { buildDesiredStateSpecFromInventory } from "./control-plane-store-spec.js";
import type { JobHistoryRow } from "./control-plane-store-types.js";

function createMailSyncJob(payload: Record<string, unknown>) {
  return createQueuedDispatchJob(
    createDispatchedJobEnvelope("mail.sync", "mail-a", "desired-v1", payload),
    "mail:mail-a",
    "mail"
  );
}

function createStubClient(rows: Array<Record<string, unknown>>): PoolClient {
  return {
    query: async () => ({ rows })
  } as unknown as PoolClient;
}

function createSequenceStubClient(rowSets: Array<Array<Record<string, unknown>>>): PoolClient {
  let queryIndex = 0;

  return {
    query: async () => ({ rows: rowSets[queryIndex++] ?? [] })
  } as unknown as PoolClient;
}

function createJobHistoryRow(
  id: string,
  kind: string,
  createdAt: string,
  resourceKey?: string | null
): JobHistoryRow {
  return {
    id,
    desired_state_version: "desired-v1",
    kind,
    node_id: "primary",
    created_at: createdAt,
    claimed_at: createdAt,
    completed_at: createdAt,
    payload: {},
    status: "applied",
    summary: `${kind} applied`,
    details: null,
    dispatch_reason: null,
    resource_key: resourceKey ?? null
  };
}

test("shouldDispatchQueuedJob skips stable pending mail.sync payloads", async () => {
  const job = createMailSyncJob({
    policy: createDefaultMailPolicy(),
    domains: [{ domainName: "example.com", deliveryRole: "primary" }]
  });
  const client = createStubClient([
    {
      id: "job-old",
      payload_hash: job.payloadHash,
      completed_at: null,
      status: null,
      summary: null
    }
  ]);

  const shouldDispatch = await shouldDispatchQueuedJob(client, job);

  assert.equal(shouldDispatch, false);
});

test("shouldDispatchQueuedJob skips stable applied mail.sync payloads", async () => {
  const job = createMailSyncJob({
    policy: createDefaultMailPolicy(),
    domains: [{ domainName: "example.com", deliveryRole: "primary" }]
  });
  const client = createStubClient([
    {
      id: "job-old",
      payload_hash: job.payloadHash,
      completed_at: "2026-04-21T12:00:00.000Z",
      status: "applied",
      summary: "mail.sync applied"
    }
  ]);

  const shouldDispatch = await shouldDispatchQueuedJob(client, job);

  assert.equal(shouldDispatch, false);
});

test("shouldDispatchQueuedJob redispatches when mail.sync payload changes", async () => {
  const previousJob = createMailSyncJob({
    policy: createDefaultMailPolicy(),
    domains: [{ domainName: "example.com", deliveryRole: "primary" }]
  });
  const nextJob = createMailSyncJob({
    policy: createDefaultMailPolicy(),
    domains: [
      { domainName: "example.com", deliveryRole: "primary" },
      { domainName: "example.org", deliveryRole: "primary" }
    ]
  });
  const client = createStubClient([
    {
      id: "job-old",
      payload_hash: previousJob.payloadHash,
      completed_at: "2026-04-21T12:00:00.000Z",
      status: "applied",
      summary: "mail.sync applied"
    }
  ]);

  const shouldDispatch = await shouldDispatchQueuedJob(client, nextJob);

  assert.equal(shouldDispatch, true);
});

test("mergeJobHistoryRows keeps the latest applied dns.sync rows alongside recent churn", () => {
  const recentRows = [
    createJobHistoryRow("job-mail-2", "mail.sync", "2026-04-24T23:41:47.000Z", "mail:secondary"),
    createJobHistoryRow("job-mail-1", "mail.sync", "2026-04-24T23:41:46.000Z", "mail:primary")
  ];
  const latestAppliedDnsRows = [
    createJobHistoryRow(
      "job-dns-1",
      "dns.sync",
      "2026-04-24T22:33:55.000Z",
      "zone:adudoc.com"
    )
  ];

  const merged = mergeJobHistoryRows(recentRows, latestAppliedDnsRows);

  assert.deepEqual(
    merged.map((row) => row.id),
    ["job-mail-2", "job-mail-1", "job-dns-1"]
  );
});

test("mergeJobHistoryRows de-duplicates dns.sync rows already present in the recent window", () => {
  const dnsRow = createJobHistoryRow(
    "job-dns-1",
    "dns.sync",
    "2026-04-24T22:33:55.000Z",
    "zone:adudoc.com"
  );

  const merged = mergeJobHistoryRows([dnsRow], [dnsRow]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.id, "job-dns-1");
});

test("iam provider selection migration defines tables, seeds, and session metadata", () => {
  const migrationSql = readFileSync(
    new URL("../migrations/0018_iam_provider_selection.sql", import.meta.url),
    "utf8"
  );

  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS control_plane_iam_providers/);
  assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS control_plane_iam_bindings/);
  assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS auth_provider_slug/);
  assert.match(migrationSql, /'authentik'/);
  assert.match(migrationSql, /'pyrosa-accounts'/);
  assert.match(migrationSql, /'iam-binding-simplehost-control'/);
});

test("iam provider selection phase 5-7 migration adds render state and ui-auth bindings", () => {
  const migrationSql = readFileSync(
    new URL("../migrations/0019_iam_provider_selection_phase_5_7.sql", import.meta.url),
    "utf8"
  );

  assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS render_mode/);
  assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS provider_provisioning_status/);
  assert.match(migrationSql, /'metadata_only'/);
  assert.match(migrationSql, /'apache_managed'/);
  assert.match(migrationSql, /'iam-binding-pyrosa-directory'/);
  assert.match(migrationSql, /'iam-binding-pyrosa-newsync'/);
  assert.match(migrationSql, /"gateway_proxy"/);
  assert.match(migrationSql, /PYROSA_DIRECTORY_ACCOUNTS_CLIENT_SECRET/);
  assert.match(migrationSql, /PYROSA_SYNC_UI_AUTH_CLIENT_SECRET/);
});

test("iam pyrosa accounts oauth pilot migration records validated capability state", () => {
  const migrationSql = readFileSync(
    new URL("../migrations/0021_iam_pyrosa_accounts_oauth_pilot_validated.sql", import.meta.url),
    "utf8"
  );

  assert.match(migrationSql, /"status": "pilot_validated"/);
  assert.match(migrationSql, /simplehost-control-oauth-pilot/);
  assert.match(migrationSql, /"requiredAssuranceLevel": "aal2"/);
  assert.match(migrationSql, /"surfaceReadiness": "candidate_only"/);
});

test("oauth session metadata migration stores non-sensitive logout references", () => {
  const migrationSql = readFileSync(
    new URL("../migrations/0022_oauth_session_metadata.sql", import.meta.url),
    "utf8"
  );

  assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS oauth_client_id/);
  assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS oauth_scopes/);
  assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS oauth_token_hash/);
  assert.match(migrationSql, /control_plane_sessions_auth_provider_idx/);
});

test("iam pyrosa accounts oauth login candidate migration keeps authentik active", () => {
  const migrationSql = readFileSync(
    new URL("../migrations/0023_iam_pyrosa_accounts_oauth_login_candidate.sql", import.meta.url),
    "utf8"
  );

  assert.match(migrationSql, /'oauth_login'/);
  assert.match(migrationSql, /control_plane_iam_bindings_active_target_idx/);
  assert.match(migrationSql, /iam-binding-simplehost-control-pyrosa-oauth/);
  assert.match(migrationSql, /"promotionState": "candidate"/);
  assert.match(migrationSql, /"activeOuterGate": "authentik"/);
});

test("iam pyrosa accounts oidc readiness migration keeps oidc future-gated", () => {
  const migrationSql = readFileSync(
    new URL("../migrations/0024_iam_pyrosa_accounts_oidc_readiness.sql", import.meta.url),
    "utf8"
  );

  assert.match(migrationSql, /"oidcReadiness"/);
  assert.match(migrationSql, /"advertiseAsProvider": false/);
  assert.match(migrationSql, /accounts_oidc_release/);
  assert.match(migrationSql, /openid-configuration/);
  assert.match(migrationSql, /jwks/);
  assert.match(migrationSql, /signed_id_tokens/);
  assert.match(migrationSql, /userinfo/);
});

test("iam pyrosa accounts gateway readiness migration keeps gateway future-gated", () => {
  const migrationSql = readFileSync(
    new URL("../migrations/0025_iam_pyrosa_accounts_gateway_readiness.sql", import.meta.url),
    "utf8"
  );

  assert.match(migrationSql, /"gatewayProxyReadiness"/);
  assert.match(migrationSql, /"advertiseAsProvider": false/);
  assert.match(migrationSql, /accounts_gateway_proxy_release/);
  assert.match(migrationSql, /forward_auth_or_outpost/);
  assert.match(migrationSql, /internal_trust_boundary/);
  assert.match(migrationSql, /upstream_header_mapping/);
  assert.match(migrationSql, /unsafe_method_tests/);
  assert.match(migrationSql, /pilot_app/);
});

test("iam pyrosa accounts oidc candidate migration keeps authentik active", () => {
  const migrationSql = readFileSync(
    new URL("../migrations/0027_iam_pyrosa_accounts_oidc_candidate.sql", import.meta.url),
    "utf8"
  );

  assert.match(migrationSql, /"oidcReadiness"/);
  assert.match(migrationSql, /"status": "pilot_validated"/);
  assert.match(migrationSql, /simplehost_oidc_login_pilot/);
  assert.match(migrationSql, /iam-binding-simplehost-control-pyrosa-oidc/);
  assert.match(migrationSql, /'oidc'/);
  assert.match(migrationSql, /"activeOuterGate": "authentik"/);
  assert.match(migrationSql, /"mode": "metadata_only"/);
});

test("iam pyrosa accounts saml migration keeps saml disabled by decision", () => {
  const migrationSql = readFileSync(
    new URL("../migrations/0026_iam_pyrosa_accounts_saml_disabled.sql", import.meta.url),
    "utf8"
  );

  assert.match(migrationSql, /"samlDecision"/);
  assert.match(migrationSql, /"status": "disabled"/);
  assert.match(migrationSql, /"advertiseAsProvider": false/);
  assert.match(migrationSql, /no_concrete_saml_requirement/);
  assert.match(migrationSql, /concrete_saml_requirement/);
  assert.match(migrationSql, /SAML metadata/);
  assert.match(migrationSql, /ACS handling/);
});

test("buildIamOverview maps provider capabilities and protected bindings", async () => {
  const overview = await buildIamOverview(
    createSequenceStubClient([
      [
        {
          provider_id: "iam-provider-authentik",
          slug: "authentik",
          display_name: "Authentik",
          kind: "authentik",
          status: "active",
          base_url: "https://auth.pyrosa.com.do",
          capabilities: ["proxy", "trusted_proxy_headers"],
          config_json: {
            signOutPath: "/outpost.goauthentik.io/sign_out",
            capabilityStatus: [
              { key: "proxy", status: "available" },
              { key: "oauth", status: "pilot_validated" },
              { key: "gateway_proxy", status: "future" }
            ]
          },
          notes: "Default IAM provider.",
          created_at: "2026-06-07T00:00:00.000Z",
          updated_at: "2026-06-07T00:00:00.000Z"
        }
      ],
      [
        {
          binding_id: "iam-binding-simplehost-control",
          provider_slug: "authentik",
          provider_display_name: "Authentik",
          target_kind: "control",
          target_slug: "simplehost-control",
          external_url: "https://vps-prd.pyrosa.com.do:3200/",
          internal_url: "http://host.containers.internal:13200",
          auth_mode: "trusted_proxy_headers",
          mfa_policy: "required",
          status: "active",
          render_mode: "metadata_only",
          provider_provisioning_status: "manual_ready",
          allowed_groups: ["PYROSA Operators"],
          config_json: {},
          notes: "Existing handoff.",
          created_at: "2026-06-07T00:00:00.000Z",
          updated_at: "2026-06-07T00:00:00.000Z"
        },
        {
          binding_id: "iam-binding-simplehost-control-pyrosa-oauth",
          provider_slug: "pyrosa-accounts",
          provider_display_name: "Pyrosa Accounts",
          target_kind: "control",
          target_slug: "simplehost-control",
          external_url: "https://vps-prd.pyrosa.com.do:3200/",
          internal_url: "http://host.containers.internal:13200",
          auth_mode: "oauth_login",
          mfa_policy: "required",
          status: "candidate",
          render_mode: "metadata_only",
          provider_provisioning_status: "manual_ready",
          allowed_groups: ["PYROSA Operators"],
          config_json: {
            oauthLogin: {
              clientId: "simplehost-control-oauth-pilot",
              promotionState: "candidate"
            }
          },
          notes: "OAuth candidate.",
          created_at: "2026-06-09T00:00:00.000Z",
          updated_at: "2026-06-09T00:00:00.000Z"
        }
      ],
      [
        {
          occurred_at: "2026-06-09T00:20:35.000Z",
          provider: "pyrosa-accounts",
          email: "it@pyrosa.com.do",
          reason: null,
          assurance_level: "aal2"
        }
      ],
      [
        {
          occurred_at: "2026-06-09T00:25:00.000Z",
          provider: "pyrosa-accounts",
          email: null,
          reason: "missing_email",
          assurance_level: "aal2"
        }
      ]
    ])
  );

  assert.deepEqual(overview.providers[0]?.capabilities, ["proxy", "trusted_proxy_headers"]);
  assert.deepEqual(overview.providers[0]?.capabilityStatus, [
    { key: "proxy", status: "available", notes: undefined },
    { key: "oauth", status: "pilot_validated", notes: undefined },
    { key: "gateway_proxy", status: "future", notes: undefined }
  ]);
  assert.equal(overview.bindings[0]?.targetSlug, "simplehost-control");
  assert.equal(overview.bindings[0]?.authMode, "trusted_proxy_headers");
  assert.equal(overview.bindings[0]?.renderMode, "metadata_only");
  assert.equal(overview.bindings[0]?.renderEnabled, false);
  assert.equal(overview.bindings[0]?.providerProvisioningStatus, "manual_ready");
  assert.deepEqual(overview.bindings[0]?.allowedGroups, ["PYROSA Operators"]);
  assert.equal(overview.bindings[1]?.authMode, "oauth_login");
  assert.equal(overview.bindings[1]?.status, "candidate");
  assert.equal(overview.operationalState.activeControlProviderSlug, "authentik");
  assert.equal(overview.operationalState.activeControlAuthMode, "trusted_proxy_headers");
  assert.equal(overview.operationalState.candidateControlProviderSlug, "pyrosa-accounts");
  assert.equal(overview.operationalState.candidateControlAuthMode, "oauth_login");
  assert.equal(overview.operationalState.lastOAuthLoginEmail, "it@pyrosa.com.do");
  assert.equal(overview.operationalState.lastOAuthFailureReason, "missing_email");
});

test("purgeOperationalHistoryRows preserves latest resource jobs while deleting old history", async () => {
  const statements: string[] = [];
  const client = {
    query: async (statement: string, params?: unknown[]) => {
      statements.push(statement);
      assert.deepEqual(params, ["2026-01-30T00:00:00.000Z"]);

      if (statement.includes("latest_resource_jobs")) {
        assert.match(statement, /resource_key IS NOT NULL/);
        assert.match(statement, /jobs\.completed_at IS NOT NULL/);
        assert.match(statement, /jobs\.completed_at < \$1::timestamptz/);
        assert.match(statement, /NOT EXISTS/);

        return {
          rows: [
            {
              deleted_job_count: "3",
              deleted_job_result_count: "3",
              kept_latest_resource_job_count: "5"
            }
          ]
        };
      }

      if (statement.includes("latest_inventory_export")) {
        assert.match(statement, /event_type = 'inventory\.exported'/);
        assert.match(statement, /events\.occurred_at < \$1::timestamptz/);
        assert.match(statement, /NOT EXISTS/);

        return {
          rows: [
            {
              deleted_audit_event_count: "2"
            }
          ]
        };
      }

      if (statement.includes("latest_reconciliation_run")) {
        assert.match(statement, /FROM control_plane_reconciliation_runs/);
        assert.match(statement, /runs\.completed_at < \$1::timestamptz/);
        assert.match(statement, /NOT EXISTS/);

        return {
          rows: [
            {
              deleted_reconciliation_run_count: "7"
            }
          ]
        };
      }

      throw new Error(`Unexpected purge query: ${statement}`);
    }
  } as unknown as PoolClient;

  const summary = await purgeOperationalHistoryRows(client, "2026-01-30T00:00:00.000Z");

  assert.equal(statements.length, 3);
  assert.deepEqual(summary, {
    deletedAuditEventCount: 2,
    deletedReconciliationRunCount: 7,
    deletedJobCount: 3,
    deletedJobResultCount: 3,
    keptLatestResourceJobCount: 5
  });
});

test("buildZoneDnsPlans publishes node hostnames and dispatches primary plus secondary plans", async () => {
  const client = {
    query: async (statement: string, params?: unknown[]) => {
      if (
        statement.includes("FROM control_plane_dns_zones zones") &&
        statement.includes("desired_updated_at")
      ) {
        return {
          rows: [
            {
              zone_name: "adudoc.com",
              primary_node_id: "primary",
              hostname: "vps-3dbbfb0b.vps.ovh.ca",
              public_ipv4: "51.222.204.86",
              wireguard_address: "10.89.0.1/24",
              desired_updated_at: "2026-04-26T02:00:00.000Z"
            }
          ]
        };
      }

      if (statement.includes("FROM control_plane_nodes") && statement.includes("CASE WHEN node_id = $1")) {
        assert.deepEqual(params, ["primary"]);
        return {
          rows: [
            {
              node_id: "primary",
              hostname: "vps-3dbbfb0b.vps.ovh.ca",
              public_ipv4: "51.222.204.86",
              wireguard_address: "10.89.0.1/24"
            },
            {
              node_id: "secondary",
              hostname: "vps-16535090.vps.ovh.ca",
              public_ipv4: "51.222.206.196",
              wireguard_address: "10.89.0.2/24"
            }
          ]
        };
      }

      if (statement.includes("FROM control_plane_dns_records records")) {
        return { rows: [] };
      }

      if (statement.includes("FROM control_plane_sites sites")) {
        return { rows: [] };
      }

      if (statement.includes("FROM control_plane_mail_domains domains")) {
        return { rows: [] };
      }

      if (statement.includes("FROM control_plane_job_results results")) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query in buildZoneDnsPlans test: ${statement}`);
    }
  } as unknown as PoolClient;

  const plans = await buildZoneDnsPlans(client, "adudoc.com");

  assert.equal(plans.length, 2);
  assert.deepEqual(
    plans.map((plan) => plan.nodeId),
    ["primary", "secondary"]
  );
  assert.deepEqual(plans[0]?.payload.nameservers, [
    "vps-3dbbfb0b.vps.ovh.ca",
    "vps-16535090.vps.ovh.ca"
  ]);
  assert.deepEqual(plans[0]?.payload.primaryAddresses, ["51.222.204.86", "10.89.0.1"]);
  assert.equal(plans[0]?.payload.deliveryRole, "primary");
  assert.equal(plans[1]?.payload.deliveryRole, "secondary");
});

test("buildAppContainerPlans preserves pgAdmin data and config mounts", async () => {
  const client = {
    query: async () => ({
      rows: [
        {
          slug: "pyrosa-pgadmin",
          backend_port: 10143,
          runtime_image: "registry.example.com/pyrosa-pgadmin:stable",
          storage_root: "/srv/containers/apps/pyrosa-pgadmin",
          primary_node_id: "primary",
          standby_node_id: "secondary",
          mode: "active-passive",
          canonical_domain: "pgadmin.pyrosa.com.do",
          aliases: [],
          database_engine: null,
          database_name: null,
          database_user: null,
          database_primary_node_id: null,
          database_primary_wireguard_address: null,
          desired_password: null
        }
      ]
    })
  } as unknown as PoolClient;

  const result = await buildAppContainerPlans(client, "pyrosa-pgadmin", null);

  assert.equal(result.credentialMissing, false);
  assert.equal(result.plans.length, 2);
  assert.deepEqual(result.plans.map((plan) => plan.nodeId), ["primary", "secondary"]);
  assert.deepEqual(result.plans[0]?.payload.volumes, [
    "/srv/containers/apps/pyrosa-pgadmin/data:/var/lib/pgadmin:Z",
    "/srv/containers/apps/pyrosa-pgadmin/config/config_local.py:/pgadmin4/config_local.py:Z"
  ]);
  assert.deepEqual(result.plans[0]?.payload.hostDirectories, [
    "/srv/containers/apps/pyrosa-pgadmin",
    "/srv/containers/apps/pyrosa-pgadmin/data",
    "/srv/containers/apps/pyrosa-pgadmin/config"
  ]);
  assert.equal(
    result.plans[0]?.payload.environment?.PGADMIN_DEFAULT_PASSWORD_FILE,
    "/var/lib/pgadmin/.default-password"
  );
  assert.equal(
    result.plans[0]?.payload.environment?.PGADMIN_DEFAULT_EMAIL,
    "webmaster@pyrosa.com.do"
  );
});

test("buildProxyPayload uses the managed Pyrosa wildcard certificate", async () => {
  const client = {
    query: async () => ({
      rows: [
        {
          app_id: "app-pyrosa-ldap",
          slug: "pyrosa-ldap",
          backend_port: 10142,
          runtime_image: "registry.example.com/pyrosa-ldap:stable",
          primary_node_id: "primary",
          standby_node_id: "secondary",
          mode: "active-passive",
          zone_name: "pyrosa.com.do",
          canonical_domain: "ldap.pyrosa.com.do",
          aliases: [],
          storage_root: "/srv/containers/apps/pyrosa-ldap"
        }
      ]
    })
  } as unknown as PoolClient;

  const result = await buildProxyPayload(client, "pyrosa-ldap");

  assert.equal(result.plans.length, 2);
  assert.equal(
    result.plans[0]?.payload.tlsCertificateFile,
    "/etc/ssl/simplehostman/pyrosa.com.do/fullchain.pem"
  );
  assert.equal(
    result.plans[0]?.payload.tlsCertificateKeyFile,
    "/etc/ssl/simplehostman/pyrosa.com.do/privkey.pem"
  );
});

test("buildProxyPayload preserves the Pyrosa helpers DFR route", async () => {
  const client = {
    query: async () => ({
      rows: [
        {
          app_id: "app-pyrosa-helpers",
          slug: "pyrosa-helpers",
          backend_port: 10161,
          runtime_image: "registry.example.com/pyrosa-helpers:stable",
          primary_node_id: "primary",
          standby_node_id: "secondary",
          mode: "active-passive",
          zone_name: "pyrosa.com.do",
          canonical_domain: "helpers.pyrosa.com.do",
          aliases: [],
          storage_root: "/srv/containers/apps/pyrosa-helpers"
        }
      ]
    })
  } as unknown as PoolClient;

  const result = await buildProxyPayload(client, "pyrosa-helpers");

  assert.deepEqual(result.plans[0]?.payload.extraProxyRoutes, [
    {
      pathPrefix: "/dfr/",
      targetUrl: "http://127.0.0.1:10162/",
      websocket: true,
      noCanon: true,
      timeoutSeconds: 120
    }
  ]);
});

test("buildDesiredStateSpecFromInventory supports apps without databases", () => {
  const spec = buildDesiredStateSpecFromInventory({
    nodes: {
      primary: {
        hostname: "vps-3dbbfb0b.vps.ovh.ca",
        public_ipv4: "51.222.204.86",
        wireguard_address: "10.89.0.1/24"
      },
      secondary: {
        hostname: "vps-16535090.vps.ovh.ca",
        public_ipv4: "51.222.206.196",
        wireguard_address: "10.89.0.2/24"
      }
    },
    platform: {
      postgresql_apps: {
        primary_node: "primary",
        standby_node: "secondary",
        primary_port: 5432
      },
      postgresql_control: {
        primary_node: "primary",
        standby_node: "secondary",
        primary_port: 5433,
        database: "simplehost_control",
        user: "simplehost_control"
      },
      mariadb_apps: {
        primary_node: "primary",
        replica_node: "secondary",
        primary_port: 3306
      }
    },
    apps: [
      {
        slug: "pyrosa-repos",
        client: "pyrosa",
        zone: "pyrosa.com.do",
        canonical_domain: "repos.pyrosa.com.do",
        aliases: [],
        backend_port: 10141,
        runtime_image: "registry.example.com/pyrosa-repos:stable",
        storage_root: "/srv/containers/apps/pyrosa-repos",
        mode: "active-passive"
      }
    ]
  });

  assert.equal(spec.apps[0]?.primaryNodeId, "primary");
  assert.equal(spec.apps[0]?.standbyNodeId, "secondary");
  assert.equal(spec.databases.length, 0);
  assert.equal(spec.zones[0]?.zoneName, "pyrosa.com.do");
});

test("buildDesiredStateSpecFromInventory supports multiple managed databases per app", () => {
  const spec = buildDesiredStateSpecFromInventory({
    nodes: {
      primary: {
        hostname: "vps-3dbbfb0b.vps.ovh.ca",
        public_ipv4: "51.222.204.86",
        wireguard_address: "10.89.0.1/24"
      },
      secondary: {
        hostname: "vps-16535090.vps.ovh.ca",
        public_ipv4: "51.222.206.196",
        wireguard_address: "10.89.0.2/24"
      }
    },
    platform: {
      postgresql_apps: {
        primary_node: "primary",
        standby_node: "secondary",
        primary_port: 5432
      },
      postgresql_control: {
        primary_node: "primary",
        standby_node: "secondary",
        primary_port: 5433,
        database: "simplehost_control",
        user: "simplehost_control"
      },
      mariadb_apps: {
        primary_node: "primary",
        replica_node: "secondary",
        primary_port: 3306
      }
    },
    apps: [
      {
        slug: "pyrosa-sync",
        client: "pyrosa",
        zone: "pyrosa.com.do",
        canonical_domain: "sync.pyrosa.com.do",
        aliases: [],
        backend_port: 10121,
        runtime_image: "registry.example.com/pyrosa-sync:stable",
        databases: [
          {
            id: "database-pyrosa-sync",
            role: "dis",
            engine: "mariadb",
            name: "app_pyrosa_sync",
            user: "app_pyrosa_sync"
          },
          {
            id: "database-pyrosa-sync-qbo",
            role: "qbo",
            engine: "mariadb",
            name: "app_pyrosa_sync_qbo",
            user: "app_pyrosa_sync_qbo"
          }
        ],
        storage_root: "/srv/containers/apps/pyrosa-sync",
        mode: "active-passive"
      }
    ]
  });

  assert.deepEqual(
    spec.databases.map((database) => database.databaseId),
    ["database-pyrosa-sync", "database-pyrosa-sync-qbo"]
  );
  assert.deepEqual(
    spec.databases.map((database) => database.databaseName),
    ["app_pyrosa_sync", "app_pyrosa_sync_qbo"]
  );
});
