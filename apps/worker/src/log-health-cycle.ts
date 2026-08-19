import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { runLogHealth } from "./log-health.js";

export async function startLogHealthFromCli(): Promise<void> {
  const report = await runLogHealth();
  console.log(
    `[log-health] state=${report.state}; path=${report.activePath}; actions=${report.actions.join(",") || "none"}`
  );

  if (report.state === "critical") {
    throw new Error(report.errors.join("; "));
  }
}

const currentModulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1];

if (
  invokedPath !== undefined &&
  (await realpath(invokedPath).catch(() => invokedPath)) ===
    (await realpath(currentModulePath).catch(() => currentModulePath))
) {
  startLogHealthFromCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
