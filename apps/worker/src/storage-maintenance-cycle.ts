import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildStorageMaintenanceOptions,
  parseStorageMaintenanceCliArgs,
  runStorageMaintenance
} from "./storage-maintenance.js";

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

function printHelp(): void {
  console.log(`Usage: storage-maintenance-cycle [--dry-run|--apply] [--json] [--report PATH|--no-report]

The default is a read-only dry run. Apply mode still requires the configured
high filesystem watermark and refuses to run while Genesis, backup, deploy, or
release installation work is active.`);
}

export async function startStorageMaintenanceFromCli(): Promise<void> {
  let cli;
  try {
    cli = parseStorageMaintenanceCliArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof Error && (error as Error & { code?: string }).code === "help") {
      printHelp();
      return;
    }
    throw error;
  }

  const report = await runStorageMaintenance(buildStorageMaintenanceOptions(cli));

  if (cli.json) {
    console.log(JSON.stringify(report));
  } else {
    console.log(
      `[storage-maintenance] ${report.status}; mode=${report.requestedMode}; ` +
        `applied=${report.applied}; root=${report.filesystem.after.usedPercent}%; ` +
        `releases-removed=${report.releases.removed.length}; ` +
        `podman-prune=${report.podman.pruneAttempted ? "attempted" : "skipped"}.`
    );
  }

  if (report.errors.length > 0) {
    process.exitCode = 1;
  }
}

if (isMainModule()) {
  startStorageMaintenanceFromCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
