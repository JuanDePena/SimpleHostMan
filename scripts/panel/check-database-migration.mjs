#!/usr/bin/env node

function parseArgs(argv) {
  let appSlug = "";
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--app") {
      appSlug = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (value === "--json") {
      json = true;
      continue;
    }

    if (!value.startsWith("--") && !appSlug) {
      appSlug = value;
    }
  }

  if (!appSlug) {
    throw new Error("Usage: pnpm audit:migration -- --app <slug> [--json]");
  }

  return { appSlug, json };
}

function createApiBaseUrl() {
  if (process.env.SHP_API_BASE_URL) {
    return process.env.SHP_API_BASE_URL;
  }

  const host = process.env.SHP_API_HOST ?? "127.0.0.1";
  const port = process.env.SHP_API_PORT ?? "3100";
  return `http://${host}:${port}`;
}

async function apiRequest(pathname, token, options = {}) {
  const response = await fetch(new URL(pathname, createApiBaseUrl()), {
    method: options.method ?? "GET",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { "content-type": "application/json; charset=utf-8" } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${pathname} failed with ${response.status}: ${responseText || response.statusText}`
    );
  }

  return responseText ? JSON.parse(responseText) : null;
}

async function resolveSessionToken() {
  if (process.env.SHP_API_TOKEN) {
    return process.env.SHP_API_TOKEN;
  }

  const email = process.env.SHP_BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.SHP_BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set SHP_API_TOKEN or provide SHP_BOOTSTRAP_ADMIN_EMAIL and SHP_BOOTSTRAP_ADMIN_PASSWORD."
    );
  }

  const login = await apiRequest("/v1/auth/login", null, {
    method: "POST",
    body: { email, password }
  });

  if (!login?.sessionToken) {
    throw new Error("Login succeeded without a session token.");
  }

  return login.sessionToken;
}

function sortByNewest(values, key) {
  return [...values].sort((left, right) => {
    const leftValue = left[key] ? Date.parse(left[key]) : 0;
    const rightValue = right[key] ? Date.parse(right[key]) : 0;
    return rightValue - leftValue;
  });
}

function classifyMigrationState(desiredDatabase, inventoryDatabase) {
  const pendingTarget =
    desiredDatabase?.pendingMigrationTo ?? inventoryDatabase?.pendingMigrationTo;
  const completedFrom =
    desiredDatabase?.migrationCompletedFrom ?? inventoryDatabase?.migrationCompletedFrom;

  if (pendingTarget) {
    return "pending";
  }

  if (completedFrom) {
    return "completed";
  }

  if (desiredDatabase && inventoryDatabase && desiredDatabase.engine === inventoryDatabase.engine) {
    return "model-complete-without-metadata";
  }

  return "unclassified";
}

function pickNodeHealth(nodeHealth, ...nodeIds) {
  const wanted = new Set(nodeIds.filter(Boolean));
  return nodeHealth.filter((entry) => wanted.has(entry.nodeId));
}

function renderReport(report) {
  const lines = [
    `App: ${report.appSlug}`,
    `Classification: ${report.classification}`,
    `Desired engine: ${report.desiredDatabase?.engine ?? "missing"}`,
    `Inventory engine: ${report.inventoryDatabase?.engine ?? "missing"}`,
    `Pending target: ${report.desiredDatabase?.pendingMigrationTo ?? report.inventoryDatabase?.pendingMigrationTo ?? "none"}`,
    `Completed from: ${report.desiredDatabase?.migrationCompletedFrom ?? report.inventoryDatabase?.migrationCompletedFrom ?? "none"}`,
    `Completed at: ${report.desiredDatabase?.migrationCompletedAt ?? report.inventoryDatabase?.migrationCompletedAt ?? "none"}`,
    `Desired/inventory match: ${report.checks.desiredInventoryMatch ? "yes" : "no"}`,
    `Drift clear: ${report.checks.driftClear ? "yes" : "no"}`,
    `Latest reconcile applied: ${report.checks.latestReconcileApplied ? "yes" : "no"}`,
    `Backup coverage present: ${report.checks.backupCoveragePresent ? "yes" : "no"}`
  ];

  if (report.relevantDrift.length > 0) {
    lines.push("");
    lines.push("Drift:");

    for (const item of report.relevantDrift) {
      lines.push(
        `- ${item.resourceKey} on ${item.nodeId}: ${item.driftStatus}${item.latestSummary ? ` (${item.latestSummary})` : ""}`
      );
    }
  }

  if (report.recentJobs.length > 0) {
    lines.push("");
    lines.push("Recent jobs:");

    for (const job of report.recentJobs) {
      lines.push(
        `- ${job.jobId} ${job.kind} ${job.status ?? "unknown"} on ${job.nodeId}${job.summary ? ` :: ${job.summary}` : ""}`
      );
    }
  }

  if (report.backupPolicies.length > 0) {
    lines.push("");
    lines.push("Backup policies:");

    for (const policy of report.backupPolicies) {
      lines.push(`- ${policy.policySlug} -> ${policy.targetNodeId} :: ${policy.resourceSelectors.join(", ")}`);
    }
  }

  if (report.nodeHealth.length > 0) {
    lines.push("");
    lines.push("Node health:");

    for (const node of report.nodeHealth) {
      lines.push(
        `- ${node.nodeId}: ${node.latestJobStatus ?? "unknown"}${node.latestJobSummary ? ` :: ${node.latestJobSummary}` : ""}`
      );
    }
  }

  return lines.join("\n");
}

async function main() {
  const { appSlug, json } = parseArgs(process.argv.slice(2));
  const token = await resolveSessionToken();
  const [desiredState, inventory, drift, jobHistory, backups, nodeHealth, overview] =
    await Promise.all([
      apiRequest("/v1/resources/spec", token),
      apiRequest("/v1/inventory/summary", token),
      apiRequest("/v1/resources/drift", token),
      apiRequest("/v1/jobs/history?limit=200", token),
      apiRequest("/v1/backups/summary", token),
      apiRequest("/v1/nodes/health", token),
      apiRequest("/v1/operations/overview", token)
    ]);

  const desiredDatabase =
    desiredState?.spec?.databases?.find((database) => database.appSlug === appSlug) ?? null;
  const inventoryDatabase =
    inventory?.databases?.find((database) => database.appSlug === appSlug) ?? null;
  const relevantDrift = drift.filter((item) => item.resourceKey === `database:${appSlug}`);
  const recentJobs = sortByNewest(
    jobHistory.filter(
      (job) =>
        job.resourceKey === `database:${appSlug}` ||
        job.payload?.appSlug === appSlug
    ),
    "createdAt"
  ).slice(0, 10);
  const backupPolicies = backups.policies.filter((policy) =>
    policy.resourceSelectors.includes(`database:${appSlug}`) ||
    policy.resourceSelectors.includes(`app:${appSlug}`)
  );
  const latestBackupRuns = sortByNewest(
    backups.latestRuns.filter((run) =>
      backupPolicies.some((policy) => policy.policySlug === run.policySlug)
    ),
    "startedAt"
  ).slice(0, 10);
  const nodeIds = [
    desiredDatabase?.primaryNodeId,
    desiredDatabase?.standbyNodeId,
    inventoryDatabase?.primaryNodeId,
    inventoryDatabase?.standbyNodeId
  ];
  const relevantNodeHealth = pickNodeHealth(nodeHealth, ...nodeIds);

  const report = {
    generatedAt: new Date().toISOString(),
    apiBaseUrl: createApiBaseUrl(),
    overviewGeneratedAt: overview.generatedAt,
    appSlug,
    classification: classifyMigrationState(desiredDatabase, inventoryDatabase),
    desiredDatabase,
    inventoryDatabase,
    relevantDrift,
    recentJobs,
    backupPolicies,
    latestBackupRuns,
    nodeHealth: relevantNodeHealth,
    checks: {
      desiredInventoryMatch:
        Boolean(desiredDatabase && inventoryDatabase) &&
        desiredDatabase.engine === inventoryDatabase.engine &&
        desiredDatabase.databaseName === inventoryDatabase.databaseName &&
        desiredDatabase.databaseUser === inventoryDatabase.databaseUser,
      driftClear: relevantDrift.every((item) => item.driftStatus === "in_sync"),
      latestReconcileApplied: recentJobs.some(
        (job) =>
          (job.kind === "postgres.reconcile" || job.kind === "mariadb.reconcile") &&
          job.status === "applied"
      ),
      backupCoveragePresent: backupPolicies.length > 0 && latestBackupRuns.length > 0
    }
  };

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(renderReport(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
