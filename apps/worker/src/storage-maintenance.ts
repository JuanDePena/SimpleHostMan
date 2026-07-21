import { hostname } from "node:os";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  stat,
  statfs,
  writeFile
} from "node:fs/promises";
import { dirname, basename, join, resolve } from "node:path";
import { spawn } from "node:child_process";

const dayMs = 24 * 60 * 60 * 1000;
const defaultBlockingProcessPatterns = [
  "run-platform-genesis-aal2.sh",
  "prepare-platform-genesis-live-input.mjs",
  "prepare-platform-genesis-private.mjs",
  "authorize-and-execute-platform-genesis.mjs",
  "execute-dictionary-catalog-genesis-product.mjs",
  "install-release.sh",
  "deploy-release.sh",
  "install-bundle.sh"
];

export interface StorageMaintenanceCliOptions {
  mode: "dry-run" | "apply";
  json: boolean;
  reportPath?: string;
}

export interface StorageMaintenanceOptions extends StorageMaintenanceCliOptions {
  rootPath: string;
  releaseRoot: string;
  backupRoot: string;
  recoveryRoot: string;
  watchedBackupPaths: string[];
  releaseKeep: number;
  releaseMinAgeDays: number;
  imageMinAgeHours: number;
  highWatermarkPercent: number;
  targetWatermarkPercent: number;
  pinnedReleases: string[];
  blockingProcessPatterns: string[];
  now: Date;
}

export interface ReleaseInventoryEntry {
  name: string;
  path: string;
  mtimeMs: number;
  sizeBytes: number;
  protectedReasons: string[];
}

export interface FilesystemUsage {
  path: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent: number;
}

export interface CommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface StorageMaintenanceReport {
  schemaVersion: "simplehost-storage-maintenance-report-v1";
  host: string;
  startedAt: string;
  completedAt: string;
  requestedMode: "dry-run" | "apply";
  status: "completed" | "skipped" | "partial";
  applied: boolean;
  skipReasons: string[];
  thresholds: {
    highWatermarkPercent: number;
    targetWatermarkPercent: number;
    releaseKeep: number;
    releaseMinAgeDays: number;
    imageMinAgeHours: number;
  };
  filesystem: {
    before: FilesystemUsage;
    after: FilesystemUsage;
  };
  mounts: {
    overlayCount: number;
    shmCount: number;
    runningContainerCount: number;
    overlayMatchesRunningContainers: boolean;
  };
  blockers: Array<{ pid: number; command: string }>;
  releases: {
    root: string;
    activeRelease?: string;
    protected: ReleaseInventoryEntry[];
    candidates: ReleaseInventoryEntry[];
    removed: string[];
    bytesRemoved: number;
  };
  podman: {
    available: boolean;
    storageCheckExitCode?: number;
    systemDf?: unknown;
    pruneAttempted: boolean;
    pruneExitCode?: number;
    pruneSummary?: string;
  };
  backups: {
    root: string;
    managedBy: "simplehost-backup-runner-and-pgbackrest";
    deletionAttempted: false;
    topLevel: DirectorySummary[];
    watchedPaths: DirectorySummary[];
  };
  recovery: {
    root: string;
    managedBy: "pyrosa-platform";
    deletionAttempted: false;
    usage?: FilesystemUsage;
    snapshotCount: number;
    sizeBytes: number;
  };
  warnings: string[];
  errors: string[];
}

interface DirectorySummary {
  path: string;
  sizeBytes: number;
  directoryCount: number;
  oldestMtime?: string;
  newestMtime?: string;
}

interface ReleaseInventory {
  activeRelease?: string;
  protected: ReleaseInventoryEntry[];
  candidates: ReleaseInventoryEntry[];
}

type CommandRunner = (command: string, args?: string[]) => Promise<CommandResult>;

function parseNonNegativeInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return parsed;
}

function parsePercent(value: string | undefined, fallback: number, name: string): number {
  const parsed = parseNonNegativeInteger(value, fallback, name);
  if (parsed > 100) {
    throw new Error(`${name} must be between 0 and 100.`);
  }
  return parsed;
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function parseStorageMaintenanceCliArgs(args: string[]): StorageMaintenanceCliOptions {
  let mode: StorageMaintenanceCliOptions["mode"] = "dry-run";
  let json = false;
  let reportPath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--apply") {
      mode = "apply";
      continue;
    }
    if (arg === "--dry-run") {
      mode = "dry-run";
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--no-report") {
      reportPath = "";
      continue;
    }
    if (arg === "--report") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--report requires a path.");
      }
      reportPath = value;
      index += 1;
      continue;
    }
    if (arg === "--help") {
      throw Object.assign(new Error("help"), { code: "help" });
    }

    throw new Error(`Unknown storage maintenance argument: ${arg}`);
  }

  return { mode, json, reportPath };
}

export function buildStorageMaintenanceOptions(
  cli: StorageMaintenanceCliOptions,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date()
): StorageMaintenanceOptions {
  const highWatermarkPercent = parsePercent(
    env.SIMPLEHOST_STORAGE_HIGH_WATERMARK_PERCENT,
    85,
    "SIMPLEHOST_STORAGE_HIGH_WATERMARK_PERCENT"
  );
  const targetWatermarkPercent = parsePercent(
    env.SIMPLEHOST_STORAGE_TARGET_WATERMARK_PERCENT,
    80,
    "SIMPLEHOST_STORAGE_TARGET_WATERMARK_PERCENT"
  );

  if (targetWatermarkPercent >= highWatermarkPercent) {
    throw new Error("The storage target watermark must be lower than the high watermark.");
  }

  return {
    ...cli,
    reportPath:
      cli.reportPath === undefined
        ? env.SIMPLEHOST_STORAGE_REPORT_PATH ??
          "/var/lib/simplehost/storage-maintenance/latest.json"
        : cli.reportPath || undefined,
    rootPath: env.SIMPLEHOST_STORAGE_ROOT_PATH ?? "/",
    releaseRoot: env.SIMPLEHOST_STORAGE_RELEASE_ROOT ?? "/opt/simplehostman/release",
    backupRoot: env.SIMPLEHOST_STORAGE_BACKUP_ROOT ?? "/srv/backups",
    recoveryRoot:
      env.SIMPLEHOST_STORAGE_GENESIS_RECOVERY_ROOT ??
      "/var/lib/pyrosa-platform/genesis-recovery",
    watchedBackupPaths: parseCsv(
      env.SIMPLEHOST_STORAGE_WATCHED_BACKUP_PATHS ??
        "/srv/backups/databases/pyrosa-sync"
    ),
    releaseKeep: parseNonNegativeInteger(
      env.SIMPLEHOST_STORAGE_RELEASE_KEEP,
      5,
      "SIMPLEHOST_STORAGE_RELEASE_KEEP"
    ),
    releaseMinAgeDays: parseNonNegativeInteger(
      env.SIMPLEHOST_STORAGE_RELEASE_MIN_AGE_DAYS,
      7,
      "SIMPLEHOST_STORAGE_RELEASE_MIN_AGE_DAYS"
    ),
    imageMinAgeHours: parseNonNegativeInteger(
      env.SIMPLEHOST_STORAGE_IMAGE_MIN_AGE_HOURS,
      168,
      "SIMPLEHOST_STORAGE_IMAGE_MIN_AGE_HOURS"
    ),
    highWatermarkPercent,
    targetWatermarkPercent,
    pinnedReleases: parseCsv(env.SIMPLEHOST_STORAGE_RELEASE_PINS),
    blockingProcessPatterns: [
      ...defaultBlockingProcessPatterns,
      ...parseCsv(env.SIMPLEHOST_STORAGE_BLOCKING_PROCESS_PATTERNS)
    ],
    now
  };
}

export function selectReleaseCandidates(
  entries: Array<Omit<ReleaseInventoryEntry, "protectedReasons">>,
  options: {
    activeRelease?: string;
    pinnedReleases: string[];
    metadataReleases: string[];
    keep: number;
    minAgeDays: number;
    now: Date;
  }
): ReleaseInventory {
  const ordered = [...entries].sort(
    (left, right) => right.mtimeMs - left.mtimeMs || right.name.localeCompare(left.name)
  );
  const newest = new Set(ordered.slice(0, options.keep).map((entry) => entry.name));
  const pins = new Set(options.pinnedReleases);
  const metadata = new Set(options.metadataReleases);
  const protectedEntries: ReleaseInventoryEntry[] = [];
  const candidates: ReleaseInventoryEntry[] = [];

  for (const entry of ordered) {
    const protectedReasons: string[] = [];

    if (entry.name === options.activeRelease) {
      protectedReasons.push("active");
    }
    if (newest.has(entry.name)) {
      protectedReasons.push("latest");
    }
    if (pins.has(entry.name)) {
      protectedReasons.push("pinned");
    }
    if (metadata.has(entry.name)) {
      protectedReasons.push("release-metadata");
    }

    const resolved = { ...entry, protectedReasons };
    const ageDays = (options.now.getTime() - entry.mtimeMs) / dayMs;

    if (protectedReasons.length > 0 || ageDays < options.minAgeDays) {
      if (protectedReasons.length === 0) {
        resolved.protectedReasons.push("minimum-age");
      }
      protectedEntries.push(resolved);
    } else {
      candidates.push(resolved);
    }
  }

  return {
    activeRelease: options.activeRelease,
    protected: protectedEntries,
    candidates
  };
}

export function detectBlockingProcesses(
  processes: Array<{ pid: number; command: string }>,
  patterns: string[],
  ownPid: number = process.pid
): Array<{ pid: number; command: string }> {
  return processes.filter(
    (entry) => {
      if (entry.pid === ownPid) {
        return false;
      }

      const tokens = entry.command
        .split(/\s+/)
        .map((token) => token.replace(/^['"]|['"]$/g, ""));
      const shellCommandWrapper =
        tokens[0]?.endsWith("/bash") === true &&
        (tokens[1] === "-c" || tokens[1] === "-lc");
      if (shellCommandWrapper) {
        return false;
      }

      return patterns.some(
        (pattern) =>
          pattern.length > 0 &&
          tokens.some((token) => basename(token) === pattern || token === pattern)
      );
    }
  );
}

export function shouldApplyMaintenance(
  mode: StorageMaintenanceCliOptions["mode"],
  usedPercent: number,
  highWatermarkPercent: number,
  blockerCount: number
): boolean {
  return mode === "apply" && usedPercent >= highWatermarkPercent && blockerCount === 0;
}

async function runCommand(command: string, args: string[] = []): Promise<CommandResult> {
  return await new Promise((resolveCommand) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolveCommand({
        command: [command, ...args].join(" "),
        exitCode: 127,
        stdout,
        stderr: `${stderr}${error.message}`
      });
    });
    child.on("close", (code) => {
      resolveCommand({
        command: [command, ...args].join(" "),
        exitCode: code ?? 1,
        stdout,
        stderr
      });
    });
  });
}

async function readFilesystemUsage(path: string): Promise<FilesystemUsage> {
  const stats = await statfs(path, { bigint: true });
  const blockSize = stats.bsize;
  const totalBytes = stats.blocks * blockSize;
  const usedBytes = (stats.blocks - stats.bfree) * blockSize;
  const availableBytes = stats.bavail * blockSize;
  const capacityBytes = usedBytes + availableBytes;

  return {
    path,
    totalBytes: Number(totalBytes),
    usedBytes: Number(usedBytes),
    availableBytes: Number(availableBytes),
    usedPercent:
      capacityBytes === 0n ? 0 : Number((usedBytes * 10_000n) / capacityBytes) / 100
  };
}

async function directorySizeBytes(path: string, commandRunner: CommandRunner): Promise<number> {
  const result = await commandRunner("/usr/bin/du", ["-s", "-B1", "--", path]);
  if (result.exitCode !== 0) {
    return 0;
  }
  const value = Number(result.stdout.trim().split(/\s+/, 1)[0]);
  return Number.isFinite(value) ? value : 0;
}

async function summarizeDirectory(
  path: string,
  commandRunner: CommandRunner
): Promise<DirectorySummary> {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
  const directories = entries.filter((entry) => entry.isDirectory() && !entry.isSymbolicLink());
  const mtimes = (
    await Promise.all(
      directories.map(async (entry) => {
        const entryStat = await stat(join(path, entry.name)).catch(() => undefined);
        return entryStat?.mtime;
      })
    )
  ).filter((value): value is Date => value !== undefined);
  mtimes.sort((left, right) => left.getTime() - right.getTime());

  return {
    path,
    sizeBytes: await directorySizeBytes(path, commandRunner),
    directoryCount: directories.length,
    oldestMtime: mtimes[0]?.toISOString(),
    newestMtime: mtimes.at(-1)?.toISOString()
  };
}

async function summarizeTopLevelDirectories(
  root: string,
  commandRunner: CommandRunner
): Promise<DirectorySummary[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const summaries = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
      .map((entry) => summarizeDirectory(join(root, entry.name), commandRunner))
  );

  return summaries.sort((left, right) => right.sizeBytes - left.sizeBytes);
}

async function readProcessList(): Promise<Array<{ pid: number; command: string }>> {
  const entries = await readdir("/proc", { withFileTypes: true }).catch(() => []);
  const processes = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
      .map(async (entry) => {
        const command = await readFile(join("/proc", entry.name, "cmdline"), "utf8").catch(
          () => ""
        );
        return {
          pid: Number(entry.name),
          command: command.replaceAll("\0", " ").trim()
        };
      })
  );

  return processes.filter((entry) => entry.command.length > 0);
}

function collectStrings(value: unknown, output: Set<string>): void {
  if (typeof value === "string") {
    output.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectStrings(entry, output));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((entry) => collectStrings(entry, output));
  }
}

async function readReleaseMetadataNames(
  releaseRoot: string,
  releaseNames: Set<string>
): Promise<string[]> {
  const metaRoot = join(releaseRoot, "shared", "meta");
  const entries = await readdir(metaRoot, { withFileTypes: true }).catch(() => []);
  const values = new Set<string>();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const content = await readFile(join(metaRoot, entry.name), "utf8").catch(() => "");
    try {
      collectStrings(JSON.parse(content), values);
    } catch {
      // Invalid historical metadata is ignored here and remains available for operator review.
    }
  }

  const protectedNames = new Set<string>();
  for (const value of values) {
    if (releaseNames.has(value)) {
      protectedNames.add(value);
    }
    const releaseMarker = "/releases/";
    const markerIndex = value.lastIndexOf(releaseMarker);
    if (markerIndex >= 0) {
      const releaseName = value.slice(markerIndex + releaseMarker.length).split("/", 1)[0];
      if (releaseName && releaseNames.has(releaseName)) {
        protectedNames.add(releaseName);
      }
    }
  }

  return [...protectedNames];
}

async function resolveActiveRelease(releaseRoot: string): Promise<string | undefined> {
  const currentPath = join(releaseRoot, "current");
  const target = await readlink(currentPath).catch(() => undefined);
  if (!target) {
    return undefined;
  }

  const resolvedTarget = resolve(dirname(currentPath), target);
  const realTarget = await realpath(resolvedTarget).catch(() => undefined);
  const realReleasesRoot = await realpath(join(releaseRoot, "releases")).catch(() => undefined);
  if (!realTarget || !realReleasesRoot || dirname(realTarget) !== realReleasesRoot) {
    return undefined;
  }

  return basename(realTarget);
}

async function buildReleaseInventory(
  options: StorageMaintenanceOptions,
  commandRunner: CommandRunner
): Promise<ReleaseInventory> {
  const releasesRoot = join(options.releaseRoot, "releases");
  const directoryEntries = await readdir(releasesRoot, { withFileTypes: true }).catch(() => []);
  const releases: Array<Omit<ReleaseInventoryEntry, "protectedReasons">> = [];

  for (const entry of directoryEntries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      continue;
    }
    const path = join(releasesRoot, entry.name);
    const entryStat = await stat(path);
    releases.push({
      name: entry.name,
      path,
      mtimeMs: entryStat.mtimeMs,
      sizeBytes: await directorySizeBytes(path, commandRunner)
    });
  }

  const releaseNames = new Set(releases.map((entry) => entry.name));
  return selectReleaseCandidates(releases, {
    activeRelease: await resolveActiveRelease(options.releaseRoot),
    pinnedReleases: options.pinnedReleases,
    metadataReleases: await readReleaseMetadataNames(options.releaseRoot, releaseNames),
    keep: options.releaseKeep,
    minAgeDays: options.releaseMinAgeDays,
    now: options.now
  });
}

async function removeReleaseCandidate(
  candidate: ReleaseInventoryEntry,
  releaseRoot: string,
  activeRelease?: string
): Promise<void> {
  if (candidate.name === activeRelease) {
    throw new Error(`Refusing to remove active release ${candidate.name}.`);
  }

  const releasesRoot = join(releaseRoot, "releases");
  const realParent = await realpath(dirname(candidate.path));
  const realReleasesRoot = await realpath(releasesRoot);
  const candidateStat = await lstat(candidate.path);

  if (
    realParent !== realReleasesRoot ||
    candidate.path !== join(releasesRoot, candidate.name) ||
    !candidateStat.isDirectory() ||
    candidateStat.isSymbolicLink()
  ) {
    throw new Error(`Release candidate failed path validation: ${candidate.path}`);
  }

  await rm(candidate.path, { recursive: true, force: false });
}

function lineCount(value: string): number {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

async function writeReport(path: string, report: StorageMaintenanceReport): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o750 });
  const temporaryPath = `${path}.tmp.${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o640 });
  await rename(temporaryPath, path);
}

export async function runStorageMaintenance(
  options: StorageMaintenanceOptions,
  commandRunner: CommandRunner = runCommand
): Promise<StorageMaintenanceReport> {
  const startedAt = new Date();
  const errors: string[] = [];
  const warnings: string[] = [];
  const skipReasons: string[] = [];
  const filesystemBefore = await readFilesystemUsage(options.rootPath);
  const releaseInventory = await buildReleaseInventory(options, commandRunner);
  const blockers = detectBlockingProcesses(
    await readProcessList(),
    options.blockingProcessPatterns
  );
  const backupRunnerState = await commandRunner("/usr/bin/systemctl", [
    "is-active",
    "--quiet",
    "simplehost-backup-runner.service"
  ]);
  if (backupRunnerState.exitCode === 0) {
    blockers.push({ pid: 0, command: "simplehost-backup-runner.service is active" });
  }

  const [overlayMounts, shmMounts, runningContainers, podmanDf, podmanCheck] =
    await Promise.all([
      commandRunner("/usr/bin/findmnt", ["-rn", "-t", "overlay", "-o", "TARGET"]),
      commandRunner("/usr/bin/findmnt", ["-rn", "-S", "shm", "-o", "TARGET"]),
      commandRunner("/usr/bin/podman", ["ps", "-q"]),
      commandRunner("/usr/bin/podman", ["system", "df", "--format", "json"]),
      commandRunner("/usr/bin/podman", ["system", "check", "--quick"])
    ]);
  const overlayCount = overlayMounts.exitCode === 0 ? lineCount(overlayMounts.stdout) : 0;
  const shmCount = shmMounts.exitCode === 0 ? lineCount(shmMounts.stdout) : 0;
  const runningContainerCount =
    runningContainers.exitCode === 0 ? lineCount(runningContainers.stdout) : 0;

  if (overlayCount !== runningContainerCount) {
    warnings.push(
      `Overlay mount count (${overlayCount}) differs from running containers (${runningContainerCount}); inspect Podman before repair.`
    );
  }
  if (filesystemBefore.usedPercent >= options.highWatermarkPercent) {
    warnings.push(
      `Root filesystem is above the ${options.highWatermarkPercent}% high watermark.`
    );
  }
  if (podmanCheck.exitCode !== 0) {
    warnings.push("Podman storage consistency check did not complete successfully.");
  }

  const backupTopLevel = await summarizeTopLevelDirectories(options.backupRoot, commandRunner);
  const watchedBackupPaths = await Promise.all(
    options.watchedBackupPaths.map((path) => summarizeDirectory(path, commandRunner))
  );
  const recoverySummary = await summarizeDirectory(options.recoveryRoot, commandRunner);
  const recoverySnapshotCount = (
    await readdir(options.recoveryRoot, { withFileTypes: true }).catch(() => [])
  ).filter(
    (entry) => entry.isDirectory() && !entry.isSymbolicLink() && entry.name.startsWith("c8-")
  ).length;
  const recoveryUsage = await readFilesystemUsage(options.recoveryRoot).catch(() => undefined);
  if (recoveryUsage && recoveryUsage.usedPercent >= options.highWatermarkPercent) {
    warnings.push(
      `Platform Genesis recovery filesystem is at ${recoveryUsage.usedPercent}%; Platform retention is required.`
    );
  }

  let podmanSystemDf: unknown;
  if (podmanDf.exitCode === 0) {
    try {
      podmanSystemDf = JSON.parse(podmanDf.stdout);
    } catch {
      warnings.push("Podman system df returned non-JSON output.");
    }
  }

  const apply = shouldApplyMaintenance(
    options.mode,
    filesystemBefore.usedPercent,
    options.highWatermarkPercent,
    blockers.length
  );
  if (options.mode === "dry-run") {
    skipReasons.push("dry-run");
  } else if (filesystemBefore.usedPercent < options.highWatermarkPercent) {
    skipReasons.push("below-high-watermark");
  } else if (blockers.length > 0) {
    skipReasons.push("blocking-operation-active");
  }

  const removed: string[] = [];
  let bytesRemoved = 0;
  let pruneAttempted = false;
  let pruneExitCode: number | undefined;
  let pruneSummary: string | undefined;

  if (apply) {
    for (const candidate of releaseInventory.candidates) {
      try {
        await removeReleaseCandidate(
          candidate,
          options.releaseRoot,
          releaseInventory.activeRelease
        );
        removed.push(candidate.name);
        bytesRemoved += candidate.sizeBytes;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    const afterReleaseUsage = await readFilesystemUsage(options.rootPath);
    if (afterReleaseUsage.usedPercent >= options.targetWatermarkPercent) {
      pruneAttempted = true;
      const prune = await commandRunner("/usr/bin/podman", [
        "image",
        "prune",
        "-a",
        "--force",
        "--filter",
        `until=${options.imageMinAgeHours}h`
      ]);
      pruneExitCode = prune.exitCode;
      pruneSummary = (prune.stdout || prune.stderr).trim();
      if (prune.exitCode !== 0) {
        errors.push(`Podman image prune failed with exit code ${prune.exitCode}.`);
      }
    } else {
      skipReasons.push("target-watermark-reached-before-image-prune");
    }
  }

  const filesystemAfter = await readFilesystemUsage(options.rootPath);
  const report: StorageMaintenanceReport = {
    schemaVersion: "simplehost-storage-maintenance-report-v1",
    host: hostname(),
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    requestedMode: options.mode,
    status:
      errors.length > 0 ? "partial" : options.mode === "apply" && !apply ? "skipped" : "completed",
    applied: apply,
    skipReasons,
    thresholds: {
      highWatermarkPercent: options.highWatermarkPercent,
      targetWatermarkPercent: options.targetWatermarkPercent,
      releaseKeep: options.releaseKeep,
      releaseMinAgeDays: options.releaseMinAgeDays,
      imageMinAgeHours: options.imageMinAgeHours
    },
    filesystem: {
      before: filesystemBefore,
      after: filesystemAfter
    },
    mounts: {
      overlayCount,
      shmCount,
      runningContainerCount,
      overlayMatchesRunningContainers: overlayCount === runningContainerCount
    },
    blockers,
    releases: {
      root: options.releaseRoot,
      activeRelease: releaseInventory.activeRelease,
      protected: releaseInventory.protected,
      candidates: releaseInventory.candidates,
      removed,
      bytesRemoved
    },
    podman: {
      available: podmanDf.exitCode === 0,
      storageCheckExitCode: podmanCheck.exitCode,
      systemDf: podmanSystemDf,
      pruneAttempted,
      pruneExitCode,
      pruneSummary
    },
    backups: {
      root: options.backupRoot,
      managedBy: "simplehost-backup-runner-and-pgbackrest",
      deletionAttempted: false,
      topLevel: backupTopLevel,
      watchedPaths: watchedBackupPaths
    },
    recovery: {
      root: options.recoveryRoot,
      managedBy: "pyrosa-platform",
      deletionAttempted: false,
      usage: recoveryUsage,
      snapshotCount: recoverySnapshotCount,
      sizeBytes: recoverySummary.sizeBytes
    },
    warnings,
    errors
  };

  if (options.reportPath) {
    await writeReport(options.reportPath, report);
  }

  return report;
}
