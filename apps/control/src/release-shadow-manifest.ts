import type { CombinedControlReleaseSandboxBundle } from "./release-sandbox-bundle.js";
import type { CombinedControlReleaseSandboxDeployManifest } from "./release-sandbox-deployment.js";
import type { CombinedControlReleaseShadowLayout } from "./release-shadow-layout.js";
import type { CombinedControlReleaseSandboxPromotionManifest } from "./release-sandbox-promotion.js";
import type { CombinedControlReleaseSandboxRollbackManifest } from "./release-sandbox-deployment.js";

export interface CombinedControlReleaseShadowManifest {
  readonly kind: "combined-control-release-shadow";
  readonly createdAt: string;
  readonly sandboxId: string;
  readonly version: string;
  readonly shadowRoot: string;
  readonly releaseRoot: string;
  readonly currentRoot: string;
  readonly releaseVersionRoot: string;
  readonly releaseEntrypoint: string;
  readonly currentEntrypoint: string;
  readonly envFile: string;
  readonly startupManifestFile: string;
  readonly startupSummaryFile: string;
  readonly sourceCommitish: string;
  readonly sourceSandboxRoot: string;
  readonly sourceReleaseVersionRoot: string;
  readonly sourcePromotionManifestFile: string;
  readonly sourceDeployManifestFile: string;
  readonly sourceRollbackManifestFile: string;
  readonly origin: string;
  readonly listener: string;
  readonly surfaces: readonly string[];
}

export function createCombinedControlReleaseShadowManifest(args: {
  layout: CombinedControlReleaseShadowLayout;
  sandboxBundle: CombinedControlReleaseSandboxBundle;
  promotionManifest: CombinedControlReleaseSandboxPromotionManifest;
  deployManifest: CombinedControlReleaseSandboxDeployManifest;
  rollbackManifest: CombinedControlReleaseSandboxRollbackManifest;
  sourceSandboxRoot: string;
  sourceReleaseVersionRoot: string;
  sourcePromotionManifestFile: string;
  sourceDeployManifestFile: string;
  sourceRollbackManifestFile: string;
}): CombinedControlReleaseShadowManifest {
  return {
    kind: "combined-control-release-shadow",
    createdAt: new Date().toISOString(),
    sandboxId: args.layout.sandboxId,
    version: args.layout.version,
    shadowRoot: args.layout.shadowRoot,
    releaseRoot: args.layout.releaseRoot,
    currentRoot: args.layout.currentRoot,
    releaseVersionRoot: args.layout.releaseVersionRoot,
    releaseEntrypoint: args.layout.releaseEntrypoint,
    currentEntrypoint: args.layout.currentEntrypoint,
    envFile: args.layout.envFile,
    startupManifestFile: args.layout.startupManifestFile,
    startupSummaryFile: args.layout.startupSummaryFile,
    sourceCommitish: args.sandboxBundle.sourceCommitish,
    sourceSandboxRoot: args.sourceSandboxRoot,
    sourceReleaseVersionRoot: args.sourceReleaseVersionRoot,
    sourcePromotionManifestFile: args.sourcePromotionManifestFile,
    sourceDeployManifestFile: args.sourceDeployManifestFile,
    sourceRollbackManifestFile: args.sourceRollbackManifestFile,
    origin: args.sandboxBundle.startup.origin,
    listener: args.sandboxBundle.startup.listener,
    surfaces: args.sandboxBundle.startup.surfaces
  };
}

export function formatCombinedControlReleaseShadowManifest(
  manifest: CombinedControlReleaseShadowManifest
): string {
  return [
    "Combined control release-shadow",
    `Sandbox: ${manifest.sandboxId}`,
    `Version: ${manifest.version}`,
    `Created: ${manifest.createdAt}`,
    `Release root: ${manifest.releaseRoot}`,
    `Current root: ${manifest.currentRoot}`,
    `Release version root: ${manifest.releaseVersionRoot}`,
    `Origin: ${manifest.origin}`,
    `Listener: ${manifest.listener}`,
    `Surfaces: ${manifest.surfaces.join(", ")}`,
    `Release entrypoint: ${manifest.releaseEntrypoint}`,
    `Current entrypoint: ${manifest.currentEntrypoint}`,
    `Env file: ${manifest.envFile}`,
    `Source sandbox root: ${manifest.sourceSandboxRoot}`,
    `Source release version root: ${manifest.sourceReleaseVersionRoot}`,
    `Source promotion manifest: ${manifest.sourcePromotionManifestFile}`,
    `Source deploy manifest: ${manifest.sourceDeployManifestFile}`,
    `Source rollback manifest: ${manifest.sourceRollbackManifestFile}`
  ].join("\n");
}
