import { existsSync, realpathSync } from "node:fs";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { applyCombinedControlReleaseRootPromotion } from "./release-root-promotion.js";
import { applyCombinedControlReleaseRootStaging } from "./release-root-staging.js";
import {
  applyCombinedControlReleaseRootCutoverTarget
} from "./release-root-cutover-target.js";
import { createCombinedControlReleaseRootCutoverTargetLayout } from "./release-root-cutover-target-layout.js";
import {
  formatCombinedControlReleaseRootCutoverTargetReady,
  runCombinedControlReleaseRootCutoverTargetReady,
  type CombinedControlReleaseRootCutoverTargetReadyResult
} from "./release-root-cutover-target-ready.js";
import {
  formatCombinedControlReleaseRootCutoverTargetRollbackManifest,
  rollbackCombinedControlReleaseRootCutoverTarget,
  type CombinedControlReleaseRootCutoverTargetRollbackManifest
} from "./release-root-cutover-target-rollback.js";

export interface CombinedControlReleaseRootCutoverTargetRehearsalCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CombinedControlReleaseRootCutoverTargetRehearsalManifest {
  readonly kind: "combined-release-root-cutover-target-rehearsal";
  readonly targetId: string;
  readonly version: string;
  readonly previousVersion: string;
  readonly generatedAt: string;
  readonly status: "PASS" | "FAIL";
  readonly readyStatus: CombinedControlReleaseRootCutoverTargetReadyResult["status"];
  readonly rollbackVersion: string | null;
  readonly checks: readonly CombinedControlReleaseRootCutoverTargetRehearsalCheck[];
}

function createCheck(name: string, ok: boolean, detail: string) {
  return { name, ok, detail } satisfies CombinedControlReleaseRootCutoverTargetRehearsalCheck;
}

export function formatCombinedControlReleaseRootCutoverTargetRehearsal(
  manifest: CombinedControlReleaseRootCutoverTargetRehearsalManifest
): string {
  const passed = manifest.checks.filter((check) => check.ok).length;
  return [
    "Combined control release-root cutover target rehearsal",
    `Target: ${manifest.targetId}`,
    `Version: ${manifest.version}`,
    `Previous version: ${manifest.previousVersion}`,
    `Generated: ${manifest.generatedAt}`,
    `Ready status: ${manifest.readyStatus}`,
    `Rollback version: ${manifest.rollbackVersion ?? "none"}`,
    `Status: ${manifest.status} (${passed}/${manifest.checks.length})`,
    "",
    ...manifest.checks.map(
      (check) => `[${check.ok ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`
    )
  ].join("\n");
}

export async function runCombinedControlReleaseRootCutoverTargetRehearsal(args: {
  workspaceRoot?: string;
  targetId?: string;
  version?: string;
  previousVersion?: string;
} = {}): Promise<{
  rehearsal: CombinedControlReleaseRootCutoverTargetRehearsalManifest;
  ready: CombinedControlReleaseRootCutoverTargetReadyResult;
  rollbackManifest: CombinedControlReleaseRootCutoverTargetRollbackManifest;
}> {
  const layout = createCombinedControlReleaseRootCutoverTargetLayout(args);
  const previousVersion = args.previousVersion ?? "0.0.7";
  const previousVersionRoot = join(layout.releasesRoot, previousVersion);

  await rm(layout.targetRoot, { recursive: true, force: true });
  await mkdir(previousVersionRoot, { recursive: true });
  await symlink(previousVersionRoot, layout.currentRoot);

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
  const applied = await applyCombinedControlReleaseRootCutoverTarget({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version,
    clean: false
  });
  const ready = await runCombinedControlReleaseRootCutoverTargetReady({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version
  });
  const rolledBack = await rollbackCombinedControlReleaseRootCutoverTarget({
    workspaceRoot: layout.workspaceRoot,
    targetId: layout.targetId,
    version: layout.version
  });

  const historyTail = rolledBack.history.records.slice(-2);
  const currentRestored =
    existsSync(layout.currentRoot) &&
    realpathSync(layout.currentRoot) === realpathSync(previousVersionRoot);

  const checks: CombinedControlReleaseRootCutoverTargetRehearsalCheck[] = [
    createCheck(
      "rollback-candidate-seeded",
      applied.applyManifest.rollbackCandidateRoot === previousVersionRoot,
      `rollback candidate is ${applied.applyManifest.rollbackCandidateRoot ?? "none"}`
    ),
    createCheck(
      "ready",
      ready.status === "PASS",
      `ready status is ${ready.status}`
    ),
    createCheck(
      "rollback-version",
      rolledBack.rollbackManifest.rollbackVersion === previousVersion,
      `rollback manifest targets ${rolledBack.rollbackManifest.rollbackVersion}`
    ),
    createCheck(
      "current-restored",
      currentRestored,
      currentRestored
        ? `current restored to ${previousVersionRoot}`
        : `current points to ${existsSync(layout.currentRoot) ? realpathSync(layout.currentRoot) : "missing"}`
    ),
    createCheck(
      "history-tail",
      historyTail.length === 2 &&
        historyTail[0]?.action === "cutover" &&
        historyTail[1]?.action === "rollback",
      historyTail.length > 0
        ? `history tail is ${historyTail.map((record) => `${record.action}:${record.version}`).join(" -> ")}`
        : "history tail missing"
    )
  ];

  const rehearsal: CombinedControlReleaseRootCutoverTargetRehearsalManifest = {
    kind: "combined-release-root-cutover-target-rehearsal",
    targetId: layout.targetId,
    version: layout.version,
    previousVersion,
    generatedAt: new Date().toISOString(),
    readyStatus: ready.status,
    rollbackVersion: rolledBack.rollbackManifest.rollbackVersion,
    status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
    checks
  };

  await mkdir(layout.sharedMetaDir, { recursive: true });
  await writeFile(
    layout.cutoverRehearsalManifestFile,
    JSON.stringify(rehearsal, null, 2).concat("\n")
  );
  await writeFile(
    layout.cutoverRehearsalSummaryFile,
    [
      formatCombinedControlReleaseRootCutoverTargetReady(ready),
      "",
      formatCombinedControlReleaseRootCutoverTargetRollbackManifest(rolledBack.rollbackManifest),
      "",
      formatCombinedControlReleaseRootCutoverTargetRehearsal(rehearsal)
    ].join("\n").concat("\n")
  );

  return {
    rehearsal,
    ready,
    rollbackManifest: rolledBack.rollbackManifest
  };
}
