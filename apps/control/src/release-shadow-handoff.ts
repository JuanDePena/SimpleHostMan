import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import type {
  CombinedControlReleaseShadowDeployManifest,
  CombinedControlReleaseShadowRollbackManifest
} from "./release-shadow-deployment.js";
import {
  createCombinedControlReleaseShadowLayout,
  type CombinedControlReleaseShadowLayout
} from "./release-shadow-layout.js";
import type { CombinedControlReleaseShadowManifest } from "./release-shadow-manifest.js";
import type { CombinedControlReleaseShadowPromotionManifest } from "./release-shadow-promotion.js";

export interface CombinedControlReleaseShadowHandoffStep {
  readonly kind:
    | "ensure-dir"
    | "copy-tree"
    | "copy-file"
    | "write-symlink";
  readonly target: string;
  readonly source?: string;
  readonly detail: string;
}

export interface CombinedControlReleaseShadowHandoffManifest {
  readonly kind: "combined-release-shadow-handoff";
  readonly sandboxId: string;
  readonly version: string;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-shadow-handoff";
  readonly emulatedReleaseRoot: "/opt/simplehostman/release";
  readonly shadowReleaseRoot: string;
  readonly sourceCommitish: string;
  readonly promotedVersion: string;
  readonly previousVersion: string | null;
  readonly targetReleaseRoot: "/opt/simplehostman/release";
  readonly targetReleasesRoot: string;
  readonly targetReleaseVersionRoot: string;
  readonly targetCurrentRoot: string;
  readonly targetSharedRoot: string;
  readonly targetSharedMetaDir: string;
  readonly targetSharedTmpDir: string;
  readonly targetSharedLogsDir: string;
  readonly targetSharedRunDir: string;
  readonly sourceReleaseVersionRoot: string;
  readonly sourceCurrentRoot: string;
  readonly sourcePromotionManifestFile: string;
  readonly sourceDeployManifestFile: string;
  readonly sourceRollbackManifestFile: string;
  readonly sourceHandoffManifestFile: string;
  readonly startupManifestFile: string;
  readonly startupSummaryFile: string;
  readonly releaseEntrypoint: string;
  readonly envFile: string;
  readonly surfaces: readonly string[];
  readonly steps: readonly CombinedControlReleaseShadowHandoffStep[];
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function readCombinedControlReleaseShadowHandoffManifest(args: {
  workspaceRoot?: string;
  sandboxId?: string;
} = {}): Promise<CombinedControlReleaseShadowHandoffManifest | null> {
  const layout = createCombinedControlReleaseShadowLayout(args);
  return safeReadJson<CombinedControlReleaseShadowHandoffManifest>(layout.handoffManifestFile);
}

export function formatCombinedControlReleaseShadowHandoffManifest(
  manifest: CombinedControlReleaseShadowHandoffManifest
): string {
  return [
    "Combined control release-shadow handoff manifest",
    `Sandbox: ${manifest.sandboxId}`,
    `Version: ${manifest.version}`,
    `Generated: ${manifest.generatedAt}`,
    `Target release root: ${manifest.targetReleaseRoot}`,
    `Target release version root: ${manifest.targetReleaseVersionRoot}`,
    `Target current root: ${manifest.targetCurrentRoot}`,
    `Promoted version: ${manifest.promotedVersion}`,
    `Previous version: ${manifest.previousVersion ?? "none"}`,
    `Source commitish: ${manifest.sourceCommitish}`,
    `Release entrypoint: ${manifest.releaseEntrypoint}`,
    `Env file: ${manifest.envFile}`,
    `Surfaces: ${manifest.surfaces.join(", ")}`,
    "",
    "Planned steps:",
    ...manifest.steps.map((step, index) =>
      `${index + 1}. ${step.kind} ${step.target}${step.source ? ` <= ${step.source}` : ""} :: ${step.detail}`
    )
  ].join("\n");
}

export async function materializeCombinedControlReleaseShadowHandoff(args: {
  layout: CombinedControlReleaseShadowLayout;
  manifest: CombinedControlReleaseShadowManifest;
  promotion: CombinedControlReleaseShadowPromotionManifest;
  deployManifest: CombinedControlReleaseShadowDeployManifest;
  rollbackManifest: CombinedControlReleaseShadowRollbackManifest;
}): Promise<CombinedControlReleaseShadowHandoffManifest> {
  const targetReleaseRoot = "/opt/simplehostman/release" as const;
  const targetReleasesRoot = `${targetReleaseRoot}/releases`;
  const targetReleaseVersionRoot = `${targetReleasesRoot}/${args.layout.version}`;
  const targetCurrentRoot = `${targetReleaseRoot}/current`;
  const targetSharedRoot = `${targetReleaseRoot}/shared`;
  const targetSharedMetaDir = `${targetSharedRoot}/meta`;
  const targetSharedTmpDir = `${targetSharedRoot}/tmp`;
  const targetSharedLogsDir = `${targetSharedRoot}/logs`;
  const targetSharedRunDir = `${targetSharedRoot}/run`;

  const steps: CombinedControlReleaseShadowHandoffStep[] = [
    {
      kind: "ensure-dir",
      target: targetReleaseRoot,
      detail: "ensure the canonical release root exists"
    },
    {
      kind: "ensure-dir",
      target: targetReleasesRoot,
      detail: "ensure the versioned releases directory exists"
    },
    {
      kind: "ensure-dir",
      target: targetSharedMetaDir,
      detail: "ensure shared/meta exists for release metadata"
    },
    {
      kind: "ensure-dir",
      target: targetSharedTmpDir,
      detail: "ensure shared/tmp exists for writable temporary state"
    },
    {
      kind: "ensure-dir",
      target: targetSharedLogsDir,
      detail: "ensure shared/logs exists for runtime logs"
    },
    {
      kind: "ensure-dir",
      target: targetSharedRunDir,
      detail: "ensure shared/run exists for pid and socket state"
    },
    {
      kind: "copy-tree",
      target: targetReleaseVersionRoot,
      source: args.layout.releaseVersionRoot,
      detail: "materialize the promoted release version from the release-shadow"
    },
    {
      kind: "copy-file",
      target: `${targetSharedMetaDir}/promotion.json`,
      source: args.layout.promotionManifestFile,
      detail: "carry over the promoted release metadata"
    },
    {
      kind: "copy-file",
      target: `${targetSharedMetaDir}/deploy.json`,
      source: args.layout.deployManifestFile,
      detail: "carry over the deploy manifest for the promoted release"
    },
    {
      kind: "copy-file",
      target: `${targetSharedMetaDir}/rollback.json`,
      source: args.layout.rollbackManifestFile,
      detail: "carry over the rollback manifest for the promoted release"
    },
    {
      kind: "copy-file",
      target: `${targetSharedMetaDir}/handoff.json`,
      source: args.layout.handoffManifestFile,
      detail: "persist the dry-run handoff plan alongside promotion metadata"
    },
    {
      kind: "write-symlink",
      target: targetCurrentRoot,
      source: targetReleaseVersionRoot,
      detail: "point current at the promoted release version"
    }
  ];

  const handoffManifest: CombinedControlReleaseShadowHandoffManifest = {
    kind: "combined-release-shadow-handoff",
    sandboxId: args.layout.sandboxId,
    version: args.layout.version,
    generatedAt: new Date().toISOString(),
    strategy: "workspace-release-shadow-handoff",
    emulatedReleaseRoot: "/opt/simplehostman/release",
    shadowReleaseRoot: args.layout.releaseRoot,
    sourceCommitish: args.manifest.sourceCommitish,
    promotedVersion: args.promotion.promotedVersion,
    previousVersion: args.promotion.previousPromotedVersion,
    targetReleaseRoot,
    targetReleasesRoot,
    targetReleaseVersionRoot,
    targetCurrentRoot,
    targetSharedRoot,
    targetSharedMetaDir,
    targetSharedTmpDir,
    targetSharedLogsDir,
    targetSharedRunDir,
    sourceReleaseVersionRoot: args.layout.releaseVersionRoot,
    sourceCurrentRoot: args.layout.currentRoot,
    sourcePromotionManifestFile: args.deployManifest.promotionManifestFile,
    sourceDeployManifestFile: args.layout.deployManifestFile,
    sourceRollbackManifestFile: args.layout.rollbackManifestFile,
    sourceHandoffManifestFile: args.layout.handoffManifestFile,
    startupManifestFile: args.manifest.startupManifestFile,
    startupSummaryFile: args.manifest.startupSummaryFile,
    releaseEntrypoint: args.manifest.currentEntrypoint,
    envFile: args.manifest.envFile,
    surfaces: args.manifest.surfaces,
    steps
  };

  void args.rollbackManifest;

  await mkdir(args.layout.sharedMetaDir, { recursive: true });
  await writeFile(
    args.layout.handoffManifestFile,
    JSON.stringify(handoffManifest, null, 2).concat("\n")
  );
  await writeFile(
    args.layout.handoffSummaryFile,
    formatCombinedControlReleaseShadowHandoffManifest(handoffManifest).concat("\n")
  );

  return handoffManifest;
}
