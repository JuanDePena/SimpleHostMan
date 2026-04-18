import { join } from "node:path";

import {
  readWorkspaceVersion,
  resolveWorkspaceRoot
} from "./release-sandbox-layout.js";

export interface CombinedControlReleaseRootStagingLayout {
  readonly workspaceRoot: string;
  readonly version: string;
  readonly actualReleaseRoot: string;
  readonly actualCurrentRoot: string;
  readonly stagingRoot: string;
  readonly releasesRoot: string;
  readonly releaseVersionRoot: string;
  readonly currentRoot: string;
  readonly sharedRoot: string;
  readonly sharedMetaDir: string;
  readonly sharedTmpDir: string;
  readonly sharedLogsDir: string;
  readonly sharedRunDir: string;
  readonly envFile: string;
  readonly startupManifestFile: string;
  readonly startupSummaryFile: string;
  readonly releaseEntrypoint: string;
  readonly currentEntrypoint: string;
  readonly planManifestFile: string;
  readonly planSummaryFile: string;
  readonly diffManifestFile: string;
  readonly diffSummaryFile: string;
  readonly applyManifestFile: string;
  readonly applySummaryFile: string;
  readonly handoffManifestFile: string;
  readonly promotionManifestFile: string;
  readonly deployManifestFile: string;
  readonly rollbackManifestFile: string;
}

export function createCombinedControlReleaseRootStagingLayout(args: {
  workspaceRoot?: string;
  version?: string;
} = {}): CombinedControlReleaseRootStagingLayout {
  const workspaceRoot = args.workspaceRoot ?? resolveWorkspaceRoot();
  const version = args.version ?? readWorkspaceVersion(workspaceRoot);
  const actualReleaseRoot = "/opt/simplehostman/release";
  const stagingRoot = join(actualReleaseRoot, ".staging", "control");
  const releasesRoot = join(stagingRoot, "releases");
  const releaseVersionRoot = join(releasesRoot, version);
  const currentRoot = join(stagingRoot, "current");
  const sharedRoot = join(stagingRoot, "shared");
  const sharedMetaDir = join(sharedRoot, "meta");

  return {
    workspaceRoot,
    version,
    actualReleaseRoot,
    actualCurrentRoot: join(actualReleaseRoot, "current"),
    stagingRoot,
    releasesRoot,
    releaseVersionRoot,
    currentRoot,
    sharedRoot,
    sharedMetaDir,
    sharedTmpDir: join(sharedRoot, "tmp"),
    sharedLogsDir: join(sharedRoot, "logs"),
    sharedRunDir: join(sharedRoot, "run"),
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
    planManifestFile: join(sharedMetaDir, "plan.json"),
    planSummaryFile: join(sharedMetaDir, "plan-summary.txt"),
    diffManifestFile: join(sharedMetaDir, "diff.json"),
    diffSummaryFile: join(sharedMetaDir, "diff-summary.txt"),
    applyManifestFile: join(sharedMetaDir, "apply.json"),
    applySummaryFile: join(sharedMetaDir, "apply-summary.txt"),
    handoffManifestFile: join(sharedMetaDir, "handoff.json"),
    promotionManifestFile: join(sharedMetaDir, "promotion.json"),
    deployManifestFile: join(sharedMetaDir, "deploy.json"),
    rollbackManifestFile: join(sharedMetaDir, "rollback.json")
  };
}
