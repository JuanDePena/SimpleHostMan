import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { realpathSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  claimJobs,
  registerNode,
  reportJob
} from "@simplehost/manager-control-plane-client";
import {
  supportedJobKinds,
  type AppServiceSnapshot,
  type CodeServerServiceSnapshot,
  type MailServiceSnapshot,
  type MailSyncPayload,
  type RustDeskListenerSnapshot,
  type RustDeskServiceSnapshot,
  type AgentBufferedReport,
  type AgentJobEnvelope,
  type AgentJobReportRequest,
  type AgentNodeRegistrationRequest,
  type AgentNodeRuntimeSnapshot,
  type AgentNodeSnapshot,
  type AgentSpoolEntry
} from "@simplehost/manager-contracts";
import { executeAllowlistedJob } from "@simplehost/manager-drivers";
import {
  createAgentRuntimeConfig,
  ensureAgentStateDirectories,
  getAgentStatePaths,
  listJsonFiles,
  readJsonFile,
  removeFileIfExists,
  writeJsonFileAtomic
} from "@simplehost/manager-node-config";
import { renderJobResult, renderNodeSnapshot } from "@simplehost/manager-renderers";

const execFileAsync = promisify(execFile);
const rustDeskTrackedPorts = new Set([21115, 21116, 21117, 21118, 21119]);

async function writeLastAppliedState(
  desiredStateVersion: string,
  lastCompletedJobId?: string
): Promise<void> {
  const config = createAgentRuntimeConfig();
  const timestamp = new Date().toISOString();

  await writeJsonFileAtomic(getAgentStatePaths(config).lastAppliedStateFile, {
    schemaVersion: 1,
    desiredStateVersion,
    lastCompletedJobId,
    lastHeartbeatAt: timestamp
  });
}

async function readStoredNodeToken(): Promise<string | undefined> {
  const config = createAgentRuntimeConfig();
  const statePaths = getAgentStatePaths(config);
  const existingIdentity = await readJsonFile<{
    schemaVersion: 1;
    nodeId: string;
    nodeToken?: string;
  }>(statePaths.nodeIdentityFile);

  if (!existingIdentity || existingIdentity.nodeId !== config.nodeId) {
    return undefined;
  }

  return existingIdentity.nodeToken;
}

export async function createNodeSnapshot(): Promise<AgentNodeSnapshot> {
  const config = createAgentRuntimeConfig();
  const statePaths = getAgentStatePaths(config);

  await ensureAgentStateDirectories(config);
  const existingIdentity = await readJsonFile<{
    schemaVersion: 1;
    nodeId: string;
    hostname: string;
    controlPlaneUrl: string;
    configPath: string;
    generatedAt: string;
    nodeToken?: string;
  }>(statePaths.nodeIdentityFile);
  const existingNodeToken =
    existingIdentity?.nodeId === config.nodeId ? existingIdentity.nodeToken : undefined;

  const snapshot: AgentNodeSnapshot = {
    nodeId: config.nodeId,
    hostname: config.hostname,
    status: "ready",
    stateDir: config.stateDir,
    reportBufferDir: statePaths.reportBufferDir,
    generatedAt: new Date().toISOString(),
    nodeToken: existingNodeToken
  };

  await writeJsonFileAtomic(statePaths.nodeIdentityFile, {
    schemaVersion: 1,
    nodeId: config.nodeId,
    hostname: config.hostname,
    controlPlaneUrl: config.controlPlaneUrl,
    configPath: config.configPath,
    generatedAt: snapshot.generatedAt,
    nodeToken: existingNodeToken
  });

  await writeLastAppliedState("bootstrap");

  return snapshot;
}

function createRegistrationRequest(
  snapshot: AgentNodeSnapshot,
  runtimeSnapshot?: AgentNodeRuntimeSnapshot
): AgentNodeRegistrationRequest {
  const config = createAgentRuntimeConfig();

  return {
    nodeId: snapshot.nodeId,
    hostname: snapshot.hostname,
    version: config.version,
    supportedJobKinds: [...supportedJobKinds],
    generatedAt: snapshot.generatedAt,
    runtimeSnapshot
  };
}

async function commandOutput(
  command: string,
  args: string[]
): Promise<string | undefined> {
  try {
    const result = await execFileAsync(command, args, {
      encoding: "utf8"
    });
    return result.stdout.trim();
  } catch {
    return undefined;
  }
}

function extractCodeServerVersion(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/\b\d+\.\d+\.\d+\b/);
  return match?.[0];
}

async function inspectCodeServer(): Promise<CodeServerServiceSnapshot> {
  const config = createAgentRuntimeConfig();
  const checkedAt = new Date().toISOString();
  const serviceName = config.services.codeServer.serviceName;
  const enabledState = await commandOutput("systemctl", ["is-enabled", serviceName]);
  const activeState = await commandOutput("systemctl", ["is-active", serviceName]);
  const rpmVersionOutput = await commandOutput("rpm", [
    "-q",
    "code-server",
    "--qf",
    "%{VERSION}-%{RELEASE}\n"
  ]);
  const versionOutput = await commandOutput("code-server", ["--version"]);

  const configContent = await readFile(config.services.codeServer.configPath, "utf8").catch(
    () => ""
  );
  const settingsContent = await readFile(
    config.services.codeServer.settingsPath,
    "utf8"
  ).catch(() => "");

  const bindAddress = /^bind-addr:\s*(.+)$/m.exec(configContent)?.[1]?.trim();
  const authMode = /^auth:\s*(.+)$/m.exec(configContent)?.[1]?.trim();

  return {
    serviceName,
    enabled: enabledState !== undefined && enabledState !== "disabled",
    active: activeState === "active",
    version:
      extractCodeServerVersion(rpmVersionOutput) ??
      extractCodeServerVersion(versionOutput),
    bindAddress,
    authMode,
    settingsProfileHash: settingsContent
      ? createHash("sha256").update(settingsContent).digest("hex").slice(0, 12)
      : undefined,
    checkedAt
  };
}

function parseSocketAddress(value: string): { address: string; port: number } | undefined {
  const bracketedMatch = value.match(/^\[(.*)\]:(\d+)$/);

  if (bracketedMatch) {
    return {
      address: bracketedMatch[1] ?? "::",
      port: Number.parseInt(bracketedMatch[2] ?? "", 10)
    };
  }

  const plainMatch = value.match(/^(.*):(\d+)$/);

  if (!plainMatch) {
    return undefined;
  }

  return {
    address: plainMatch[1] ?? "*",
    port: Number.parseInt(plainMatch[2] ?? "", 10)
  };
}

async function inspectRustDeskListeners(): Promise<RustDeskListenerSnapshot[]> {
  const output = await commandOutput("ss", ["-H", "-lntu"]);

  if (!output) {
    return [];
  }

  const listeners = new Map<string, RustDeskListenerSnapshot>();

  for (const line of output.split(/\r?\n/g)) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
    const protocol = parts[0];
    const localAddress = parts[4];

    if (
      (protocol !== "tcp" && protocol !== "udp") ||
      typeof localAddress !== "string"
    ) {
      continue;
    }

    const parsed = parseSocketAddress(localAddress);

    if (!parsed || !rustDeskTrackedPorts.has(parsed.port)) {
      continue;
    }

    listeners.set(`${protocol}:${parsed.address}:${parsed.port}`, {
      protocol,
      address: parsed.address,
      port: parsed.port
    });
  }

  return [...listeners.values()].sort((left, right) =>
    `${left.port}:${left.protocol}:${left.address}`.localeCompare(
      `${right.port}:${right.protocol}:${right.address}`
    )
  );
}

async function inspectRustDesk(): Promise<RustDeskServiceSnapshot> {
  const config = createAgentRuntimeConfig();
  const checkedAt = new Date().toISOString();
  const { hbbsServiceName, hbbrServiceName, publicKeyPath } = config.services.rustdesk;
  const [
    hbbsEnabledState,
    hbbsActiveState,
    hbbrEnabledState,
    hbbrActiveState,
    publicKey,
    listeners
  ] = await Promise.all([
    commandOutput("systemctl", ["is-enabled", hbbsServiceName]),
    commandOutput("systemctl", ["is-active", hbbsServiceName]),
    commandOutput("systemctl", ["is-enabled", hbbrServiceName]),
    commandOutput("systemctl", ["is-active", hbbrServiceName]),
    readFile(publicKeyPath, "utf8")
      .then((content) => content.trim())
      .catch(() => undefined),
    inspectRustDeskListeners()
  ]);

  return {
    hbbsServiceName,
    hbbsEnabled: hbbsEnabledState !== undefined && hbbsEnabledState !== "disabled",
    hbbsActive: hbbsActiveState === "active",
    hbbrServiceName,
    hbbrEnabled: hbbrEnabledState !== undefined && hbbrEnabledState !== "disabled",
    hbbrActive: hbbrActiveState === "active",
    publicKey,
    publicKeyPath,
    listeners,
    checkedAt
  };
}

async function inspectMail(): Promise<MailServiceSnapshot> {
  const config = createAgentRuntimeConfig();
  const checkedAt = new Date().toISOString();
  const {
    postfixServiceName,
    dovecotServiceName,
    rspamdServiceName,
    redisServiceName,
    configRoot,
    statePath,
    vmailRoot,
    dkimRoot,
    roundcubeRoot
  } = config.services.mail;
  const [
    postfixEnabledState,
    postfixActiveState,
    dovecotEnabledState,
    dovecotActiveState,
    rspamdEnabledState,
    rspamdActiveState,
    redisEnabledState,
    redisActiveState,
    desiredStateContent
  ] = await Promise.all([
    commandOutput("systemctl", ["is-enabled", postfixServiceName]),
    commandOutput("systemctl", ["is-active", postfixServiceName]),
    commandOutput("systemctl", ["is-enabled", dovecotServiceName]),
    commandOutput("systemctl", ["is-active", dovecotServiceName]),
    commandOutput("systemctl", ["is-enabled", rspamdServiceName]),
    commandOutput("systemctl", ["is-active", rspamdServiceName]),
    commandOutput("systemctl", ["is-enabled", redisServiceName]),
    commandOutput("systemctl", ["is-active", redisServiceName]),
    readFile(statePath, "utf8").catch(() => undefined)
  ]);

  let managedDomains: MailServiceSnapshot["managedDomains"] = [];

  if (desiredStateContent) {
    try {
      const parsed = JSON.parse(desiredStateContent) as MailSyncPayload;
      managedDomains = Array.isArray(parsed.domains)
        ? parsed.domains.map((domain) => ({
            domainName: domain.domainName,
            mailHost: domain.mailHost,
            webmailHostname: domain.webmailHostname,
            deliveryRole: domain.deliveryRole,
            mailboxCount: domain.mailboxes.length,
            aliasCount: domain.aliases.length
          }))
        : [];
    } catch {
      managedDomains = [];
    }
  }

  return {
    postfixServiceName,
    postfixEnabled: postfixEnabledState !== undefined && postfixEnabledState !== "disabled",
    postfixActive: postfixActiveState === "active",
    dovecotServiceName,
    dovecotEnabled: dovecotEnabledState !== undefined && dovecotEnabledState !== "disabled",
    dovecotActive: dovecotActiveState === "active",
    rspamdServiceName,
    rspamdEnabled: rspamdEnabledState !== undefined && rspamdEnabledState !== "disabled",
    rspamdActive: rspamdActiveState === "active",
    redisServiceName,
    redisEnabled: redisEnabledState !== undefined && redisEnabledState !== "disabled",
    redisActive: redisActiveState === "active",
    configRoot,
    statePath,
    vmailRoot,
    dkimRoot,
    roundcubeRoot,
    managedDomains,
    checkedAt
  };
}

function extractQuadletSetting(
  content: string | undefined,
  key: string
): string | undefined {
  if (!content) {
    return undefined;
  }

  const match = new RegExp(`^${key}=(.+)$`, "m").exec(content);
  return match?.[1]?.trim();
}

function parsePublishedBackendPort(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/:(\d+):\d+(?:\/[A-Za-z0-9._-]+)?$/);

  if (!match?.[1]) {
    return undefined;
  }

  return Number.parseInt(match[1], 10);
}

async function inspectAppServices(): Promise<AppServiceSnapshot[]> {
  const config = createAgentRuntimeConfig();
  const checkedAt = new Date().toISOString();
  const rootDir = config.services.apps.rootDir;
  const servicePrefix = config.services.apps.servicePrefix;
  const appDirectories = await readdir(rootDir, { withFileTypes: true }).catch(() => []);
  const slugs = appDirectories
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const snapshots = await Promise.all(
    slugs.map(async (slug) => {
      const serviceBaseName = `${servicePrefix}${slug}`;
      const serviceName = `${serviceBaseName}.service`;
      const quadletPath = path.join(
        config.services.containers.quadletDir,
        `${serviceBaseName}.container`
      );
      const envFilePath = path.join(
        config.services.containers.envDir,
        `${serviceBaseName}.env`
      );
      const [enabledState, activeState, quadletContent] = await Promise.all([
        commandOutput("systemctl", ["is-enabled", serviceName]),
        commandOutput("systemctl", ["is-active", serviceName]),
        readFile(quadletPath, "utf8").catch(() => undefined)
      ]);

      return {
        appSlug: slug,
        serviceName,
        containerName:
          extractQuadletSetting(quadletContent, "ContainerName") ?? serviceBaseName,
        enabled: enabledState !== undefined && enabledState !== "disabled",
        active: activeState === "active",
        image: extractQuadletSetting(quadletContent, "Image"),
        backendPort: parsePublishedBackendPort(
          extractQuadletSetting(quadletContent, "PublishPort")
        ),
        stateRoot: path.join(rootDir, slug),
        envFilePath,
        quadletPath,
        checkedAt
      } satisfies AppServiceSnapshot;
    })
  );

  return snapshots;
}

async function collectRuntimeSnapshot(): Promise<AgentNodeRuntimeSnapshot> {
  const [appServices, codeServer, rustdesk, mail] = await Promise.all([
    inspectAppServices(),
    inspectCodeServer(),
    inspectRustDesk(),
    inspectMail()
  ]);

  return {
    appServices,
    codeServer,
    rustdesk,
    mail
  };
}

async function deliverBufferedReport(
  reportFile: string,
  reportPayload: AgentBufferedReport,
  nodeToken: string
): Promise<boolean> {
  const config = createAgentRuntimeConfig();
  const request: AgentJobReportRequest = {
    nodeId: config.nodeId,
    result: reportPayload.result
  };

  try {
    await reportJob(config.controlPlaneUrl, request, nodeToken);
    await removeFileIfExists(reportFile);
    return true;
  } catch (error) {
    await writeJsonFileAtomic(reportFile, {
      ...reportPayload,
      deliveryAttempts: reportPayload.deliveryAttempts + 1,
      lastDeliveryError: error instanceof Error ? error.message : String(error)
    } satisfies AgentBufferedReport);
    return false;
  }
}

async function flushBufferedReports(): Promise<number> {
  const config = createAgentRuntimeConfig();
  const reportFiles = await listJsonFiles(getAgentStatePaths(config).reportBufferDir);
  let delivered = 0;
  const nodeToken = await readStoredNodeToken();

  if (!nodeToken) {
    return delivered;
  }

  for (const reportFile of reportFiles) {
    const payload = await readJsonFile<AgentBufferedReport>(reportFile);

    if (!payload) {
      await removeFileIfExists(reportFile);
      continue;
    }

    if (await deliverBufferedReport(reportFile, payload, nodeToken)) {
      delivered += 1;
    }
  }

  return delivered;
}

async function executeClaimedJob(job: AgentJobEnvelope): Promise<void> {
  const config = createAgentRuntimeConfig();
  const statePaths = getAgentStatePaths(config);
  const claimedAt = new Date().toISOString();
  const spoolPath = `${statePaths.jobSpoolDir}/${job.id}.json`;
  const reportPath = `${statePaths.reportBufferDir}/${job.id}.json`;
  const nodeToken = await readStoredNodeToken();

  await writeJsonFileAtomic(spoolPath, {
    schemaVersion: 1,
    job,
    state: "claimed",
    claimedAt
  } satisfies AgentSpoolEntry);

  const result = await (async () => {
    try {
      return await executeAllowlistedJob(job, {
        nodeId: config.nodeId,
        hostname: config.hostname,
        stateDir: config.stateDir,
        services: config.services
      });
    } catch (error) {
      return {
        jobId: job.id,
        kind: job.kind,
        nodeId: config.nodeId,
        status: "failed" as const,
        summary: error instanceof Error ? error.message : String(error),
        details: {
          thrown: true
        },
        completedAt: new Date().toISOString()
      };
    }
  })();
  const bufferedAt = new Date().toISOString();

  await writeJsonFileAtomic(reportPath, {
    schemaVersion: 1,
    result,
    bufferedAt,
    deliveryAttempts: 0
  } satisfies AgentBufferedReport);

  await writeJsonFileAtomic(spoolPath, {
    schemaVersion: 1,
    job,
    state: "executed",
    claimedAt,
    executedAt: bufferedAt,
    resultStatus: result.status
  } satisfies AgentSpoolEntry);

  await writeLastAppliedState(job.desiredStateVersion, job.id);
  console.log(renderJobResult(result));

  if (
    nodeToken &&
    (await deliverBufferedReport(
      reportPath,
      {
        schemaVersion: 1,
        result,
        bufferedAt,
        deliveryAttempts: 0
      },
      nodeToken
    ))
  ) {
    await removeFileIfExists(spoolPath);
  }
}

export async function runManagerAgentCycle(): Promise<void> {
  const config = createAgentRuntimeConfig();
  const snapshot = await createNodeSnapshot();
  const runtimeSnapshot = await collectRuntimeSnapshot();
  const registrationToken = snapshot.nodeToken ?? config.enrollmentToken;

  if (!registrationToken) {
    throw new Error(
      "SIMPLEHOST_ENROLLMENT_TOKEN is required until SimpleHost Control issues a node bearer token."
    );
  }

  const registration = await registerNode(
    config.controlPlaneUrl,
    createRegistrationRequest(snapshot, runtimeSnapshot),
    registrationToken
  );
  const nodeToken = registration.nodeToken ?? snapshot.nodeToken;

  if (!nodeToken) {
    throw new Error(`SimpleHost Control did not issue a node token for ${config.nodeId}.`);
  }

  await writeJsonFileAtomic(getAgentStatePaths(config).nodeIdentityFile, {
    schemaVersion: 1,
    nodeId: config.nodeId,
    hostname: config.hostname,
    controlPlaneUrl: config.controlPlaneUrl,
    configPath: config.configPath,
    generatedAt: snapshot.generatedAt,
    nodeToken
  });

  console.log(renderNodeSnapshot(snapshot));
  console.log(
    `Registered with ${config.controlPlaneUrl} at ${registration.acceptedAt}. Poll every ${registration.pollIntervalMs}ms.`
  );

  const flushedReports = await flushBufferedReports();

  if (flushedReports > 0) {
    console.log(`Delivered ${flushedReports} buffered report(s).`);
  }

  const claimed = await claimJobs(config.controlPlaneUrl, {
    nodeId: config.nodeId,
    hostname: config.hostname,
    version: config.version,
    maxJobs: 4,
    runtimeSnapshot
  }, nodeToken);

  if (claimed.jobs.length === 0) {
    console.log("No jobs available.");
    return;
  }

  for (const job of claimed.jobs) {
    await executeClaimedJob(job);
  }
}

export async function startManagerAgent(): Promise<void> {
  const config = createAgentRuntimeConfig();
  const runOnce = process.env.SIMPLEHOST_RUN_ONCE === "true";

  do {
    try {
      await runManagerAgentCycle();
    } catch (error: unknown) {
      console.error(error);
    }

    if (runOnce) {
      break;
    }

    await sleep(config.heartbeatMs);
  } while (true);
}

function isMainModule(): boolean {
  if (process.argv[1] === undefined) {
    return false;
  }

  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return fileURLToPath(import.meta.url) === process.argv[1];
  }
}

if (isMainModule()) {
  startManagerAgent().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
