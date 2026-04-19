#!/usr/bin/env node

import {
  claimJobs,
  registerNode
} from "@simplehost/agent-control-plane-client";
import { isSupportedJobKind, supportedJobKinds } from "@simplehost/agent-contracts";
import { createDemoJob, executeAllowlistedJob } from "@simplehost/agent-drivers";
import {
  createAgentRuntimeConfig,
  ensureAgentStateDirectories,
  getAgentStatePaths
} from "@simplehost/agent-runtime-config";
import { renderJobResult, renderNodeSnapshot } from "@simplehost/agent-renderers";

async function createSnapshotForCli() {
  const config = createAgentRuntimeConfig();
  const statePaths = getAgentStatePaths(config);

  await ensureAgentStateDirectories(config);

  return {
    nodeId: config.nodeId,
    hostname: config.hostname,
    status: "ready" as const,
    stateDir: config.stateDir,
    reportBufferDir: statePaths.reportBufferDir,
    generatedAt: new Date().toISOString()
  };
}

function createRegistrationPayload(snapshot: Awaited<ReturnType<typeof createSnapshotForCli>>) {
  const config = createAgentRuntimeConfig();

  return {
    nodeId: snapshot.nodeId,
    hostname: snapshot.hostname,
    version: config.version,
    supportedJobKinds: [...supportedJobKinds],
    generatedAt: snapshot.generatedAt
  };
}

async function main(): Promise<void> {
  const config = createAgentRuntimeConfig();
  const command = process.argv[2] ?? "help";

  if (command === "help") {
    console.log(
      "Usage: simplehost-agent <health|paths|register|claim|run-job <kind>>"
    );
    return;
  }

  if (command === "health") {
    const snapshot = await createSnapshotForCli();
    console.log(renderNodeSnapshot(snapshot));
    return;
  }

  if (command === "paths") {
    console.log(
      JSON.stringify(
        {
          configPath: config.configPath,
          statePaths: getAgentStatePaths(config),
          logDir: config.logDir
        },
        null,
        2
      )
    );
    return;
  }

  if (command === "register") {
    if (!config.enrollmentToken) {
      throw new Error("SIMPLEHOST_ENROLLMENT_TOKEN is required for register.");
    }

    const snapshot = await createSnapshotForCli();
    const registration = await registerNode(
      config.controlPlaneUrl,
      createRegistrationPayload(snapshot),
      config.enrollmentToken
    );

    console.log(JSON.stringify(registration, null, 2));
    return;
  }

  if (command === "claim") {
    if (!config.enrollmentToken) {
      throw new Error("SIMPLEHOST_ENROLLMENT_TOKEN is required for claim.");
    }

    const snapshot = await createSnapshotForCli();
    const registration = await registerNode(
      config.controlPlaneUrl,
      createRegistrationPayload(snapshot),
      config.enrollmentToken
    );
    const nodeToken = registration.nodeToken ?? config.enrollmentToken;

    const claimed = await claimJobs(config.controlPlaneUrl, {
      nodeId: snapshot.nodeId,
      hostname: snapshot.hostname,
      version: config.version,
      maxJobs: 4
    }, nodeToken);

    console.log(JSON.stringify(claimed, null, 2));
    return;
  }

  if (command === "run-job") {
    const kind = process.argv[3];

    if (!kind || !isSupportedJobKind(kind)) {
      console.error("Provide a supported job kind.");
      process.exitCode = 1;
      return;
    }

    const result = await executeAllowlistedJob(createDemoJob(config.nodeId, kind), {
      nodeId: config.nodeId,
      hostname: config.hostname,
      stateDir: config.stateDir,
      services: config.services
    });

    console.log(renderJobResult(result));
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
