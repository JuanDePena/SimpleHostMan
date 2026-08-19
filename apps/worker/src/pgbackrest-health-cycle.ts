import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { runPgBackRestHealth } from "./pgbackrest-health.js";

export async function startPgBackRestHealthFromCli(): Promise<void> {
  const report = await runPgBackRestHealth();
  console.log(
    `[pgbackrest-health] state=${report.state}; repo=${report.repository.usedPercent}%; ${report.stanzas
      .map((entry) => `${entry.stanza}:${entry.state}:${entry.latestFullLabel ?? "none"}:ready=${entry.archiveReadyCount}`)
      .join(", ")}`
  );

  if (report.state === "critical") {
    throw new Error(
      [...report.errors, ...report.stanzas.flatMap((entry) => entry.errors)].join("; ")
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
  startPgBackRestHealthFromCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
