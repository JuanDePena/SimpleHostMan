import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import {
  type CombinedControlReleaseSandboxPromotionHistory,
  type CombinedControlReleaseSandboxPromotionManifest
} from "./release-sandbox-promotion.js";
import {
  createCombinedControlReleaseSandboxLayout,
  type CombinedControlReleaseSandboxLayout
} from "./release-sandbox-layout.js";

export interface CombinedControlReleaseSandboxDeployManifest {
  readonly kind: "combined-release-sandbox-deploy";
  readonly sandboxId: string;
  readonly targetReleaseRoot: "/opt/simplehostman/release";
  readonly targetService: "control";
  readonly activeVersion: string;
  readonly promotedVersion: string;
  readonly previousVersion: string | null;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-sandbox";
  readonly currentRoot: string;
  readonly currentEntrypoint: string;
  readonly bundleManifestFile: string;
  readonly startupManifestFile: string;
  readonly promotionManifestFile: string;
  readonly origin: string;
  readonly surfaces: readonly string[];
}

export interface CombinedControlReleaseSandboxRollbackManifest {
  readonly kind: "combined-release-sandbox-rollback";
  readonly sandboxId: string;
  readonly targetReleaseRoot: "/opt/simplehostman/release";
  readonly targetService: "control";
  readonly rollbackVersion: string | null;
  readonly currentVersion: string;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-sandbox";
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

export async function readCombinedControlReleaseSandboxDeployManifest(args: {
  workspaceRoot?: string;
  sandboxId?: string;
} = {}): Promise<CombinedControlReleaseSandboxDeployManifest | null> {
  const layout = createCombinedControlReleaseSandboxLayout(args);
  return safeReadJson<CombinedControlReleaseSandboxDeployManifest>(
    layout.deployManifestFile
  );
}

export async function readCombinedControlReleaseSandboxRollbackManifest(args: {
  workspaceRoot?: string;
  sandboxId?: string;
} = {}): Promise<CombinedControlReleaseSandboxRollbackManifest | null> {
  const layout = createCombinedControlReleaseSandboxLayout(args);
  return safeReadJson<CombinedControlReleaseSandboxRollbackManifest>(
    layout.rollbackManifestFile
  );
}

export function formatCombinedControlReleaseSandboxDeployManifest(
  manifest: CombinedControlReleaseSandboxDeployManifest
): string {
  return [
    "Combined control release-sandbox deploy manifest",
    `Sandbox: ${manifest.sandboxId}`,
    `Target release root: ${manifest.targetReleaseRoot}`,
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

export function formatCombinedControlReleaseSandboxRollbackManifest(
  manifest: CombinedControlReleaseSandboxRollbackManifest
): string {
  return [
    "Combined control release-sandbox rollback manifest",
    `Sandbox: ${manifest.sandboxId}`,
    `Target release root: ${manifest.targetReleaseRoot}`,
    `Target service: ${manifest.targetService}`,
    `Current version: ${manifest.currentVersion}`,
    `Rollback version: ${manifest.rollbackVersion ?? "none"}`,
    `Generated: ${manifest.generatedAt}`,
    `Current root: ${manifest.currentRoot}`,
    `Current entrypoint: ${manifest.currentEntrypoint}`,
    `Reason: ${manifest.reason}`
  ].join("\n");
}

export async function materializeCombinedControlReleaseSandboxDeployment(args: {
  layout: CombinedControlReleaseSandboxLayout;
  promotion: CombinedControlReleaseSandboxPromotionManifest;
  history: CombinedControlReleaseSandboxPromotionHistory;
}): Promise<{
  deployManifest: CombinedControlReleaseSandboxDeployManifest;
  rollbackManifest: CombinedControlReleaseSandboxRollbackManifest;
}> {
  const rollbackVersion = args.promotion.previousPromotedVersion;
  const deployManifest: CombinedControlReleaseSandboxDeployManifest = {
    kind: "combined-release-sandbox-deploy",
    sandboxId: args.layout.sandboxId,
    targetReleaseRoot: args.promotion.releaseRootTarget,
    targetService: "control",
    activeVersion: args.promotion.activeVersion,
    promotedVersion: args.promotion.promotedVersion,
    previousVersion: args.promotion.previousPromotedVersion,
    generatedAt: new Date().toISOString(),
    strategy: "workspace-release-sandbox",
    currentRoot: args.promotion.currentRoot,
    currentEntrypoint: args.promotion.currentEntrypoint,
    bundleManifestFile: args.promotion.bundleManifestFile,
    startupManifestFile: args.promotion.startupManifestFile,
    promotionManifestFile: args.layout.promotionManifestFile,
    origin: args.promotion.origin,
    surfaces: args.promotion.surfaces
  };
  const rollbackManifest: CombinedControlReleaseSandboxRollbackManifest = {
    kind: "combined-release-sandbox-rollback",
    sandboxId: args.layout.sandboxId,
    targetReleaseRoot: args.promotion.releaseRootTarget,
    targetService: "control",
    rollbackVersion,
    currentVersion: args.promotion.promotedVersion,
    generatedAt: deployManifest.generatedAt,
    strategy: "workspace-release-sandbox",
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
    formatCombinedControlReleaseSandboxDeployManifest(deployManifest).concat("\n")
  );
  await writeFile(
    args.layout.rollbackManifestFile,
    JSON.stringify(rollbackManifest, null, 2).concat("\n")
  );
  await writeFile(
    args.layout.rollbackSummaryFile,
    formatCombinedControlReleaseSandboxRollbackManifest(rollbackManifest).concat("\n")
  );

  return {
    deployManifest,
    rollbackManifest
  };
}
