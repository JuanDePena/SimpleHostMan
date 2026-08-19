import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { runCapacityGuard } from "./storage-capacity-guard.js";

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

export async function startCapacityGuardFromCli(): Promise<void> {
  const report = await runCapacityGuard();
  const summary = report.filesystems
    .map((entry) => `${entry.path}=${entry.usedPercent}%/${Math.round(entry.availableBytes / 1024 ** 3)}GiB`)
    .join(", ");
  const message = `[capacity] state=${report.state}; ${summary}`;

  if (report.state === "critical") {
    throw new Error(`${message}; ${[...report.errors, ...report.filesystems.flatMap((entry) => entry.reasons)].join("; ")}`);
  }

  if (report.state === "warning") {
    console.warn(message);
    return;
  }

  console.log(message);
}

if (isMainModule()) {
  startCapacityGuardFromCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
