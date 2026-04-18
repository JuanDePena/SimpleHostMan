import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import {
  planCombinedControlReleaseRootCutover,
  formatCombinedControlReleaseRootCutoverPlan
} from "./release-root-cutover.js";
import {
  formatCombinedControlReleaseRootCutoverReady,
  runCombinedControlReleaseRootCutoverReady,
  type CombinedControlReleaseRootCutoverReadyResult
} from "./release-root-cutover-ready.js";
import { applyCombinedControlReleaseRootPromotion } from "./release-root-promotion.js";
import { applyCombinedControlReleaseRootStaging } from "./release-root-staging.js";
import { createCombinedControlReleaseRootCutoverTargetLayout } from "./release-root-cutover-target-layout.js";
import {
  formatCombinedControlReleaseRootCutoverTargetRehearsal,
  runCombinedControlReleaseRootCutoverTargetRehearsal,
  type CombinedControlReleaseRootCutoverTargetRehearsalManifest
} from "./release-root-cutover-target-rehearsal.js";
import { resolveWorkspaceRoot } from "./release-sandbox-layout.js";

export interface CombinedControlReleaseRootCutoverTargetParityCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseRootCutoverTargetParityManifest {
  readonly kind: "combined-release-root-cutover-target-parity";
  readonly targetId: string;
  readonly version: string;
  readonly actualReleaseRoot: string;
  readonly previousVersion: string;
  readonly generatedAt: string;
  readonly cutoverReadyStatus: CombinedControlReleaseRootCutoverReadyResult["status"];
  readonly rehearsalStatus: CombinedControlReleaseRootCutoverTargetRehearsalManifest["status"];
  readonly status: "PASS" | "FAIL";
  readonly checks: readonly CombinedControlReleaseRootCutoverTargetParityCheck[];
}

function createCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseRootCutoverTargetParityCheck;
}

export function formatCombinedControlReleaseRootCutoverTargetParity(
  manifest: CombinedControlReleaseRootCutoverTargetParityManifest
): string {
  const passed = manifest.checks.filter((check) => check.ok).length;
  return [
    "Combined control release-root cutover target parity",
    `Target: ${manifest.targetId}`,
    `Version: ${manifest.version}`,
    `Actual release root: ${manifest.actualReleaseRoot}`,
    `Previous version: ${manifest.previousVersion}`,
    `Generated: ${manifest.generatedAt}`,
    `Cutover ready status: ${manifest.cutoverReadyStatus}`,
    `Rehearsal status: ${manifest.rehearsalStatus}`,
    `Status: ${manifest.status} (${passed}/${manifest.checks.length})`,
    "",
    ...manifest.checks.map(
      (check) => `[${check.ok ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`
    )
  ].join("\n");
}

function createActualReleaseRootFixture(workspaceRoot: string, targetId: string) {
  return join(
    workspaceRoot,
    ".tmp",
    "control-release-root-cutover-parity",
    targetId,
    "opt",
    "simplehostman",
    "release"
  );
}

export async function runCombinedControlReleaseRootCutoverTargetParity(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
  previousVersion?: string;
  actualReleaseRoot?: string;
} = {}): Promise<{
  parity: CombinedControlReleaseRootCutoverTargetParityManifest;
  ready: CombinedControlReleaseRootCutoverReadyResult;
  rehearsal: CombinedControlReleaseRootCutoverTargetRehearsalManifest;
}> {
  const workspaceRoot = args.workspaceRoot ?? resolveWorkspaceRoot();
  const layout = createCombinedControlReleaseRootCutoverTargetLayout({
    workspaceRoot,
    targetId: args.targetId,
    version: args.version
  });
  const previousVersion = args.previousVersion ?? "0.0.8";
  const actualReleaseRoot =
    args.actualReleaseRoot ?? createActualReleaseRootFixture(layout.workspaceRoot, layout.targetId);
  const previousVersionRoot = join(actualReleaseRoot, "releases", previousVersion);
  const actualCurrentRoot = join(actualReleaseRoot, "current");

  await rm(actualReleaseRoot, { recursive: true, force: true });
  await mkdir(previousVersionRoot, { recursive: true });
  await symlink(previousVersionRoot, actualCurrentRoot);

  await applyCombinedControlReleaseRootStaging({
    workspaceRoot: layout.workspaceRoot,
    version: layout.version,
    clean: false
  });
  await applyCombinedControlReleaseRootPromotion({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version,
    clean: true
  });

  const planned = await planCombinedControlReleaseRootCutover({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version,
    actualReleaseRoot,
    persist: true
  });
  const readyRun = await runCombinedControlReleaseRootCutoverReady({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version,
    actualReleaseRoot,
    persist: true
  });
  const rehearsalRun = await runCombinedControlReleaseRootCutoverTargetRehearsal({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version,
    previousVersion
  });

  const writeSymlinkStep = planned.planManifest.steps.find(
    (step) => step.kind === "write-symlink" && step.target === actualCurrentRoot
  );
  const checks: CombinedControlReleaseRootCutoverTargetParityCheck[] = [
    createCheck(
      "actual-current-version",
      planned.planManifest.actualCurrentVersion === previousVersion,
      `actual current version is ${planned.planManifest.actualCurrentVersion ?? "none"}`
    ),
    createCheck(
      "rollback-candidate-version",
      basename(planned.planManifest.rollbackCandidateRoot ?? "") === previousVersion,
      `rollback candidate is ${planned.planManifest.rollbackCandidateRoot ?? "none"}`
    ),
    createCheck(
      "planned-target-version",
      basename(planned.planManifest.targetReleaseVersionRoot) === layout.version,
      `planned target release version root is ${planned.planManifest.targetReleaseVersionRoot}`
    ),
    createCheck(
      "write-symlink-target",
      writeSymlinkStep?.source === planned.planManifest.targetReleaseVersionRoot,
      writeSymlinkStep
        ? `planned current will point to ${writeSymlinkStep.source ?? "none"}`
        : "planned current write-symlink step missing"
    ),
    createCheck(
      "ready",
      readyRun.ready.status === "PASS",
      `cutover ready status is ${readyRun.ready.status}`
    ),
    createCheck(
      "rehearsal",
      rehearsalRun.rehearsal.status === "PASS",
      `rehearsal status is ${rehearsalRun.rehearsal.status}`
    ),
    createCheck(
      "rollback-version",
      rehearsalRun.rollbackManifest.rollbackVersion === previousVersion,
      `rehearsal rollback version is ${rehearsalRun.rollbackManifest.rollbackVersion ?? "none"}`
    ),
    createCheck(
      "rehearsal-ready-status",
      rehearsalRun.rehearsal.readyStatus === "PASS",
      `rehearsal ready status is ${rehearsalRun.rehearsal.readyStatus}`
    )
  ];

  const parity: CombinedControlReleaseRootCutoverTargetParityManifest = {
    kind: "combined-release-root-cutover-target-parity",
    targetId: layout.targetId,
    version: layout.version,
    actualReleaseRoot,
    previousVersion,
    generatedAt: new Date().toISOString(),
    cutoverReadyStatus: readyRun.ready.status,
    rehearsalStatus: rehearsalRun.rehearsal.status,
    status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
    checks
  };

  await mkdir(layout.sharedMetaDir, { recursive: true });
  await writeFile(
    layout.cutoverParityManifestFile,
    JSON.stringify(parity, null, 2).concat("\n")
  );
  await writeFile(
    layout.cutoverParitySummaryFile,
    [
      formatCombinedControlReleaseRootCutoverPlan(planned.planManifest),
      "",
      formatCombinedControlReleaseRootCutoverReady(readyRun.ready),
      "",
      formatCombinedControlReleaseRootCutoverTargetRehearsal(rehearsalRun.rehearsal),
      "",
      formatCombinedControlReleaseRootCutoverTargetParity(parity)
    ].join("\n").concat("\n")
  );

  return {
    parity,
    ready: readyRun.ready,
    rehearsal: rehearsalRun.rehearsal
  };
}
