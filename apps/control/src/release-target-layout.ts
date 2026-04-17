import { join } from "node:path";

import { readWorkspaceVersion, resolveWorkspaceRoot } from "./release-sandbox-layout.js";

export interface CombinedControlReleaseTargetLayout {
  readonly workspaceRoot: string;
  readonly sandboxId: string;
  readonly version: string;
  readonly targetRoot: string;
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
  readonly envFile: string;
  readonly startupManifestFile: string;
  readonly startupSummaryFile: string;
  readonly releaseEntrypoint: string;
  readonly currentEntrypoint: string;
  readonly applyManifestFile: string;
  readonly applySummaryFile: string;
  readonly handoffManifestFile: string;
  readonly promotionManifestFile: string;
  readonly deployManifestFile: string;
  readonly rollbackManifestFile: string;
}

export function createCombinedControlReleaseTargetLayout(args: {
  workspaceRoot?: string;
  sandboxId?: string;
  version?: string;
} = {}): CombinedControlReleaseTargetLayout {
  const workspaceRoot = args.workspaceRoot ?? resolveWorkspaceRoot();
  const version = args.version ?? readWorkspaceVersion(workspaceRoot);
  const sandboxId = args.sandboxId ?? "default";
  const targetRoot = join(workspaceRoot, ".tmp", "control-release-target", sandboxId);
  const hostRoot = join(targetRoot, "opt", "simplehostman");
  const releaseRoot = join(hostRoot, "release");
  const releasesRoot = join(releaseRoot, "releases");
  const releaseVersionRoot = join(releasesRoot, version);
  const currentRoot = join(releaseRoot, "current");
  const sharedRoot = join(releaseRoot, "shared");
  const sharedMetaDir = join(sharedRoot, "meta");
  const sharedTmpDir = join(sharedRoot, "tmp");
  const sharedLogsDir = join(sharedRoot, "logs");
  const sharedRunDir = join(sharedRoot, "run");

  return {
    workspaceRoot,
    sandboxId,
    version,
    targetRoot,
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
    envFile: join(releaseVersionRoot, "env", "control.env"),
    startupManifestFile: join(releaseVersionRoot, "meta", "startup-manifest.json"),
    startupSummaryFile: join(releaseVersionRoot, "meta", "startup-summary.txt"),
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
    applyManifestFile: join(sharedMetaDir, "apply.json"),
    applySummaryFile: join(sharedMetaDir, "apply-summary.txt"),
    handoffManifestFile: join(sharedMetaDir, "handoff.json"),
    promotionManifestFile: join(sharedMetaDir, "promotion.json"),
    deployManifestFile: join(sharedMetaDir, "deploy.json"),
    rollbackManifestFile: join(sharedMetaDir, "rollback.json")
  };
}
