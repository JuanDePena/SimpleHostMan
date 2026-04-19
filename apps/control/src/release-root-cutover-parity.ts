import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

import { createCombinedControlReleaseRootCutoverLayout } from "./release-root-cutover-layout.js";
import {
  formatCombinedControlReleaseRootCutoverHandoff,
  runCombinedControlReleaseRootCutoverHandoff,
  type CombinedControlReleaseRootCutoverHandoffManifest
} from "./release-root-cutover-handoff.js";
import {
  formatCombinedControlReleaseRootCutoverRehearsal,
  runCombinedControlReleaseRootCutoverRehearsal,
  type CombinedControlReleaseRootCutoverRehearsalManifest
} from "./release-root-cutover-rehearsal.js";
import {
  formatCombinedControlReleaseRootCutoverTargetParity,
  runCombinedControlReleaseRootCutoverTargetParity,
  type CombinedControlReleaseRootCutoverTargetParityManifest
} from "./release-root-cutover-target-parity.js";
import { createCombinedControlReleaseRootCutoverTargetLayout } from "./release-root-cutover-target-layout.js";

export interface CombinedControlReleaseRootCutoverParityCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseRootCutoverParityManifest {
  readonly kind: "combined-release-root-cutover-parity";
  readonly targetId: string;
  readonly version: string;
  readonly actualReleaseRoot: string;
  readonly rehearsalPreviousVersion: string;
  readonly generatedAt: string;
  readonly actualHandoffStatus: CombinedControlReleaseRootCutoverHandoffManifest["status"];
  readonly actualRehearsalStatus: CombinedControlReleaseRootCutoverRehearsalManifest["status"];
  readonly targetParityStatus: CombinedControlReleaseRootCutoverTargetParityManifest["status"];
  readonly status: "PASS" | "FAIL";
  readonly checks: readonly CombinedControlReleaseRootCutoverParityCheck[];
}

function createCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseRootCutoverParityCheck;
}

export function formatCombinedControlReleaseRootCutoverParity(
  manifest: CombinedControlReleaseRootCutoverParityManifest
): string {
  const passed = manifest.checks.filter((check) => check.ok).length;
  return [
    "Combined control release-root cutover parity",
    `Target: ${manifest.targetId}`,
    `Version: ${manifest.version}`,
    `Actual release root: ${manifest.actualReleaseRoot}`,
    `Rehearsal previous version: ${manifest.rehearsalPreviousVersion}`,
    `Generated: ${manifest.generatedAt}`,
    `Actual handoff status: ${manifest.actualHandoffStatus}`,
    `Actual rehearsal status: ${manifest.actualRehearsalStatus}`,
    `Target parity status: ${manifest.targetParityStatus}`,
    `Status: ${manifest.status} (${passed}/${manifest.checks.length})`,
    "",
    ...manifest.checks.map(
      (check) => `[${check.ok ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`
    )
  ].join("\n");
}

export async function runCombinedControlReleaseRootCutoverParity(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
  actualReleaseRoot?: string;
  previousVersion?: string;
  persist?: boolean;
} = {}): Promise<{
  layout: ReturnType<typeof createCombinedControlReleaseRootCutoverLayout>;
  handoff: CombinedControlReleaseRootCutoverHandoffManifest;
  rehearsal: CombinedControlReleaseRootCutoverRehearsalManifest;
  targetParity: CombinedControlReleaseRootCutoverTargetParityManifest;
  parity: CombinedControlReleaseRootCutoverParityManifest;
}> {
  const rehearsalRun = await runCombinedControlReleaseRootCutoverRehearsal({
    workspaceRoot: args.workspaceRoot,
    targetId: args.targetId,
    version: args.version,
    actualReleaseRoot: args.actualReleaseRoot,
    previousVersion: args.previousVersion,
    persist: true
  });
  const targetParityRun = await runCombinedControlReleaseRootCutoverTargetParity({
    workspaceRoot: rehearsalRun.layout.workspaceRoot,
    targetId: rehearsalRun.layout.targetId,
    version: rehearsalRun.layout.version,
    previousVersion: rehearsalRun.rehearsal.rehearsalPreviousVersion
  });
  const targetLayout = createCombinedControlReleaseRootCutoverTargetLayout({
    workspaceRoot: rehearsalRun.layout.workspaceRoot,
    targetId: rehearsalRun.layout.targetId,
    version: rehearsalRun.layout.version
  });
  const handoff = rehearsalRun.handoff;
  const layout = rehearsalRun.layout;

  const checks: CombinedControlReleaseRootCutoverParityCheck[] = [
    createCheck(
      "actual-handoff",
      handoff.status === "PASS",
      `actual handoff status is ${handoff.status}`
    ),
    createCheck(
      "actual-rehearsal",
      rehearsalRun.rehearsal.status === "PASS",
      `actual rehearsal status is ${rehearsalRun.rehearsal.status}`
    ),
    createCheck(
      "target-parity",
      targetParityRun.parity.status === "PASS",
      `target parity status is ${targetParityRun.parity.status}`
    ),
    createCheck(
      "version-alignment",
      handoff.version === layout.version &&
        rehearsalRun.rehearsal.version === layout.version &&
        targetParityRun.parity.version === layout.version,
      `all parity artifacts target version ${layout.version}`
    ),
    createCheck(
      "previous-version-alignment",
      handoff.rehearsalPreviousVersion === rehearsalRun.rehearsal.rehearsalPreviousVersion &&
        rehearsalRun.rehearsal.rehearsalPreviousVersion === targetParityRun.parity.previousVersion,
      `actual rehearsal previous version is ${rehearsalRun.rehearsal.rehearsalPreviousVersion} and target parity previous version is ${targetParityRun.parity.previousVersion}`
    ),
    createCheck(
      "actual-ready-alignment",
      handoff.actualReadyStatus === "PASS" &&
        targetParityRun.parity.cutoverReadyStatus === "PASS",
      `actual ready is ${handoff.actualReadyStatus} and target parity cutover ready is ${targetParityRun.parity.cutoverReadyStatus}`
    ),
    createCheck(
      "actual-release-root-contract",
      layout.actualReleaseRoot.endsWith("/opt/simplehostman/release") &&
        targetParityRun.parity.actualReleaseRoot.endsWith("/opt/simplehostman/release"),
      `actual release roots are ${layout.actualReleaseRoot} and ${targetParityRun.parity.actualReleaseRoot}`
    ),
    createCheck(
      "summary-artifacts",
      [
        layout.handoffSummaryFile,
        layout.rehearsalSummaryFile,
        targetLayout.cutoverParitySummaryFile
      ].every((filePath) => existsSync(filePath)),
      "actual handoff, actual rehearsal, and target parity summaries exist"
    )
  ];

  const parity: CombinedControlReleaseRootCutoverParityManifest = {
    kind: "combined-release-root-cutover-parity",
    targetId: layout.targetId,
    version: layout.version,
    actualReleaseRoot: layout.actualReleaseRoot,
    rehearsalPreviousVersion: rehearsalRun.rehearsal.rehearsalPreviousVersion,
    generatedAt: new Date().toISOString(),
    actualHandoffStatus: handoff.status,
    actualRehearsalStatus: rehearsalRun.rehearsal.status,
    targetParityStatus: targetParityRun.parity.status,
    status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
    checks
  };

  if (args.persist ?? true) {
    await mkdir(layout.sharedMetaDir, { recursive: true });
    await writeFile(
      layout.parityManifestFile,
      JSON.stringify(parity, null, 2).concat("\n")
    );
    await writeFile(
      layout.paritySummaryFile,
      [
        formatCombinedControlReleaseRootCutoverHandoff(handoff),
        "",
        formatCombinedControlReleaseRootCutoverRehearsal(rehearsalRun.rehearsal),
        "",
        formatCombinedControlReleaseRootCutoverTargetParity(targetParityRun.parity),
        "",
        formatCombinedControlReleaseRootCutoverParity(parity)
      ].join("\n").concat("\n")
    );
  }

  return {
    layout,
    handoff,
    rehearsal: rehearsalRun.rehearsal,
    targetParity: targetParityRun.parity,
    parity
  };
}
