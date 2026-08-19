import { mkdir, realpath, rename, stat, statfs, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type CapacityState = "ok" | "warning" | "critical";

export interface CapacityThresholds {
  warningPercent: number;
  criticalPercent: number;
  warningFreeBytes: number;
  criticalFreeBytes: number;
}

export interface CapacityMeasurement {
  path: string;
  aliases: string[];
  device: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent: number;
  state: CapacityState;
  reasons: string[];
}

export interface CapacityGuardReport {
  schemaVersion: "simplehost-capacity-guard-v1";
  generatedAt: string;
  state: CapacityState;
  thresholds: CapacityThresholds;
  filesystems: CapacityMeasurement[];
  errors: string[];
}

const GIB = 1024 ** 3;

function parseNumber(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }

  return parsed;
}

export function loadCapacityThresholds(env: NodeJS.ProcessEnv): CapacityThresholds {
  const thresholds = {
    warningPercent: parseNumber(env.SIMPLEHOST_CAPACITY_WARNING_PERCENT, 70, "warning percent"),
    criticalPercent: parseNumber(env.SIMPLEHOST_CAPACITY_CRITICAL_PERCENT, 85, "critical percent"),
    warningFreeBytes:
      parseNumber(env.SIMPLEHOST_CAPACITY_WARNING_FREE_GIB, 10, "warning free GiB") * GIB,
    criticalFreeBytes:
      parseNumber(env.SIMPLEHOST_CAPACITY_CRITICAL_FREE_GIB, 5, "critical free GiB") * GIB
  };

  if (thresholds.warningPercent >= thresholds.criticalPercent) {
    throw new Error("Capacity warning percent must be lower than critical percent.");
  }

  if (thresholds.warningFreeBytes <= thresholds.criticalFreeBytes) {
    throw new Error("Capacity warning free-space threshold must exceed the critical threshold.");
  }

  return thresholds;
}

export function classifyCapacity(
  usedPercent: number,
  availableBytes: number,
  thresholds: CapacityThresholds
): { state: CapacityState; reasons: string[] } {
  const criticalReasons: string[] = [];
  const warningReasons: string[] = [];

  if (usedPercent >= thresholds.criticalPercent) {
    criticalReasons.push(`usage ${usedPercent.toFixed(2)}% >= ${thresholds.criticalPercent}%`);
  } else if (usedPercent >= thresholds.warningPercent) {
    warningReasons.push(`usage ${usedPercent.toFixed(2)}% >= ${thresholds.warningPercent}%`);
  }

  if (availableBytes <= thresholds.criticalFreeBytes) {
    criticalReasons.push(`available bytes ${availableBytes} <= ${thresholds.criticalFreeBytes}`);
  } else if (availableBytes <= thresholds.warningFreeBytes) {
    warningReasons.push(`available bytes ${availableBytes} <= ${thresholds.warningFreeBytes}`);
  }

  if (criticalReasons.length > 0) {
    return { state: "critical", reasons: criticalReasons };
  }

  if (warningReasons.length > 0) {
    return { state: "warning", reasons: warningReasons };
  }

  return { state: "ok", reasons: [] };
}

function aggregateState(states: CapacityState[]): CapacityState {
  if (states.includes("critical")) {
    return "critical";
  }

  return states.includes("warning") ? "warning" : "ok";
}

export async function measureCapacity(
  paths: string[],
  thresholds: CapacityThresholds
): Promise<{ filesystems: CapacityMeasurement[]; errors: string[] }> {
  const byDevice = new Map<string, CapacityMeasurement>();
  const errors: string[] = [];

  for (const requestedPath of paths) {
    try {
      const resolvedPath = await realpath(requestedPath);
      const pathStat = await stat(resolvedPath, { bigint: true });
      const device = pathStat.dev.toString();
      const existing = byDevice.get(device);

      if (existing) {
        if (!existing.aliases.includes(resolvedPath)) {
          existing.aliases.push(resolvedPath);
        }
        continue;
      }

      const filesystem = await statfs(resolvedPath, { bigint: true });
      const totalBytes = Number(filesystem.blocks * filesystem.bsize);
      const freeBytes = Number(filesystem.bfree * filesystem.bsize);
      const availableBytes = Number(filesystem.bavail * filesystem.bsize);
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const capacityBasis = usedBytes + availableBytes;
      const usedPercent = capacityBasis === 0 ? 0 : (usedBytes / capacityBasis) * 100;
      const classification = classifyCapacity(usedPercent, availableBytes, thresholds);

      byDevice.set(device, {
        path: resolvedPath,
        aliases: [resolvedPath],
        device,
        totalBytes,
        usedBytes,
        availableBytes,
        usedPercent: Number(usedPercent.toFixed(2)),
        state: classification.state,
        reasons: classification.reasons
      });
    } catch (error) {
      errors.push(
        `${requestedPath}: ${error instanceof Error ? error.message : "capacity measurement failed"}`
      );
    }
  }

  return { filesystems: [...byDevice.values()], errors };
}

async function atomicWrite(path: string, report: CapacityGuardReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o640 });
  await rename(temporaryPath, path);
}

export async function runCapacityGuard(env: NodeJS.ProcessEnv = process.env): Promise<CapacityGuardReport> {
  const thresholds = loadCapacityThresholds(env);
  const paths = (env.SIMPLEHOST_CAPACITY_PATHS ?? "/,/srv/backups")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const measurement = await measureCapacity(paths, thresholds);
  const report: CapacityGuardReport = {
    schemaVersion: "simplehost-capacity-guard-v1",
    generatedAt: new Date().toISOString(),
    state:
      measurement.errors.length > 0
        ? "critical"
        : aggregateState(measurement.filesystems.map((entry) => entry.state)),
    thresholds,
    filesystems: measurement.filesystems,
    errors: measurement.errors
  };
  const reportPath = env.SIMPLEHOST_CAPACITY_REPORT_PATH ?? "/var/lib/simplehost-capacity-guard/latest.json";

  try {
    await atomicWrite(reportPath, report);
  } catch (error) {
    const fallbackPath = "/run/simplehost-capacity-guard.json";
    report.errors.push(
      `report write failed at ${reportPath}: ${error instanceof Error ? error.message : "unknown error"}`
    );
    report.state = "critical";
    await atomicWrite(fallbackPath, report).catch(() => undefined);
  }

  return report;
}
