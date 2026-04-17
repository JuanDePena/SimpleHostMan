import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { registerGracefulShutdown } from "@simplehost/control-shared";

import { createCombinedControlReleaseShadowLayout } from "./release-shadow-layout.js";
import {
  packCombinedControlReleaseShadow,
  type PackCombinedControlReleaseShadowResult
} from "./release-shadow-pack.js";
import type { CombinedControlReleaseShadowManifest } from "./release-shadow-manifest.js";
import type { CombinedControlStartupManifest } from "./startup-manifest.js";

export interface CombinedControlReleaseShadowRuntime {
  readonly kind: "combined-control-release-shadow";
  readonly origin: string;
  readonly manifest: CombinedControlStartupManifest;
  readonly shadowManifest: CombinedControlReleaseShadowManifest;
  readonly startupSummary: string;
  readonly shadowSummary: string;
  readonly packed: PackCombinedControlReleaseShadowResult;
  readonly child: ChildProcess;
  readonly stdoutLog: string[];
  readonly stderrLog: string[];
  close(): Promise<void>;
}

function parseEnvFile(content: string): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    entries[trimmed.slice(0, separatorIndex)] = trimmed.slice(separatorIndex + 1);
  }

  return entries;
}

async function waitForHealthz(origin: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL("/healthz", origin));
      if (response.ok) {
        return;
      }
      lastError = new Error(`healthz returned ${response.status}`);
    } catch (error: unknown) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Timed out waiting for ${origin}/healthz`);
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function validateReleaseShadowArtifacts(args: {
  packed: PackCombinedControlReleaseShadowResult;
  startupManifest: CombinedControlStartupManifest;
  shadowManifest: CombinedControlReleaseShadowManifest;
  env: Record<string, string>;
  startupSummary: string;
  shadowSummary: string;
}) {
  const { packed, startupManifest, shadowManifest, env, startupSummary, shadowSummary } = args;
  const layout = packed.layout;

  if (!existsSync(layout.releaseEntrypoint)) {
    throw new Error(`Release-shadow entrypoint missing: ${layout.releaseEntrypoint}`);
  }
  if (!existsSync(layout.envFile)) {
    throw new Error(`Release-shadow env file missing: ${layout.envFile}`);
  }
  if (!existsSync(layout.startupManifestFile)) {
    throw new Error(
      `Release-shadow startup manifest missing: ${layout.startupManifestFile}`
    );
  }
  if (!existsSync(layout.shadowManifestFile)) {
    throw new Error(`Release-shadow manifest missing: ${layout.shadowManifestFile}`);
  }
  if (!lstatSync(layout.currentRoot).isSymbolicLink()) {
    throw new Error(`Release-shadow current root is not a symlink: ${layout.currentRoot}`);
  }
  if (realpathSync(layout.currentRoot) !== realpathSync(layout.releaseVersionRoot)) {
    throw new Error("Release-shadow current root does not point at the versioned release");
  }
  if (!existsSync(layout.sharedMetaDir)) {
    throw new Error(`Release-shadow shared/meta missing: ${layout.sharedMetaDir}`);
  }
  if (shadowManifest.origin !== startupManifest.origin) {
    throw new Error("Release-shadow manifest origin does not match startup manifest origin");
  }
  if (env.SIMPLEHOST_CONTROL_SANDBOX_ORIGIN !== startupManifest.origin) {
    throw new Error("Release-shadow env origin does not match startup manifest origin");
  }
  if (!startupSummary.includes(startupManifest.origin)) {
    throw new Error("Release-shadow startup summary does not include runtime origin");
  }
  if (!shadowSummary.includes(layout.releaseRoot)) {
    throw new Error("Release-shadow summary does not include the release root");
  }
}

async function startPackedCombinedControlReleaseShadow(args: {
  packed: PackCombinedControlReleaseShadowResult;
}): Promise<CombinedControlReleaseShadowRuntime> {
  const envFromFile = parseEnvFile(await readFile(args.packed.layout.envFile, "utf8"));
  const startupManifest = readJsonFile<CombinedControlStartupManifest>(
    args.packed.layout.startupManifestFile
  );
  const shadowManifest = readJsonFile<CombinedControlReleaseShadowManifest>(
    args.packed.layout.shadowManifestFile
  );
  const startupSummary = await readFile(args.packed.layout.startupSummaryFile, "utf8");
  const shadowSummary = await readFile(args.packed.layout.shadowSummaryFile, "utf8");

  validateReleaseShadowArtifacts({
    packed: args.packed,
    startupManifest,
    shadowManifest,
    env: envFromFile,
    startupSummary,
    shadowSummary
  });

  const stdoutLog: string[] = [];
  const stderrLog: string[] = [];
  const child = spawn(process.execPath, [args.packed.layout.currentEntrypoint], {
    cwd: args.packed.layout.currentRoot,
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

  const runtime: CombinedControlReleaseShadowRuntime = {
    kind: "combined-control-release-shadow",
    origin: startupManifest.origin,
    manifest: startupManifest,
    shadowManifest,
    startupSummary,
    shadowSummary,
    packed: args.packed,
    child,
    stdoutLog,
    stderrLog,
    close: async () => {
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }
      if (!child.killed) {
        child.kill("SIGTERM");
      }
      await new Promise<void>((resolve) => {
        child.once("exit", () => resolve());
      });
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

export async function startCombinedControlReleaseShadow(args: {
  workspaceRoot?: string;
  sandboxId?: string;
  version?: string;
  host?: string;
  port?: number;
} = {}): Promise<CombinedControlReleaseShadowRuntime> {
  const packed = await packCombinedControlReleaseShadow(args);
  return startPackedCombinedControlReleaseShadow({ packed });
}

export function registerCombinedControlReleaseShadowShutdown(
  runtime: CombinedControlReleaseShadowRuntime
) {
  registerGracefulShutdown(runtime.close, {
    onShutdownError: (error) => {
      console.error(error);
    }
  });
}
