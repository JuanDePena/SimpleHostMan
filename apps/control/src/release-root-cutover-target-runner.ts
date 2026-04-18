import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { registerGracefulShutdown } from "@simplehost/control-shared";

import {
  applyCombinedControlReleaseRootCutoverTarget,
  readCombinedControlReleaseRootCutoverTargetApplyManifest,
  type CombinedControlReleaseRootCutoverTargetApplyManifest
} from "./release-root-cutover-target.js";
import {
  createCombinedControlReleaseRootCutoverTargetLayout,
  type CombinedControlReleaseRootCutoverTargetLayout
} from "./release-root-cutover-target-layout.js";
import type { CombinedControlStartupManifest } from "./startup-manifest.js";

export interface CombinedControlReleaseRootCutoverTargetRuntime {
  readonly kind: "combined-control-release-root-cutover-target";
  readonly origin: string;
  readonly manifest: CombinedControlStartupManifest;
  readonly applyManifest: CombinedControlReleaseRootCutoverTargetApplyManifest;
  readonly startupSummary: string;
  readonly planSummary: string;
  readonly applySummary: string;
  readonly layout: CombinedControlReleaseRootCutoverTargetLayout;
  readonly child: ChildProcess;
  readonly stdoutLog: string[];
  readonly stderrLog: string[];
  close(): Promise<void>;
}

function parseEnvFile(content: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    entries[trimmed.slice(0, separatorIndex)] = trimmed.slice(separatorIndex + 1);
  }
  return entries;
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

async function waitForHealthz(origin: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL("/healthz", origin));
      if (response.ok) return;
      lastError = new Error(`healthz returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Timed out waiting for ${origin}/healthz`);
}

function validateReleaseRootCutoverTargetArtifacts(args: {
  layout: CombinedControlReleaseRootCutoverTargetLayout;
  manifest: CombinedControlStartupManifest;
  applyManifest: CombinedControlReleaseRootCutoverTargetApplyManifest;
  env: Record<string, string>;
  startupSummary: string;
  planSummary: string;
  applySummary: string;
}) {
  const { layout, manifest, applyManifest, env, startupSummary, planSummary, applySummary } = args;

  if (!existsSync(layout.releaseEntrypoint)) {
    throw new Error(`Release-root cutover target entrypoint missing: ${layout.releaseEntrypoint}`);
  }
  if (!existsSync(layout.envFile)) {
    throw new Error(`Release-root cutover target env file missing: ${layout.envFile}`);
  }
  if (!existsSync(layout.startupManifestFile)) {
    throw new Error(
      `Release-root cutover target startup manifest missing: ${layout.startupManifestFile}`
    );
  }
  if (!existsSync(layout.cutoverPlanManifestFile)) {
    throw new Error(
      `Release-root cutover target plan manifest missing: ${layout.cutoverPlanManifestFile}`
    );
  }
  if (!existsSync(layout.cutoverApplyManifestFile)) {
    throw new Error(
      `Release-root cutover target apply manifest missing: ${layout.cutoverApplyManifestFile}`
    );
  }
  if (!existsSync(layout.promotionManifestFile)) {
    throw new Error(
      `Release-root cutover target promotion manifest missing: ${layout.promotionManifestFile}`
    );
  }
  if (!existsSync(layout.deployManifestFile)) {
    throw new Error(
      `Release-root cutover target deploy manifest missing: ${layout.deployManifestFile}`
    );
  }
  if (!existsSync(layout.rollbackManifestFile)) {
    throw new Error(
      `Release-root cutover target rollback manifest missing: ${layout.rollbackManifestFile}`
    );
  }
  if (!existsSync(layout.handoffManifestFile)) {
    throw new Error(
      `Release-root cutover target handoff manifest missing: ${layout.handoffManifestFile}`
    );
  }
  if (!lstatSync(layout.currentRoot).isSymbolicLink()) {
    throw new Error(
      `Release-root cutover target current root is not a symlink: ${layout.currentRoot}`
    );
  }
  if (realpathSync(layout.currentRoot) !== realpathSync(layout.releaseVersionRoot)) {
    throw new Error(
      "Release-root cutover target current root does not point at the versioned release"
    );
  }
  if (env.SIMPLEHOST_CONTROL_SANDBOX_ORIGIN !== manifest.origin) {
    throw new Error(
      "Release-root cutover target env origin does not match startup manifest origin"
    );
  }
  if (applyManifest.targetReleaseRoot !== layout.releaseRoot) {
    throw new Error(
      "Release-root cutover target apply manifest does not point at the emulated release root"
    );
  }
  if (!startupSummary.includes(manifest.origin)) {
    throw new Error(
      "Release-root cutover target startup summary does not include runtime origin"
    );
  }
  if (!planSummary.includes(layout.releaseRoot)) {
    throw new Error("Release-root cutover target plan summary does not include the release root");
  }
  if (!applySummary.includes(layout.releaseRoot)) {
    throw new Error("Release-root cutover target apply summary does not include the release root");
  }
}

async function startAppliedReleaseRootCutoverTarget(args: {
  layout: CombinedControlReleaseRootCutoverTargetLayout;
}): Promise<CombinedControlReleaseRootCutoverTargetRuntime> {
  const envFromFile = parseEnvFile(await readFile(args.layout.envFile, "utf8"));
  const manifest = readJsonFile<CombinedControlStartupManifest>(args.layout.startupManifestFile);
  const applyManifest = readJsonFile<CombinedControlReleaseRootCutoverTargetApplyManifest>(
    args.layout.cutoverApplyManifestFile
  );
  const startupSummary = await readFile(args.layout.startupSummaryFile, "utf8");
  const planSummary = await readFile(args.layout.cutoverPlanSummaryFile, "utf8");
  const applySummary = await readFile(args.layout.cutoverApplySummaryFile, "utf8");

  validateReleaseRootCutoverTargetArtifacts({
    layout: args.layout,
    manifest,
    applyManifest,
    env: envFromFile,
    startupSummary,
    planSummary,
    applySummary
  });

  const stdoutLog: string[] = [];
  const stderrLog: string[] = [];
  const child = spawn(process.execPath, [args.layout.currentEntrypoint], {
    cwd: args.layout.currentRoot,
    env: {
      ...process.env,
      ...envFromFile
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => stdoutLog.push(chunk));
  child.stderr?.on("data", (chunk: string) => stderrLog.push(chunk));

  const runtime: CombinedControlReleaseRootCutoverTargetRuntime = {
    kind: "combined-control-release-root-cutover-target",
    origin: manifest.origin,
    manifest,
    applyManifest,
    startupSummary,
    planSummary,
    applySummary,
    layout: args.layout,
    child,
    stdoutLog,
    stderrLog,
    close: async () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      if (!child.killed) child.kill("SIGTERM");
      await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    }
  };

  try {
    await waitForHealthz(runtime.origin);
    return runtime;
  } catch (error) {
    await runtime.close().catch(() => {});
    throw error;
  }
}

export async function startCombinedControlReleaseRootCutoverTarget(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseRootCutoverTargetRuntime> {
  const applied = await applyCombinedControlReleaseRootCutoverTarget(args);
  return startAppliedReleaseRootCutoverTarget({ layout: applied.layout });
}

export async function startExistingCombinedControlReleaseRootCutoverTarget(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseRootCutoverTargetRuntime> {
  const layout = createCombinedControlReleaseRootCutoverTargetLayout(args);
  const applyManifest =
    (await readCombinedControlReleaseRootCutoverTargetApplyManifest(args)) ??
    (() => {
      throw new Error("Release-root cutover target apply state is incomplete");
    })();
  void applyManifest;
  return startAppliedReleaseRootCutoverTarget({ layout });
}

export function registerCombinedControlReleaseRootCutoverTargetShutdown(
  runtime: CombinedControlReleaseRootCutoverTargetRuntime
) {
  registerGracefulShutdown(runtime.close, {
    onShutdownError: (error) => {
      console.error(error);
    }
  });
}
