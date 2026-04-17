import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { registerGracefulShutdown } from "@simplehost/control-shared";

import {
  applyCombinedControlReleaseTarget,
  type CombinedControlReleaseTargetApplyManifest,
  readCombinedControlReleaseTargetApplyManifest
} from "./release-target-apply.js";
import {
  createCombinedControlReleaseTargetLayout,
  type CombinedControlReleaseTargetLayout
} from "./release-target-layout.js";
import type { CombinedControlStartupManifest } from "./startup-manifest.js";

export interface CombinedControlReleaseTargetRuntime {
  readonly kind: "combined-control-release-target";
  readonly origin: string;
  readonly manifest: CombinedControlStartupManifest;
  readonly applyManifest: CombinedControlReleaseTargetApplyManifest;
  readonly startupSummary: string;
  readonly applySummary: string;
  readonly layout: CombinedControlReleaseTargetLayout;
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

function validateReleaseTargetArtifacts(args: {
  layout: CombinedControlReleaseTargetLayout;
  manifest: CombinedControlStartupManifest;
  applyManifest: CombinedControlReleaseTargetApplyManifest;
  env: Record<string, string>;
  startupSummary: string;
  applySummary: string;
}) {
  const { layout, manifest, applyManifest, env, startupSummary, applySummary } = args;
  if (!existsSync(layout.releaseEntrypoint)) {
    throw new Error(`Release-target entrypoint missing: ${layout.releaseEntrypoint}`);
  }
  if (!existsSync(layout.envFile)) {
    throw new Error(`Release-target env file missing: ${layout.envFile}`);
  }
  if (!existsSync(layout.startupManifestFile)) {
    throw new Error(`Release-target startup manifest missing: ${layout.startupManifestFile}`);
  }
  if (!existsSync(layout.applyManifestFile)) {
    throw new Error(`Release-target apply manifest missing: ${layout.applyManifestFile}`);
  }
  if (!existsSync(layout.handoffManifestFile)) {
    throw new Error(`Release-target handoff manifest missing: ${layout.handoffManifestFile}`);
  }
  if (!lstatSync(layout.currentRoot).isSymbolicLink()) {
    throw new Error(`Release-target current root is not a symlink: ${layout.currentRoot}`);
  }
  if (realpathSync(layout.currentRoot) !== realpathSync(layout.releaseVersionRoot)) {
    throw new Error("Release-target current root does not point at the versioned release");
  }
  if (env.SIMPLEHOST_CONTROL_SANDBOX_ORIGIN !== manifest.origin) {
    throw new Error("Release-target env origin does not match startup manifest origin");
  }
  if (applyManifest.targetReleaseRoot !== layout.releaseRoot) {
    throw new Error("Release-target apply manifest does not point at the emulated release root");
  }
  if (!startupSummary.includes(manifest.origin)) {
    throw new Error("Release-target startup summary does not include runtime origin");
  }
  if (!applySummary.includes(layout.releaseRoot)) {
    throw new Error("Release-target apply summary does not include the emulated release root");
  }
}

async function startAppliedReleaseTarget(args: {
  layout: CombinedControlReleaseTargetLayout;
}): Promise<CombinedControlReleaseTargetRuntime> {
  const envFromFile = parseEnvFile(await readFile(args.layout.envFile, "utf8"));
  const manifest = readJsonFile<CombinedControlStartupManifest>(args.layout.startupManifestFile);
  const applyManifest = readJsonFile<CombinedControlReleaseTargetApplyManifest>(
    args.layout.applyManifestFile
  );
  const startupSummary = await readFile(args.layout.startupSummaryFile, "utf8");
  const applySummary = await readFile(args.layout.applySummaryFile, "utf8");

  validateReleaseTargetArtifacts({
    layout: args.layout,
    manifest,
    applyManifest,
    env: envFromFile,
    startupSummary,
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

  const runtime: CombinedControlReleaseTargetRuntime = {
    kind: "combined-control-release-target",
    origin: manifest.origin,
    manifest,
    applyManifest,
    startupSummary,
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

export async function startCombinedControlReleaseTarget(args: {
  workspaceRoot?: string;
  sandboxId?: string;
  version?: string;
  host?: string;
  port?: number;
} = {}): Promise<CombinedControlReleaseTargetRuntime> {
  const applied = await applyCombinedControlReleaseTarget(args);
  return startAppliedReleaseTarget({ layout: applied.layout });
}

export async function startExistingCombinedControlReleaseTarget(args: {
  workspaceRoot?: string;
  sandboxId?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseTargetRuntime> {
  const layout = createCombinedControlReleaseTargetLayout(args);
  const applyManifest =
    (await readCombinedControlReleaseTargetApplyManifest(args)) ??
    (() => {
      throw new Error("Release-target apply state is incomplete");
    })();
  void applyManifest;
  return startAppliedReleaseTarget({ layout });
}

export function registerCombinedControlReleaseTargetShutdown(
  runtime: CombinedControlReleaseTargetRuntime
) {
  registerGracefulShutdown(runtime.close, {
    onShutdownError: (error) => {
      console.error(error);
    }
  });
}
