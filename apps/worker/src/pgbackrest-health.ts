import { execFile } from "node:child_process";
import { mkdir, readdir, rename, stat, statfs, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type PgBackRestHealthState = "ok" | "warning" | "critical";

export interface PgBackRestStanzaObservation {
  stanza: string;
  state: PgBackRestHealthState;
  latestFullLabel?: string;
  latestFullCompletedAt?: string;
  fullAgeHours?: number;
  archiveReadyCount: number;
  errors: string[];
  warnings: string[];
}

export interface PgBackRestHealthReport {
  schemaVersion: "simplehost-pgbackrest-health-v1";
  generatedAt: string;
  state: PgBackRestHealthState;
  repository: {
    path: string;
    usedPercent: number;
    availableBytes: number;
  };
  stanzas: PgBackRestStanzaObservation[];
  errors: string[];
}

interface PgBackRestInfoBackup {
  label?: string;
  type?: string;
  timestamp?: { stop?: number };
}

interface PgBackRestInfoStanza {
  status?: { code?: number; message?: string };
  backup?: PgBackRestInfoBackup[];
}

export function evaluatePgBackRestStanza(args: {
  stanza: string;
  info: PgBackRestInfoStanza | undefined;
  archiveReadyCount: number;
  nowMs: number;
  maxFullAgeHours: number;
  warningReadyCount: number;
  criticalReadyCount: number;
  operationalErrors?: string[];
}): PgBackRestStanzaObservation {
  const errors = [...(args.operationalErrors ?? [])];
  const warnings: string[] = [];
  const statusCode = args.info?.status?.code;

  if (statusCode !== 0) {
    errors.push(`stanza status is ${statusCode ?? "missing"}: ${args.info?.status?.message ?? "unknown"}`);
  }

  const latestFull = [...(args.info?.backup ?? [])]
    .filter((backup) => backup.type === "full" && backup.timestamp?.stop !== undefined)
    .sort((left, right) => (right.timestamp?.stop ?? 0) - (left.timestamp?.stop ?? 0))[0];
  const completedAtSeconds = latestFull?.timestamp?.stop;
  const fullAgeHours =
    completedAtSeconds === undefined
      ? undefined
      : Math.max(0, (args.nowMs - completedAtSeconds * 1_000) / (60 * 60 * 1_000));

  if (latestFull === undefined || fullAgeHours === undefined) {
    errors.push("no valid full backup is registered");
  } else if (fullAgeHours > args.maxFullAgeHours) {
    errors.push(
      `latest full is ${fullAgeHours.toFixed(1)} hours old; maximum is ${args.maxFullAgeHours}`
    );
  }

  if (args.archiveReadyCount >= args.criticalReadyCount) {
    errors.push(
      `archive queue has ${args.archiveReadyCount} ready segments; maximum is ${args.criticalReadyCount}`
    );
  } else if (args.archiveReadyCount >= args.warningReadyCount) {
    warnings.push(`archive queue has ${args.archiveReadyCount} ready segments`);
  }

  return {
    stanza: args.stanza,
    state: errors.length > 0 ? "critical" : warnings.length > 0 ? "warning" : "ok",
    latestFullLabel: latestFull?.label,
    latestFullCompletedAt:
      completedAtSeconds === undefined ? undefined : new Date(completedAtSeconds * 1_000).toISOString(),
    fullAgeHours: fullAgeHours === undefined ? undefined : Number(fullAgeHours.toFixed(2)),
    archiveReadyCount: args.archiveReadyCount,
    errors,
    warnings
  };
}

function aggregateState(states: PgBackRestHealthState[]): PgBackRestHealthState {
  if (states.includes("critical")) {
    return "critical";
  }

  return states.includes("warning") ? "warning" : "ok";
}

async function countArchiveReady(dataPath: string): Promise<number> {
  const entries = await readdir(join(dataPath, "pg_wal", "archive_status")).catch(() => []);
  return entries.filter((entry) => entry.endsWith(".ready")).length;
}

async function atomicWrite(path: string, report: PgBackRestHealthReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o640 });
  await rename(temporaryPath, path);
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = value === undefined ? fallback : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive number: ${value ?? "undefined"}`);
  }

  return parsed;
}

export async function runPgBackRestHealth(
  env: NodeJS.ProcessEnv = process.env
): Promise<PgBackRestHealthReport> {
  const binary = env.SIMPLEHOST_PGBACKREST_BIN ?? "/usr/bin/pgbackrest";
  const repositoryPath = env.SIMPLEHOST_PGBACKREST_REPO ?? "/srv/backups/pgbackrest";
  const stanzas = (env.SIMPLEHOST_PGBACKREST_STANZAS ?? "apps,control")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const maxFullAgeHours = positiveNumber(env.SIMPLEHOST_PGBACKREST_MAX_FULL_AGE_HOURS, 192);
  const warningReadyCount = positiveNumber(env.SIMPLEHOST_PGBACKREST_WARNING_READY_COUNT, 64);
  const criticalReadyCount = positiveNumber(env.SIMPLEHOST_PGBACKREST_CRITICAL_READY_COUNT, 256);
  const expectedUid = process.getuid?.();
  const observations: PgBackRestStanzaObservation[] = [];

  for (const stanza of stanzas) {
    const operationalErrors: string[] = [];
    let info: PgBackRestInfoStanza | undefined;

    try {
      const result = await execFileAsync(binary, ["--stanza", stanza, "info", "--output=json"], {
        maxBuffer: 4 * 1024 * 1024
      });
      info = (JSON.parse(result.stdout) as PgBackRestInfoStanza[])[0];
    } catch (error) {
      operationalErrors.push(
        `info failed: ${error instanceof Error ? error.message : "unknown pgBackRest error"}`
      );
    }

    try {
      await execFileAsync(binary, ["--stanza", stanza, "check"], { maxBuffer: 4 * 1024 * 1024 });
    } catch (error) {
      operationalErrors.push(
        `check failed: ${error instanceof Error ? error.message : "unknown pgBackRest error"}`
      );
    }

    for (const name of ["backup.info", "backup.info.copy"]) {
      const metadataPath = join(repositoryPath, "backup", stanza, name);
      const metadataStat = await stat(metadataPath).catch(() => undefined);

      if (metadataStat === undefined) {
        operationalErrors.push(`${metadataPath} is missing`);
      } else if (expectedUid !== undefined && metadataStat.uid !== expectedUid) {
        operationalErrors.push(`${metadataPath} is not owned by uid ${expectedUid}`);
      }
    }

    const dataPath = env[`SIMPLEHOST_PGBACKREST_${stanza.toUpperCase()}_DATA_PATH`] ??
      `/var/lib/pgsql/${stanza}/data`;
    observations.push(
      evaluatePgBackRestStanza({
        stanza,
        info,
        archiveReadyCount: await countArchiveReady(dataPath),
        nowMs: Date.now(),
        maxFullAgeHours,
        warningReadyCount,
        criticalReadyCount,
        operationalErrors
      })
    );
  }

  const filesystem = await statfs(repositoryPath, { bigint: true });
  const totalBytes = Number(filesystem.blocks * filesystem.bsize);
  const freeBytes = Number(filesystem.bfree * filesystem.bsize);
  const availableBytes = Number(filesystem.bavail * filesystem.bsize);
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const capacityBasis = usedBytes + availableBytes;
  const usedPercent = capacityBasis === 0 ? 0 : (usedBytes / capacityBasis) * 100;
  const errors: string[] = [];

  if (usedPercent >= 85 || availableBytes <= 5 * 1024 ** 3) {
    errors.push(
      `repository capacity is critical: ${usedPercent.toFixed(2)}% used, ${availableBytes} bytes available`
    );
  }

  const report: PgBackRestHealthReport = {
    schemaVersion: "simplehost-pgbackrest-health-v1",
    generatedAt: new Date().toISOString(),
    state: errors.length > 0 ? "critical" : aggregateState(observations.map((entry) => entry.state)),
    repository: {
      path: repositoryPath,
      usedPercent: Number(usedPercent.toFixed(2)),
      availableBytes
    },
    stanzas: observations,
    errors
  };
  await atomicWrite(
    env.SIMPLEHOST_PGBACKREST_HEALTH_REPORT_PATH ??
      "/var/lib/simplehost-pgbackrest-health/latest.json",
    report
  );
  return report;
}
