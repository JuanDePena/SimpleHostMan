import { cp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { dirname } from "node:path";

import type {
  CombinedControlReleaseShadowHandoffManifest,
  CombinedControlReleaseShadowHandoffStep
} from "./release-shadow-handoff.js";
import { readCombinedControlReleaseShadowHandoffManifest } from "./release-shadow-handoff.js";
import { packCombinedControlReleaseShadow } from "./release-shadow-pack.js";
import {
  createCombinedControlReleaseRootStagingLayout,
  type CombinedControlReleaseRootStagingLayout
} from "./release-root-staging-layout.js";

export interface CombinedControlReleaseRootStagingPlannedStep {
  readonly kind: CombinedControlReleaseShadowHandoffStep["kind"];
  readonly source?: string;
  readonly target: string;
  readonly detail: string;
}

export interface CombinedControlReleaseRootStagingPlanManifest {
  readonly kind: "combined-release-root-staging-plan";
  readonly version: string;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-root-staging-plan";
  readonly actualReleaseRoot: string;
  readonly actualCurrentRoot: string;
  readonly stagingRoot: string;
  readonly stagingCurrentRoot: string;
  readonly stagingReleaseVersionRoot: string;
  readonly sourceReleaseVersionRoot: string;
  readonly sourceEnvFile: string;
  readonly sourceStartupManifestFile: string;
  readonly sourcePromotionManifestFile: string;
  readonly sourceDeployManifestFile: string;
  readonly sourceRollbackManifestFile: string;
  readonly sourceHandoffManifestFile: string;
  readonly steps: readonly CombinedControlReleaseRootStagingPlannedStep[];
}

export interface CombinedControlReleaseRootStagingApplyRecord {
  readonly kind: CombinedControlReleaseShadowHandoffStep["kind"];
  readonly source?: string;
  readonly target: string;
  readonly detail: string;
}

export interface CombinedControlReleaseRootStagingApplyManifest {
  readonly kind: "combined-release-root-staging-apply";
  readonly version: string;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-root-staging-apply";
  readonly actualReleaseRoot: string;
  readonly stagingRoot: string;
  readonly stagingCurrentRoot: string;
  readonly stagingReleaseVersionRoot: string;
  readonly sourceHandoffManifestFile: string;
  readonly records: readonly CombinedControlReleaseRootStagingApplyRecord[];
}

export interface CombinedControlReleaseRootStagingDiffCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseRootStagingDiffManifest {
  readonly kind: "combined-release-root-staging-diff";
  readonly version: string;
  readonly generatedAt: string;
  readonly strategy: "workspace-release-root-staging-diff";
  readonly actualReleaseRoot: string;
  readonly actualCurrentRoot: string;
  readonly stagingRoot: string;
  readonly status: "PASS" | "FAIL";
  readonly checks: readonly CombinedControlReleaseRootStagingDiffCheck[];
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function mapTargetPath(
  handoffManifest: CombinedControlReleaseShadowHandoffManifest,
  layout: CombinedControlReleaseRootStagingLayout,
  target: string
): string {
  if (!target.startsWith(handoffManifest.targetReleaseRoot)) {
    throw new Error(`Unsupported handoff target outside release root: ${target}`);
  }
  return target.replace(handoffManifest.targetReleaseRoot, layout.stagingRoot);
}

function mapSourcePath(
  handoffManifest: CombinedControlReleaseShadowHandoffManifest,
  sourceReleaseRoot: string,
  source: string
): string {
  if (!source.startsWith(handoffManifest.targetReleaseRoot)) {
    return source;
  }
  return source.replace(handoffManifest.targetReleaseRoot, sourceReleaseRoot);
}

function createDiffCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseRootStagingDiffCheck;
}

async function removePathIfExists(path: string) {
  if (!existsSync(path)) {
    return;
  }
  const stat = lstatSync(path);
  await rm(path, { recursive: stat.isDirectory(), force: true });
}

async function materializeStagingPlan(args: {
  workspaceRoot?: string;
  version?: string;
  host?: string;
  port?: number;
} = {}): Promise<{
  layout: CombinedControlReleaseRootStagingLayout;
  handoffManifest: CombinedControlReleaseShadowHandoffManifest;
  planManifest: CombinedControlReleaseRootStagingPlanManifest;
  sourceReleaseRoot: string;
}> {
  const packedShadow = await packCombinedControlReleaseShadow({
    workspaceRoot: args.workspaceRoot,
    version: args.version,
    host: args.host,
    port: args.port,
    clean: false
  });
  const handoffManifest =
    (await readCombinedControlReleaseShadowHandoffManifest({
      workspaceRoot: packedShadow.layout.workspaceRoot,
      sandboxId: packedShadow.layout.sandboxId
    })) ??
    (() => {
      throw new Error("Release-shadow handoff manifest missing");
    })();
  const layout = createCombinedControlReleaseRootStagingLayout({
    workspaceRoot: packedShadow.layout.workspaceRoot,
    version: packedShadow.layout.version
  });
  const steps = handoffManifest.steps.map((step) => ({
    kind: step.kind,
    source: step.source
      ? step.kind === "write-symlink"
        ? mapTargetPath(handoffManifest, layout, step.source)
        : mapSourcePath(handoffManifest, packedShadow.layout.releaseRoot, step.source)
      : undefined,
    target: mapTargetPath(handoffManifest, layout, step.target),
    detail: step.detail
  }));
  const planManifest: CombinedControlReleaseRootStagingPlanManifest = {
    kind: "combined-release-root-staging-plan",
    version: layout.version,
    generatedAt: new Date().toISOString(),
    strategy: "workspace-release-root-staging-plan",
    actualReleaseRoot: layout.actualReleaseRoot,
    actualCurrentRoot: layout.actualCurrentRoot,
    stagingRoot: layout.stagingRoot,
    stagingCurrentRoot: layout.currentRoot,
    stagingReleaseVersionRoot: layout.releaseVersionRoot,
    sourceReleaseVersionRoot: packedShadow.layout.releaseVersionRoot,
    sourceEnvFile: packedShadow.layout.envFile,
    sourceStartupManifestFile: packedShadow.layout.startupManifestFile,
    sourcePromotionManifestFile: packedShadow.layout.promotionManifestFile,
    sourceDeployManifestFile: packedShadow.layout.deployManifestFile,
    sourceRollbackManifestFile: packedShadow.layout.rollbackManifestFile,
    sourceHandoffManifestFile: packedShadow.layout.handoffManifestFile,
    steps
  };
  return {
    layout,
    handoffManifest,
    planManifest,
    sourceReleaseRoot: packedShadow.layout.releaseRoot
  };
}

export async function planCombinedControlReleaseRootStaging(args: {
  workspaceRoot?: string;
  version?: string;
  host?: string;
  port?: number;
} = {}) {
  return materializeStagingPlan(args);
}

export function formatCombinedControlReleaseRootStagingPlan(
  manifest: CombinedControlReleaseRootStagingPlanManifest
): string {
  return [
    "Combined control release-root staging plan",
    `Version: ${manifest.version}`,
    `Generated: ${manifest.generatedAt}`,
    `Actual release root: ${manifest.actualReleaseRoot}`,
    `Actual current root: ${manifest.actualCurrentRoot}`,
    `Staging root: ${manifest.stagingRoot}`,
    `Staging current root: ${manifest.stagingCurrentRoot}`,
    `Staging release version root: ${manifest.stagingReleaseVersionRoot}`,
    `Source release version root: ${manifest.sourceReleaseVersionRoot}`,
    `Source env file: ${manifest.sourceEnvFile}`,
    `Source startup manifest: ${manifest.sourceStartupManifestFile}`,
    `Source promotion manifest: ${manifest.sourcePromotionManifestFile}`,
    `Source deploy manifest: ${manifest.sourceDeployManifestFile}`,
    `Source rollback manifest: ${manifest.sourceRollbackManifestFile}`,
    "",
    "Planned steps:",
    ...manifest.steps.map((step, index) =>
      `${index + 1}. ${step.kind} ${step.target}${step.source ? ` <= ${step.source}` : ""} :: ${step.detail}`
    )
  ].join("\n");
}

export async function applyCombinedControlReleaseRootStaging(args: {
  workspaceRoot?: string;
  version?: string;
  host?: string;
  port?: number;
  clean?: boolean;
} = {}): Promise<{
  layout: CombinedControlReleaseRootStagingLayout;
  handoffManifest: CombinedControlReleaseShadowHandoffManifest;
  planManifest: CombinedControlReleaseRootStagingPlanManifest;
  applyManifest: CombinedControlReleaseRootStagingApplyManifest;
}> {
  const planned = await materializeStagingPlan(args);

  if (args.clean !== false) {
    await rm(planned.layout.stagingRoot, { recursive: true, force: true });
  }

  const records: CombinedControlReleaseRootStagingApplyRecord[] = [];
  for (const step of planned.planManifest.steps) {
    switch (step.kind) {
      case "ensure-dir":
        await mkdir(step.target, { recursive: true });
        break;
      case "copy-tree":
        if (!step.source) {
          throw new Error(`copy-tree step missing source for ${step.target}`);
        }
        await removePathIfExists(step.target);
        await mkdir(dirname(step.target), { recursive: true });
        await cp(step.source, step.target, { recursive: true });
        break;
      case "copy-file":
        if (!step.source) {
          throw new Error(`copy-file step missing source for ${step.target}`);
        }
        await mkdir(dirname(step.target), { recursive: true });
        await cp(step.source, step.target);
        break;
      case "write-symlink":
        if (!step.source) {
          throw new Error(`write-symlink step missing source for ${step.target}`);
        }
        await removePathIfExists(step.target);
        await symlink(step.source, step.target);
        break;
      default:
        throw new Error(`Unsupported staging step kind: ${(step as { kind: string }).kind}`);
    }

    records.push({
      kind: step.kind,
      source: step.source,
      target: step.target,
      detail: step.detail
    });
  }

  const applyManifest: CombinedControlReleaseRootStagingApplyManifest = {
    kind: "combined-release-root-staging-apply",
    version: planned.layout.version,
    generatedAt: new Date().toISOString(),
    strategy: "workspace-release-root-staging-apply",
    actualReleaseRoot: planned.layout.actualReleaseRoot,
    stagingRoot: planned.layout.stagingRoot,
    stagingCurrentRoot: planned.layout.currentRoot,
    stagingReleaseVersionRoot: planned.layout.releaseVersionRoot,
    sourceHandoffManifestFile: planned.planManifest.sourceHandoffManifestFile,
    records
  };

  await mkdir(planned.layout.sharedMetaDir, { recursive: true });
  await writeFile(
    planned.layout.planManifestFile,
    JSON.stringify(planned.planManifest, null, 2).concat("\n")
  );
  await writeFile(
    planned.layout.planSummaryFile,
    formatCombinedControlReleaseRootStagingPlan(planned.planManifest).concat("\n")
  );
  await writeFile(
    planned.layout.applyManifestFile,
    JSON.stringify(applyManifest, null, 2).concat("\n")
  );
  await writeFile(
    planned.layout.applySummaryFile,
    formatCombinedControlReleaseRootStagingApply(applyManifest).concat("\n")
  );

  return {
    layout: planned.layout,
    handoffManifest: planned.handoffManifest,
    planManifest: planned.planManifest,
    applyManifest
  };
}

export function formatCombinedControlReleaseRootStagingApply(
  manifest: CombinedControlReleaseRootStagingApplyManifest
): string {
  return [
    "Combined control release-root staging apply manifest",
    `Version: ${manifest.version}`,
    `Generated: ${manifest.generatedAt}`,
    `Actual release root: ${manifest.actualReleaseRoot}`,
    `Staging root: ${manifest.stagingRoot}`,
    `Staging current root: ${manifest.stagingCurrentRoot}`,
    `Staging release version root: ${manifest.stagingReleaseVersionRoot}`,
    "",
    "Applied records:",
    ...manifest.records.map((record, index) =>
      `${index + 1}. ${record.kind} ${record.target}${record.source ? ` <= ${record.source}` : ""} :: ${record.detail}`
    )
  ].join("\n");
}

export async function readCombinedControlReleaseRootStagingPlanManifest(args: {
  workspaceRoot?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseRootStagingPlanManifest | null> {
  const layout = createCombinedControlReleaseRootStagingLayout(args);
  try {
    return readJsonFile<CombinedControlReleaseRootStagingPlanManifest>(layout.planManifestFile);
  } catch {
    return null;
  }
}

export async function readCombinedControlReleaseRootStagingApplyManifest(args: {
  workspaceRoot?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseRootStagingApplyManifest | null> {
  const layout = createCombinedControlReleaseRootStagingLayout(args);
  try {
    return readJsonFile<CombinedControlReleaseRootStagingApplyManifest>(layout.applyManifestFile);
  } catch {
    return null;
  }
}

export async function diffCombinedControlReleaseRootStaging(args: {
  workspaceRoot?: string;
  version?: string;
  host?: string;
  port?: number;
  persist?: boolean;
} = {}): Promise<{
  layout: CombinedControlReleaseRootStagingLayout;
  planManifest: CombinedControlReleaseRootStagingPlanManifest;
  diffManifest: CombinedControlReleaseRootStagingDiffManifest;
}> {
  const layout = createCombinedControlReleaseRootStagingLayout(args);
  const existingPlan = await readCombinedControlReleaseRootStagingPlanManifest(args);
  const planned = existingPlan
    ? {
        layout,
        planManifest: existingPlan
      }
    : await materializeStagingPlan(args);
  const checks: CombinedControlReleaseRootStagingDiffCheck[] = [
    createDiffCheck(
      "staging-root",
      existsSync(planned.layout.stagingRoot),
      existsSync(planned.layout.stagingRoot)
        ? `staging root exists at ${planned.layout.stagingRoot}`
        : `staging root missing at ${planned.layout.stagingRoot}`
    ),
    createDiffCheck(
      "release-version-root",
      existsSync(planned.layout.releaseVersionRoot),
      existsSync(planned.layout.releaseVersionRoot)
        ? `version root exists at ${planned.layout.releaseVersionRoot}`
        : `version root missing at ${planned.layout.releaseVersionRoot}`
    ),
    createDiffCheck(
      "release-entrypoint",
      existsSync(planned.layout.releaseEntrypoint),
      existsSync(planned.layout.releaseEntrypoint)
        ? `entrypoint exists at ${planned.layout.releaseEntrypoint}`
        : `entrypoint missing at ${planned.layout.releaseEntrypoint}`
    ),
    createDiffCheck(
      "staging-current-symlink",
      existsSync(planned.layout.currentRoot) &&
        existsSync(planned.layout.releaseVersionRoot) &&
        lstatSync(planned.layout.currentRoot).isSymbolicLink() &&
        realpathSync(planned.layout.currentRoot) === realpathSync(planned.layout.releaseVersionRoot),
      existsSync(planned.layout.currentRoot)
        ? `current -> ${existsSync(planned.layout.currentRoot) ? readlinkSyncSafe(planned.layout.currentRoot) : "missing"}`
        : "current symlink missing"
    ),
    createDiffCheck(
      "actual-current-untouched",
      !existsSync(planned.layout.actualCurrentRoot) ||
        !realpathOrSelf(planned.layout.actualCurrentRoot).startsWith(planned.layout.stagingRoot),
      existsSync(planned.layout.actualCurrentRoot)
        ? `actual current remains outside staging: ${realpathOrSelf(planned.layout.actualCurrentRoot)}`
        : "actual current root is absent"
    ),
    createDiffCheck(
      "env-parity",
      compareFiles(planned.layout.envFile, planned.planManifest.sourceEnvFile),
      `target=${planned.layout.envFile} source=${planned.planManifest.sourceEnvFile}`
    ),
    createDiffCheck(
      "startup-manifest-parity",
      compareFiles(
        planned.layout.startupManifestFile,
        planned.planManifest.sourceStartupManifestFile
      ),
      `target=${planned.layout.startupManifestFile} source=${planned.planManifest.sourceStartupManifestFile}`
    ),
    createDiffCheck(
      "promotion-manifest-parity",
      compareFiles(
        planned.layout.promotionManifestFile,
        planned.planManifest.sourcePromotionManifestFile
      ),
      `target=${planned.layout.promotionManifestFile} source=${planned.planManifest.sourcePromotionManifestFile}`
    ),
    createDiffCheck(
      "deploy-manifest-parity",
      compareFiles(
        planned.layout.deployManifestFile,
        planned.planManifest.sourceDeployManifestFile
      ),
      `target=${planned.layout.deployManifestFile} source=${planned.planManifest.sourceDeployManifestFile}`
    ),
    createDiffCheck(
      "rollback-manifest-parity",
      compareFiles(
        planned.layout.rollbackManifestFile,
        planned.planManifest.sourceRollbackManifestFile
      ),
      `target=${planned.layout.rollbackManifestFile} source=${planned.planManifest.sourceRollbackManifestFile}`
    ),
    createDiffCheck(
      "handoff-manifest-parity",
      compareFiles(
        planned.layout.handoffManifestFile,
        planned.planManifest.sourceHandoffManifestFile
      ),
      `target=${planned.layout.handoffManifestFile} source=${planned.planManifest.sourceHandoffManifestFile}`
    )
  ];
  const diffManifest: CombinedControlReleaseRootStagingDiffManifest = {
    kind: "combined-release-root-staging-diff",
    version: planned.layout.version,
    generatedAt: new Date().toISOString(),
    strategy: "workspace-release-root-staging-diff",
    actualReleaseRoot: planned.layout.actualReleaseRoot,
    actualCurrentRoot: planned.layout.actualCurrentRoot,
    stagingRoot: planned.layout.stagingRoot,
    status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
    checks
  };

  if (args.persist) {
    await mkdir(planned.layout.sharedMetaDir, { recursive: true });
    await writeFile(
      planned.layout.diffManifestFile,
      JSON.stringify(diffManifest, null, 2).concat("\n")
    );
    await writeFile(
      planned.layout.diffSummaryFile,
      formatCombinedControlReleaseRootStagingDiff(diffManifest).concat("\n")
    );
  }

  return {
    layout: planned.layout,
    planManifest: planned.planManifest,
    diffManifest
  };
}

function compareFiles(target?: string, source?: string): boolean {
  if (!target || !source) {
    return false;
  }
  if (!existsSync(target) || !existsSync(source)) {
    return false;
  }
  return readFileSync(target, "utf8") === readFileSync(source, "utf8");
}

function realpathOrSelf(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function readlinkSyncSafe(path: string): string {
  try {
    return readlinkSync(path);
  } catch {
    return "unreadable";
  }
}

export function formatCombinedControlReleaseRootStagingDiff(
  manifest: CombinedControlReleaseRootStagingDiffManifest
): string {
  const passed = manifest.checks.filter((check) => check.ok).length;
  return [
    "Combined control release-root staging diff",
    `Version: ${manifest.version}`,
    `Generated: ${manifest.generatedAt}`,
    `Actual release root: ${manifest.actualReleaseRoot}`,
    `Actual current root: ${manifest.actualCurrentRoot}`,
    `Staging root: ${manifest.stagingRoot}`,
    `Status: ${manifest.status} (${passed}/${manifest.checks.length})`,
    "",
    ...manifest.checks.map(
      (check) => `[${check.ok ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`
    )
  ].join("\n");
}

export async function readCombinedControlReleaseRootStagingDiffManifest(args: {
  workspaceRoot?: string;
  version?: string;
} = {}): Promise<CombinedControlReleaseRootStagingDiffManifest | null> {
  const layout = createCombinedControlReleaseRootStagingLayout(args);
  try {
    return readJsonFile<CombinedControlReleaseRootStagingDiffManifest>(layout.diffManifestFile);
  } catch {
    return null;
  }
}
