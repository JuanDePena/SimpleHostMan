import { join } from "node:path";

import {
  readWorkspaceVersion,
  resolveWorkspaceRoot
} from "./release-sandbox-layout.js";

export interface CombinedControlReleaseShadowLayout {
  readonly workspaceRoot: string;
  readonly sandboxId: string;
  readonly version: string;
  readonly shadowRoot: string;
  readonly hostRoot: string;
  readonly releaseRoot: string;
  readonly releasesRoot: string;
  readonly releaseVersionRoot: string;
  readonly currentRoot: string;
  readonly sharedRoot: string;
  readonly sharedMetaDir: string;
  readonly sharedTmpDir: string;
  readonly sharedLogsDir: string;
  readonly sharedRunDir: string;
  readonly logsDir: string;
  readonly runDir: string;
  readonly metaDir: string;
  readonly envFile: string;
  readonly startupManifestFile: string;
  readonly startupSummaryFile: string;
  readonly releaseEntrypoint: string;
  readonly currentEntrypoint: string;
  readonly shadowManifestFile: string;
  readonly shadowSummaryFile: string;
  readonly releasesInventoryFile: string;
  readonly activationManifestFile: string;
  readonly activationSummaryFile: string;
  readonly promotionManifestFile: string;
  readonly promotionSummaryFile: string;
  readonly promotionHistoryFile: string;
  readonly deployManifestFile: string;
  readonly deploySummaryFile: string;
  readonly rollbackManifestFile: string;
  readonly rollbackSummaryFile: string;
}

export function createCombinedControlReleaseShadowLayout(args: {
  workspaceRoot?: string;
  sandboxId?: string;
  version?: string;
} = {}): CombinedControlReleaseShadowLayout {
  const workspaceRoot = args.workspaceRoot ?? resolveWorkspaceRoot();
  const version = args.version ?? readWorkspaceVersion(workspaceRoot);
  const sandboxId = args.sandboxId ?? "default";
  const shadowRoot = join(workspaceRoot, ".tmp", "control-release-shadow", sandboxId);
  const hostRoot = join(shadowRoot, "opt", "simplehostman");
  const releaseRoot = join(hostRoot, "release");
  const releasesRoot = join(releaseRoot, "releases");
  const releaseVersionRoot = join(releasesRoot, version);
  const currentRoot = join(releaseRoot, "current");
  const sharedRoot = join(releaseRoot, "shared");
  const sharedMetaDir = join(sharedRoot, "meta");
  const sharedTmpDir = join(sharedRoot, "tmp");
  const sharedLogsDir = join(sharedRoot, "logs");
  const sharedRunDir = join(sharedRoot, "run");
  const metaDir = join(releaseVersionRoot, "meta");

  return {
    workspaceRoot,
    sandboxId,
    version,
    shadowRoot,
    hostRoot,
    releaseRoot,
    releasesRoot,
    releaseVersionRoot,
    currentRoot,
    sharedRoot,
    sharedMetaDir,
    sharedTmpDir,
    sharedLogsDir,
    sharedRunDir,
    logsDir: join(sharedLogsDir, "control"),
    runDir: join(sharedRunDir, "control"),
    metaDir,
    envFile: join(releaseVersionRoot, "env", "control.env"),
    startupManifestFile: join(metaDir, "startup-manifest.json"),
    startupSummaryFile: join(metaDir, "startup-summary.txt"),
    releaseEntrypoint: join(
      releaseVersionRoot,
      "apps",
      "control",
      "dist",
      "release-sandbox-entrypoint.js"
    ),
    currentEntrypoint: join(
      currentRoot,
      "apps",
      "control",
      "dist",
      "release-sandbox-entrypoint.js"
    ),
    shadowManifestFile: join(metaDir, "release-shadow.json"),
    shadowSummaryFile: join(metaDir, "release-shadow-summary.txt"),
    releasesInventoryFile: join(sharedMetaDir, "releases.json"),
    activationManifestFile: join(sharedMetaDir, "activation.json"),
    activationSummaryFile: join(sharedMetaDir, "activation-summary.txt"),
    promotionManifestFile: join(sharedMetaDir, "promotion.json"),
    promotionSummaryFile: join(sharedMetaDir, "promotion-summary.txt"),
    promotionHistoryFile: join(sharedMetaDir, "promotion-history.json"),
    deployManifestFile: join(sharedMetaDir, "deploy.json"),
    deploySummaryFile: join(sharedMetaDir, "deploy-summary.txt"),
    rollbackManifestFile: join(sharedMetaDir, "rollback.json"),
    rollbackSummaryFile: join(sharedMetaDir, "rollback-summary.txt")
  };
}
