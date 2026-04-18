import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import { createCombinedControlReleaseRootCutoverTargetLayout } from "./release-root-cutover-target-layout.js";
import { applyCombinedControlReleaseRootPromotion } from "./release-root-promotion.js";
import { applyCombinedControlReleaseRootStaging } from "./release-root-staging.js";
import {
  formatCombinedControlReleaseRootCutoverTargetParity,
  runCombinedControlReleaseRootCutoverTargetParity,
  type CombinedControlReleaseRootCutoverTargetParityManifest
} from "./release-root-cutover-target-parity.js";
import {
  formatCombinedControlReleaseRootCutoverTargetReady,
  runCombinedControlReleaseRootCutoverTargetReady,
  type CombinedControlReleaseRootCutoverTargetReadyResult
} from "./release-root-cutover-target-ready.js";
import {
  formatCombinedControlReleaseRootCutoverTargetRehearsal,
  runCombinedControlReleaseRootCutoverTargetRehearsal,
  type CombinedControlReleaseRootCutoverTargetRehearsalManifest
} from "./release-root-cutover-target-rehearsal.js";
import { applyCombinedControlReleaseRootCutoverTarget } from "./release-root-cutover-target.js";
import {
  formatCombinedControlReleaseRootCutoverReady,
  type CombinedControlReleaseRootCutoverReadyResult
} from "./release-root-cutover-ready.js";

export interface CombinedControlReleaseRootCutoverTargetHandoffCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseRootCutoverTargetHandoffManifest {
  readonly kind: "combined-release-root-cutover-target-handoff";
  readonly targetId: string;
  readonly version: string;
  readonly actualReleaseRoot: string;
  readonly previousVersion: string;
  readonly generatedAt: string;
  readonly targetReadyStatus: CombinedControlReleaseRootCutoverTargetReadyResult["status"];
  readonly actualCutoverReadyStatus: CombinedControlReleaseRootCutoverReadyResult["status"];
  readonly rehearsalStatus: CombinedControlReleaseRootCutoverTargetRehearsalManifest["status"];
  readonly parityStatus: CombinedControlReleaseRootCutoverTargetParityManifest["status"];
  readonly status: "PASS" | "FAIL";
  readonly checks: readonly CombinedControlReleaseRootCutoverTargetHandoffCheck[];
}

function createCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseRootCutoverTargetHandoffCheck;
}

export function formatCombinedControlReleaseRootCutoverTargetHandoff(
  manifest: CombinedControlReleaseRootCutoverTargetHandoffManifest
): string {
  const passed = manifest.checks.filter((check) => check.ok).length;
  return [
    "Combined control release-root cutover target handoff",
    `Target: ${manifest.targetId}`,
    `Version: ${manifest.version}`,
    `Actual release root: ${manifest.actualReleaseRoot}`,
    `Previous version: ${manifest.previousVersion}`,
    `Generated: ${manifest.generatedAt}`,
    `Target ready status: ${manifest.targetReadyStatus}`,
    `Actual cutover ready status: ${manifest.actualCutoverReadyStatus}`,
    `Rehearsal status: ${manifest.rehearsalStatus}`,
    `Parity status: ${manifest.parityStatus}`,
    `Status: ${manifest.status} (${passed}/${manifest.checks.length})`,
    "",
    ...manifest.checks.map(
      (check) => `[${check.ok ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`
    )
  ].join("\n");
}

export async function runCombinedControlReleaseRootCutoverTargetHandoff(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
  previousVersion?: string;
  actualReleaseRoot?: string;
} = {}): Promise<{
  handoff: CombinedControlReleaseRootCutoverTargetHandoffManifest;
  targetReady: CombinedControlReleaseRootCutoverTargetReadyResult;
  actualCutoverReady: CombinedControlReleaseRootCutoverReadyResult;
  rehearsal: CombinedControlReleaseRootCutoverTargetRehearsalManifest;
  parity: CombinedControlReleaseRootCutoverTargetParityManifest;
}> {
  const layout = createCombinedControlReleaseRootCutoverTargetLayout(args);
  const previousVersion = args.previousVersion ?? "0.0.8";

  await applyCombinedControlReleaseRootStaging({
    workspaceRoot: layout.workspaceRoot,
    version: layout.version,
    clean: false
  });
  await applyCombinedControlReleaseRootPromotion({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version,
    clean: false
  });
  await applyCombinedControlReleaseRootCutoverTarget({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version,
    clean: false
  });

  const targetReady = await runCombinedControlReleaseRootCutoverTargetReady({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version
  });
  const rehearsalRun = await runCombinedControlReleaseRootCutoverTargetRehearsal({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version,
    previousVersion
  });
  const parityRun = await runCombinedControlReleaseRootCutoverTargetParity({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version,
    previousVersion,
    actualReleaseRoot: args.actualReleaseRoot
  });

  const checks: CombinedControlReleaseRootCutoverTargetHandoffCheck[] = [
    createCheck(
      "target-ready",
      targetReady.status === "PASS",
      `target ready status is ${targetReady.status}`
    ),
    createCheck(
      "actual-cutover-ready",
      parityRun.ready.status === "PASS",
      `actual cutover ready status is ${parityRun.ready.status}`
    ),
    createCheck(
      "rehearsal",
      rehearsalRun.rehearsal.status === "PASS",
      `rehearsal status is ${rehearsalRun.rehearsal.status}`
    ),
    createCheck(
      "parity",
      parityRun.parity.status === "PASS",
      `parity status is ${parityRun.parity.status}`
    ),
    createCheck(
      "version-alignment",
      targetReady.version === layout.version &&
        parityRun.ready.version === layout.version &&
        rehearsalRun.rehearsal.version === layout.version &&
        parityRun.parity.version === layout.version,
      `all handoff artifacts target version ${layout.version}`
    ),
    createCheck(
      "previous-version-alignment",
      rehearsalRun.rollbackManifest.rollbackVersion === previousVersion &&
        parityRun.parity.previousVersion === previousVersion,
      `rollback version is ${rehearsalRun.rollbackManifest.rollbackVersion ?? "none"} and parity previous version is ${parityRun.parity.previousVersion}`
    ),
    createCheck(
      "actual-release-root-contract",
      parityRun.parity.actualReleaseRoot.endsWith("/opt/simplehostman/release"),
      `actual release root is ${parityRun.parity.actualReleaseRoot}`
    ),
    createCheck(
      "summary-artifacts",
      [
        layout.cutoverReadySummaryFile,
        layout.cutoverRehearsalSummaryFile,
        layout.cutoverParitySummaryFile
      ].every((filePath) => existsSync(filePath)),
      "ready, rehearsal, and parity summaries exist under shared/meta"
    )
  ];

  const handoff: CombinedControlReleaseRootCutoverTargetHandoffManifest = {
    kind: "combined-release-root-cutover-target-handoff",
    targetId: layout.targetId,
    version: layout.version,
    actualReleaseRoot: parityRun.parity.actualReleaseRoot,
    previousVersion,
    generatedAt: new Date().toISOString(),
    targetReadyStatus: targetReady.status,
    actualCutoverReadyStatus: parityRun.ready.status,
    rehearsalStatus: rehearsalRun.rehearsal.status,
    parityStatus: parityRun.parity.status,
    status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
    checks
  };

  await mkdir(layout.sharedMetaDir, { recursive: true });
  await writeFile(
    layout.cutoverHandoffManifestFile,
    JSON.stringify(handoff, null, 2).concat("\n")
  );
  await writeFile(
    layout.cutoverHandoffSummaryFile,
    [
      formatCombinedControlReleaseRootCutoverTargetReady(targetReady),
      "",
      formatCombinedControlReleaseRootCutoverReady(parityRun.ready),
      "",
      formatCombinedControlReleaseRootCutoverTargetRehearsal(rehearsalRun.rehearsal),
      "",
      formatCombinedControlReleaseRootCutoverTargetParity(parityRun.parity),
      "",
      formatCombinedControlReleaseRootCutoverTargetHandoff(handoff)
    ].join("\n").concat("\n")
  );

  return {
    handoff,
    targetReady,
    actualCutoverReady: parityRun.ready,
    rehearsal: rehearsalRun.rehearsal,
    parity: parityRun.parity
  };
}
