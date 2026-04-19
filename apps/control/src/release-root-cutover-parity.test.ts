import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { mkdir, readFile, rm, symlink } from "node:fs/promises";

import { createCombinedControlReleaseRootCutoverLayout } from "./release-root-cutover-layout.js";
import { runCombinedControlReleaseRootCutoverParity } from "./release-root-cutover-parity.js";
import { resolveWorkspaceRoot } from "./release-sandbox-layout.js";

function createActualReleaseRootFixture(targetId: string) {
  return join(
    resolveWorkspaceRoot(),
    ".tmp",
    "control-release-root-cutover-parity-actual",
    targetId,
    "opt",
    "simplehostman",
    "release"
  );
}

test("release-root cutover parity keeps the actual cutover layer aligned with the target parity layer", async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const version = "0.1.0";
  const targetId = "release-root-cutover-parity";
  const actualReleaseRoot = createActualReleaseRootFixture(targetId);
  const previousVersion = "0.1.7";
  const previousVersionRoot = join(actualReleaseRoot, "releases", previousVersion);
  const actualCurrentRoot = join(actualReleaseRoot, "current");

  await rm(actualReleaseRoot, { recursive: true, force: true });
  await mkdir(previousVersionRoot, { recursive: true });
  await symlink(previousVersionRoot, actualCurrentRoot);

  const result = await runCombinedControlReleaseRootCutoverParity({
    workspaceRoot,
    targetId,
    version,
    actualReleaseRoot,
    previousVersion,
    persist: true
  });

  assert.equal(result.parity.status, "PASS");
  assert.equal(result.handoff.status, "PASS");
  assert.equal(result.rehearsal.status, "PASS");
  assert.equal(result.targetParity.status, "PASS");
  assert.equal(result.parity.rehearsalPreviousVersion, previousVersion);
  assert.equal(
    result.parity.checks.find((check) => check.name === "previous-version-alignment")?.ok,
    true
  );

  const layout = createCombinedControlReleaseRootCutoverLayout({
    workspaceRoot,
    targetId,
    version,
    actualReleaseRoot
  });
  const persisted = JSON.parse(
    await readFile(layout.parityManifestFile, "utf8")
  ) as { status: string; rehearsalPreviousVersion: string; targetParityStatus: string };

  assert.equal(persisted.status, "PASS");
  assert.equal(persisted.rehearsalPreviousVersion, previousVersion);
  assert.equal(persisted.targetParityStatus, "PASS");
});
