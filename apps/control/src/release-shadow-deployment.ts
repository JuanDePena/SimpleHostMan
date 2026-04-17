import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import type { CombinedControlReleaseShadowPromotionHistory, CombinedControlReleaseShadowPromotionManifest } from "./release-shadow-promotion.js";
import {
  createCombinedControlReleaseShadowLayout,
  type CombinedControlReleaseShadowLayout
} from "./release-shadow-layout.js";

export interface CombinedControlReleaseShadowDeployManifest {
  readonly kind: "combined-release-shadow-deploy";
  readonly sandboxId: string;
  readonly emulatedReleaseRoot: "/opt/simplehostman/release";
  readonly shadowReleaseRoot: string;
  readonly targetService: "control";
  readonly activeVersion: string;
  readonly promotedVersion: string;
  readonly previousVersion: string | null;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-shadow";
  readonly currentRoot: string;
  readonly currentEntrypoint: string;
  readonly shadowManifestFile: string;
  readonly startupManifestFile: string;
  readonly promotionManifestFile: string;
  readonly origin: string;
  readonly surfaces: readonly string[];
}

export interface CombinedControlReleaseShadowRollbackManifest {
  readonly kind: "combined-release-shadow-rollback";
  readonly sandboxId: string;
  readonly emulatedReleaseRoot: "/opt/simplehostman/release";
  readonly shadowReleaseRoot: string;
  readonly targetService: "control";
  readonly rollbackVersion: string | null;
  readonly currentVersion: string;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-shadow";
  readonly currentRoot: string;
  readonly currentEntrypoint: string;
  readonly promotionManifestFile: string;
  readonly reason: string;
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function readCombinedControlReleaseShadowDeployManifest(args: {
  workspaceRoot?: string;
  sandboxId?: string;
} = {}): Promise<CombinedControlReleaseShadowDeployManifest | null> {
  const layout = createCombinedControlReleaseShadowLayout(args);
  return safeReadJson<CombinedControlReleaseShadowDeployManifest>(layout.deployManifestFile);
}

export async function readCombinedControlReleaseShadowRollbackManifest(args: {
  workspaceRoot?: string;
  sandboxId?: string;
} = {}): Promise<CombinedControlReleaseShadowRollbackManifest | null> {
  const layout = createCombinedControlReleaseShadowLayout(args);
  return safeReadJson<CombinedControlReleaseShadowRollbackManifest>(
    layout.rollbackManifestFile
  );
}

export function formatCombinedControlReleaseShadowDeployManifest(
  manifest: CombinedControlReleaseShadowDeployManifest
): string {
  return [
    "Combined control release-shadow deploy manifest",
    `Sandbox: ${manifest.sandboxId}`,
    `Emulated release root: ${manifest.emulatedReleaseRoot}`,
    `Shadow release root: ${manifest.shadowReleaseRoot}`,
    `Target service: ${manifest.targetService}`,
    `Active version: ${manifest.activeVersion}`,
    `Promoted version: ${manifest.promotedVersion}`,
    `Previous version: ${manifest.previousVersion ?? "none"}`,
    `Generated: ${manifest.generatedAt}`,
    `Current root: ${manifest.currentRoot}`,
    `Current entrypoint: ${manifest.currentEntrypoint}`,
    `Origin: ${manifest.origin}`,
    `Surfaces: ${manifest.surfaces.join(", ")}`
  ].join("\n");
}

export function formatCombinedControlReleaseShadowRollbackManifest(
  manifest: CombinedControlReleaseShadowRollbackManifest
): string {
  return [
    "Combined control release-shadow rollback manifest",
    `Sandbox: ${manifest.sandboxId}`,
    `Emulated release root: ${manifest.emulatedReleaseRoot}`,
    `Shadow release root: ${manifest.shadowReleaseRoot}`,
    `Target service: ${manifest.targetService}`,
    `Current version: ${manifest.currentVersion}`,
    `Rollback version: ${manifest.rollbackVersion ?? "none"}`,
    `Generated: ${manifest.generatedAt}`,
    `Current root: ${manifest.currentRoot}`,
    `Current entrypoint: ${manifest.currentEntrypoint}`,
    `Reason: ${manifest.reason}`
  ].join("\n");
}

export async function materializeCombinedControlReleaseShadowDeployment(args: {
  layout: CombinedControlReleaseShadowLayout;
  promotion: CombinedControlReleaseShadowPromotionManifest;
  history: CombinedControlReleaseShadowPromotionHistory;
}): Promise<{
  deployManifest: CombinedControlReleaseShadowDeployManifest;
  rollbackManifest: CombinedControlReleaseShadowRollbackManifest;
}> {
  const rollbackVersion = args.promotion.previousPromotedVersion;
  const deployManifest: CombinedControlReleaseShadowDeployManifest = {
    kind: "combined-release-shadow-deploy",
    sandboxId: args.layout.sandboxId,
    emulatedReleaseRoot: "/opt/simplehostman/release",
    shadowReleaseRoot: args.layout.releaseRoot,
    targetService: "control",
    activeVersion: args.promotion.activeVersion,
    promotedVersion: args.promotion.promotedVersion,
    previousVersion: args.promotion.previousPromotedVersion,
    generatedAt: new Date().toISOString(),
    strategy: "workspace-release-shadow",
    currentRoot: args.promotion.currentRoot,
    currentEntrypoint: args.promotion.currentEntrypoint,
    shadowManifestFile: args.promotion.shadowManifestFile,
    startupManifestFile: args.promotion.startupManifestFile,
    promotionManifestFile: args.layout.promotionManifestFile,
    origin: args.promotion.origin,
    surfaces: args.promotion.surfaces
  };
  const rollbackManifest: CombinedControlReleaseShadowRollbackManifest = {
    kind: "combined-release-shadow-rollback",
    sandboxId: args.layout.sandboxId,
    emulatedReleaseRoot: "/opt/simplehostman/release",
    shadowReleaseRoot: args.layout.releaseRoot,
    targetService: "control",
    rollbackVersion,
    currentVersion: args.promotion.promotedVersion,
    generatedAt: deployManifest.generatedAt,
    strategy: "workspace-release-shadow",
    currentRoot: args.promotion.currentRoot,
    currentEntrypoint: args.promotion.currentEntrypoint,
    promotionManifestFile: args.layout.promotionManifestFile,
    reason:
      rollbackVersion !== null
        ? `rollback available via prior promoted version ${rollbackVersion}`
        : "no previous promoted version recorded"
  };

  await mkdir(args.layout.sharedMetaDir, { recursive: true });
  await writeFile(
    args.layout.deployManifestFile,
    JSON.stringify(deployManifest, null, 2).concat("\n")
  );
  await writeFile(
    args.layout.deploySummaryFile,
    formatCombinedControlReleaseShadowDeployManifest(deployManifest).concat("\n")
  );
  await writeFile(
    args.layout.rollbackManifestFile,
    JSON.stringify(rollbackManifest, null, 2).concat("\n")
  );
  await writeFile(
    args.layout.rollbackSummaryFile,
    formatCombinedControlReleaseShadowRollbackManifest(rollbackManifest).concat("\n")
  );

  return {
    deployManifest,
    rollbackManifest
  };
}
