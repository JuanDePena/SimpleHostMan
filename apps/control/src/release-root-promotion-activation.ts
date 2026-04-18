import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { mkdir, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  createCombinedControlReleaseRootPromotionLayout,
  type CombinedControlReleaseRootPromotionLayout
} from "./release-root-promotion-layout.js";

export interface CombinedControlReleaseRootPromotionReleaseRecord {
  readonly version: string;
  readonly releaseVersionRoot: string;
  readonly envFile: string;
  readonly startupManifestFile: string;
  readonly startupSummaryFile: string;
  readonly packedAt: string;
}

export interface CombinedControlReleaseRootPromotionInventory {
  readonly kind: "combined-release-root-promotion-inventory";
  readonly targetId: string;
  readonly workspaceRoot: string;
  readonly releases: readonly CombinedControlReleaseRootPromotionReleaseRecord[];
}

export interface CombinedControlReleaseRootPromotionActivationManifest {
  readonly kind: "combined-release-root-promotion-activation";
  readonly targetId: string;
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

function formatRecordVersion(record: CombinedControlReleaseRootPromotionReleaseRecord) {
  return record.version;
}

export async function readCombinedControlReleaseRootPromotionInventory(args: {
  workspaceRoot?: string;
  targetId?: string;
} = {}): Promise<CombinedControlReleaseRootPromotionInventory> {
  const layout = createCombinedControlReleaseRootPromotionLayout(args);
  const inventory =
    safeReadJson<CombinedControlReleaseRootPromotionInventory>(layout.releasesInventoryFile);

  if (inventory) {
    return inventory;
  }

  return {
    kind: "combined-release-root-promotion-inventory",
    targetId: layout.targetId,
    workspaceRoot: layout.workspaceRoot,
    releases: []
  };
}

async function writeCombinedControlReleaseRootPromotionInventory(args: {
  layout: CombinedControlReleaseRootPromotionLayout;
  inventory: CombinedControlReleaseRootPromotionInventory;
}) {
  await mkdir(args.layout.sharedMetaDir, { recursive: true });
  await writeFile(
    args.layout.releasesInventoryFile,
    JSON.stringify(args.inventory, null, 2).concat("\n")
  );
}

export function formatCombinedControlReleaseRootPromotionInventory(
  inventory: CombinedControlReleaseRootPromotionInventory
): string {
  return [
    "Combined control release-root promotion inventory",
    `Target: ${inventory.targetId}`,
    `Workspace root: ${inventory.workspaceRoot}`,
    `Versions: ${
      inventory.releases.length > 0
        ? inventory.releases.map(formatRecordVersion).join(", ")
        : "none"
    }`
  ].join("\n");
}

export function formatCombinedControlReleaseRootPromotionActivation(
  manifest: CombinedControlReleaseRootPromotionActivationManifest
): string {
  return [
    "Combined control release-root promotion activation",
    `Target: ${manifest.targetId}`,
    `Active version: ${manifest.activeVersion}`,
    `Previous version: ${manifest.previousVersion ?? "none"}`,
    `Activated: ${manifest.activatedAt}`,
    `Current root: ${manifest.currentRoot}`,
    `Current entrypoint: ${manifest.currentEntrypoint}`,
    `Available versions: ${manifest.availableVersions.join(", ") || "none"}`
  ].join("\n");
}

export async function syncCombinedControlReleaseRootPromotionInventory(args: {
  workspaceRoot?: string;
  targetId?: string;
} = {}): Promise<{
  layout: CombinedControlReleaseRootPromotionLayout;
  inventory: CombinedControlReleaseRootPromotionInventory;
}> {
  const layout = createCombinedControlReleaseRootPromotionLayout(args);
  const entries = await readdir(layout.releasesRoot, { withFileTypes: true }).catch(() => []);
  const releases = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const version = entry.name;
      const releaseVersionRoot = join(layout.releasesRoot, version);
      return {
        version,
        releaseVersionRoot,
        envFile: join(releaseVersionRoot, "env", "control.env"),
        startupManifestFile: join(releaseVersionRoot, "meta", "startup-manifest.json"),
        startupSummaryFile: join(releaseVersionRoot, "meta", "startup-summary.txt"),
        packedAt: new Date().toISOString()
      } satisfies CombinedControlReleaseRootPromotionReleaseRecord;
    })
    .sort((left, right) => left.version.localeCompare(right.version));

  const inventory: CombinedControlReleaseRootPromotionInventory = {
    kind: "combined-release-root-promotion-inventory",
    targetId: layout.targetId,
    workspaceRoot: layout.workspaceRoot,
    releases
  };

  await writeCombinedControlReleaseRootPromotionInventory({ layout, inventory });

  return {
    layout,
    inventory
  };
}

export async function activateCombinedControlReleaseRootPromotionVersion(args: {
  workspaceRoot?: string;
  targetId?: string;
  version: string;
}): Promise<CombinedControlReleaseRootPromotionActivationManifest> {
  const layout = createCombinedControlReleaseRootPromotionLayout(args);
  const { inventory } = await syncCombinedControlReleaseRootPromotionInventory({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId
  });
  const targetRelease = inventory.releases.find((release) => release.version === args.version);

  if (!targetRelease) {
    throw new Error(
      `Release-root promotion version ${args.version} is not available for target ${layout.targetId}`
    );
  }

  await mkdir(layout.sharedMetaDir, { recursive: true });

  const previousActivation =
    safeReadJson<CombinedControlReleaseRootPromotionActivationManifest>(
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
    throw new Error(
      `Release-root promotion current root is not a symlink: ${layout.currentRoot}`
    );
  }
  if (realpathSync(layout.currentRoot) !== realpathSync(targetRelease.releaseVersionRoot)) {
    throw new Error(
      "Release-root promotion current root does not point at the requested version"
    );
  }

  const manifest: CombinedControlReleaseRootPromotionActivationManifest = {
    kind: "combined-release-root-promotion-activation",
    targetId: layout.targetId,
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
    formatCombinedControlReleaseRootPromotionActivation(manifest).concat("\n")
  );

  return manifest;
}

export async function resolveActiveCombinedControlReleaseRootPromotion(args: {
  workspaceRoot?: string;
  targetId?: string;
} = {}): Promise<{
  layout: CombinedControlReleaseRootPromotionLayout;
  activation: CombinedControlReleaseRootPromotionActivationManifest;
}> {
  const layout = createCombinedControlReleaseRootPromotionLayout(args);
  const activation =
    safeReadJson<CombinedControlReleaseRootPromotionActivationManifest>(
      layout.activationManifestFile
    );

  if (!activation) {
    throw new Error(
      `Release-root promotion activation manifest missing: ${layout.activationManifestFile}`
    );
  }

  return {
    layout,
    activation
  };
}
