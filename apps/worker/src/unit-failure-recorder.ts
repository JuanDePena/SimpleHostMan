import { execFile } from "node:child_process";
import { mkdir, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const unitPattern = /^[A-Za-z0-9_.@:-]+$/;

export function validateFailureUnit(unit: string): string {
  if (!unitPattern.test(unit)) {
    throw new Error(`Invalid systemd unit name: ${unit}`);
  }

  return unit;
}

function parseProperties(output: string): Record<string, string> {
  return Object.fromEntries(
    output
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

export async function recordUnitFailure(unit: string, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  validateFailureUnit(unit);
  const result = await execFileAsync("/usr/bin/systemctl", [
    "show",
    unit,
    "-p",
    "Id",
    "-p",
    "Result",
    "-p",
    "ExecMainStatus",
    "-p",
    "ActiveState",
    "-p",
    "SubState",
    "-p",
    "InvocationID"
  ]);
  const properties = parseProperties(result.stdout);
  const root = env.SIMPLEHOST_UNIT_FAILURE_ROOT ?? "/var/lib/simplehost-unit-failures";
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const safeUnit = unit.replace(/[^A-Za-z0-9_.@-]/g, "_");
  const path = join(root, `${stamp}-${safeUnit}.json`);
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await mkdir(root, { recursive: true });
  await writeFile(
    temporaryPath,
    `${JSON.stringify(
      {
        schemaVersion: "simplehost-unit-failure-v1",
        recordedAt: now.toISOString(),
        host: process.env.HOSTNAME,
        unit,
        properties
      },
      null,
      2
    )}\n`,
    { mode: 0o640 }
  );
  await rename(temporaryPath, path);

  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1_000;
  const entries = await readdir(root).catch(() => []);

  for (const entry of entries) {
    if (!entry.endsWith(".json")) {
      continue;
    }

    const candidate = join(root, entry);
    const candidateStat = await stat(candidate).catch(() => undefined);

    if (candidateStat !== undefined && candidateStat.mtimeMs < cutoff) {
      await unlink(candidate);
    }
  }

  console.error(`[unit-failure] unit=${unit}; result=${properties.Result ?? "unknown"}; evidence=${path}`);
  return path;
}

const unitIndex = process.argv.indexOf("--unit");
const unit = unitIndex >= 0 ? process.argv[unitIndex + 1] : undefined;

if (unit !== undefined) {
  recordUnitFailure(unit).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
