import { mkdir, realpath, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { runBackupRetentionCycle } from "./backup-runner.js";

async function writeReport(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o640 });
  await rename(temporaryPath, path);
}

export async function startBackupRetentionCycleFromCli(): Promise<void> {
  const outcome = await runBackupRetentionCycle();
  const errors = outcome.policies.filter((policy) => policy.error !== undefined);
  const removed = outcome.policies.reduce((total, policy) => total + policy.localRemoved.length, 0);
  const report = {
    schemaVersion: "simplehost-backup-retention-v1",
    generatedAt: new Date().toISOString(),
    ...outcome
  };
  await writeReport(
    process.env.SIMPLEHOST_BACKUP_RETENTION_REPORT_PATH ??
      "/var/lib/simplehost-backup-retention/latest.json",
    report
  );

  console.log(
    `[backup-retention] node=${outcome.localNodeId}; policies=${outcome.policies.length}; local-removed=${removed}; failures=${errors.length}`
  );

  if (errors.length > 0) {
    throw new Error(
      `Backup retention failed for: ${errors.map((policy) => policy.policySlug).join(", ")}`
    );
  }
}

const currentModulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1];

if (
  invokedPath !== undefined &&
  (await realpath(invokedPath).catch(() => invokedPath)) ===
    (await realpath(currentModulePath).catch(() => currentModulePath))
) {
  startBackupRetentionCycleFromCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
