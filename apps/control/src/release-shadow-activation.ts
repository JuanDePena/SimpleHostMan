import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";

import type { CombinedControlReleaseShadowManifest } from "./release-shadow-manifest.js";
import {
  createCombinedControlReleaseShadowLayout,
  type CombinedControlReleaseShadowLayout
} from "./release-shadow-layout.js";

export interface CombinedControlReleaseShadowReleaseRecord {
  readonly version: string;
  readonly releaseVersionRoot: string;
  readonly envFile: string;
  readonly startupManifestFile: string;
  readonly startupSummaryFile: string;
  readonly shadowManifestFile: string;
  readonly packedAt: string;
  readonly sourceCommitish: string;
}

export interface CombinedControlReleaseShadowInventory {
  readonly kind: "combined-release-shadow-inventory";
  readonly sandboxId: string;
  readonly workspaceRoot: string;
  readonly releases: readonly CombinedControlReleaseShadowReleaseRecord[];
}

export interface CombinedControlReleaseShadowActivationManifest {
  readonly kind: "combined-release-shadow-activation";
  readonly sandboxId: string;
  readonly activeVersion: string;
  readonly previousVersion: string | null;
  readonly currentRoot: string;
  readonly currentEntrypoint: string;
  readonly activatedAt: string;
  readonly availableVersions: readonly string[];
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function readCombinedControlReleaseShadowInventory(args: {
  workspaceRoot?: string;
  sandboxId?: string;
} = {}): Promise<CombinedControlReleaseShadowInventory> {
  const layout = createCombinedControlReleaseShadowLayout(args);
  const inventory =
    safeReadJson<CombinedControlReleaseShadowInventory>(layout.releasesInventoryFile);

  if (inventory) {
    return inventory;
  }

  return {
    kind: "combined-release-shadow-inventory",
    sandboxId: layout.sandboxId,
    workspaceRoot: layout.workspaceRoot,
    releases: []
  };
}

export async function writeCombinedControlReleaseShadowInventory(args: {
  layout: CombinedControlReleaseShadowLayout;
  inventory: CombinedControlReleaseShadowInventory;
}): Promise<void> {
  await mkdir(args.layout.sharedMetaDir, { recursive: true });
  await writeFile(
    args.layout.releasesInventoryFile,
    JSON.stringify(args.inventory, null, 2).concat("\n")
  );
}

export function formatCombinedControlReleaseShadowInventory(
  inventory: CombinedControlReleaseShadowInventory
): string {
  return [
    "Combined control release-shadow inventory",
    `Sandbox: ${inventory.sandboxId}`,
    `Workspace root: ${inventory.workspaceRoot}`,
    `Versions: ${
      inventory.releases.length > 0
        ? inventory.releases.map((release) => release.version).join(", ")
        : "none"
    }`
  ].join("\n");
}

export function formatCombinedControlReleaseShadowActivation(
  manifest: CombinedControlReleaseShadowActivationManifest
): string {
  return [
    "Combined control release-shadow activation",
    `Sandbox: ${manifest.sandboxId}`,
    `Active version: ${manifest.activeVersion}`,
    `Previous version: ${manifest.previousVersion ?? "none"}`,
    `Activated: ${manifest.activatedAt}`,
    `Current root: ${manifest.currentRoot}`,
    `Current entrypoint: ${manifest.currentEntrypoint}`,
    `Available versions: ${manifest.availableVersions.join(", ") || "none"}`
  ].join("\n");
}

export async function activateCombinedControlReleaseShadowVersion(args: {
  workspaceRoot?: string;
  sandboxId?: string;
  version: string;
}): Promise<CombinedControlReleaseShadowActivationManifest> {
  const layout = createCombinedControlReleaseShadowLayout(args);
  const inventory = await readCombinedControlReleaseShadowInventory({
    workspaceRoot: layout.workspaceRoot,
    sandboxId: layout.sandboxId
  });
  const targetRelease = inventory.releases.find((release) => release.version === args.version);

  if (!targetRelease) {
    throw new Error(
      `Release-shadow version ${args.version} is not available in sandbox ${layout.sandboxId}`
    );
  }

  await mkdir(layout.sharedMetaDir, { recursive: true });

  const previousActivation =
    safeReadJson<CombinedControlReleaseShadowActivationManifest>(
      layout.activationManifestFile
    );
  const previousVersion = previousActivation?.activeVersion ?? null;

  try {
    const currentStat = lstatSync(layout.currentRoot);
    if (currentStat.isSymbolicLink() || currentStat.isDirectory()) {
      await rm(layout.currentRoot, { recursive: true, force: true });
    }
  } catch {
    // current link does not exist yet
  }

  await symlink(targetRelease.releaseVersionRoot, layout.currentRoot);
  if (!lstatSync(layout.currentRoot).isSymbolicLink()) {
    throw new Error(`Release-shadow current root is not a symlink: ${layout.currentRoot}`);
  }
  if (realpathSync(layout.currentRoot) !== realpathSync(targetRelease.releaseVersionRoot)) {
    throw new Error("Release-shadow current root does not point at the requested version");
  }

  const manifest: CombinedControlReleaseShadowActivationManifest = {
    kind: "combined-release-shadow-activation",
    sandboxId: layout.sandboxId,
    activeVersion: args.version,
    previousVersion,
    currentRoot: layout.currentRoot,
    currentEntrypoint: layout.currentEntrypoint,
    activatedAt: new Date().toISOString(),
    availableVersions: inventory.releases.map((release) => release.version)
  };

  await writeFile(
    layout.activationManifestFile,
    JSON.stringify(manifest, null, 2).concat("\n")
  );
  await writeFile(
    layout.activationSummaryFile,
    formatCombinedControlReleaseShadowActivation(manifest).concat("\n")
  );

  return manifest;
}

export async function resolveActiveCombinedControlReleaseShadow(args: {
  workspaceRoot?: string;
  sandboxId?: string;
} = {}): Promise<{
  layout: CombinedControlReleaseShadowLayout;
  activation: CombinedControlReleaseShadowActivationManifest;
  manifest: CombinedControlReleaseShadowManifest;
}> {
  const layout = createCombinedControlReleaseShadowLayout(args);
  const activation =
    safeReadJson<CombinedControlReleaseShadowActivationManifest>(
      layout.activationManifestFile
    );

  if (!activation) {
    throw new Error(`Release-shadow activation manifest missing: ${layout.activationManifestFile}`);
  }

  const activeLayout = createCombinedControlReleaseShadowLayout({
    workspaceRoot: layout.workspaceRoot,
    sandboxId: layout.sandboxId,
    version: activation.activeVersion
  });
  const manifest =
    safeReadJson<CombinedControlReleaseShadowManifest>(activeLayout.shadowManifestFile);

  if (!manifest) {
    throw new Error(
      `Release-shadow manifest missing for active version: ${activeLayout.shadowManifestFile}`
    );
  }

  return {
    layout: activeLayout,
    activation,
    manifest
  };
}
