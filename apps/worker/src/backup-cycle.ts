import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parseBackupCliArgs, runBackupCycle } from "./backup-runner.js";

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

export async function startBackupCycleFromCli(): Promise<void> {
  const options = parseBackupCliArgs(process.argv.slice(2));
  const outcome = await runBackupCycle(options);

  if (outcome.attemptedPolicies.length === 0) {
    console.log(
      `[backup] no policies executed on ${outcome.localNodeId}; ${outcome.skippedPolicies.length} skipped.`
    );
    return;
  }

  const failedRuns = outcome.runs.filter((run) => run.status === "failed");

  console.log(
    `[backup] completed on ${outcome.localNodeId}; ${outcome.runs.length} run(s), ${failedRuns.length} failed.`
  );

  if (failedRuns.length > 0) {
    throw new Error(
      `Backup cycle finished with failures: ${failedRuns.map((run) => run.policySlug).join(", ")}`
    );
  }
}

if (isMainModule()) {
  startBackupCycleFromCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

