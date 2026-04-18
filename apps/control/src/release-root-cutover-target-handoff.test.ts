import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { createCombinedControlReleaseRootCutoverTargetLayout } from "./release-root-cutover-target-layout.js";
import { runCombinedControlReleaseRootCutoverTargetHandoff } from "./release-root-cutover-target-handoff.js";
import { resolveWorkspaceRoot } from "./release-sandbox-layout.js";

test("release-root cutover target handoff consolidates ready, rehearsal, and parity into one auditable artifact", async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const version = "0.1.0";
  const targetId = "release-root-cutover-target-handoff";
  const previousVersion = "0.0.9";

  const result = await runCombinedControlReleaseRootCutoverTargetHandoff({
    workspaceRoot,
    targetId,
    version,
    previousVersion
  });

  assert.equal(result.handoff.status, "PASS");
  assert.equal(result.targetReady.status, "PASS");
  assert.equal(result.actualCutoverReady.status, "PASS");
  assert.equal(result.rehearsal.status, "PASS");
  assert.equal(result.parity.status, "PASS");
  assert.equal(
    result.handoff.checks.find((check) => check.name === "previous-version-alignment")?.ok,
    true
  );

  const layout = createCombinedControlReleaseRootCutoverTargetLayout({
    workspaceRoot,
    targetId,
    version
  });
  const persisted = JSON.parse(
    await readFile(layout.cutoverHandoffManifestFile, "utf8")
  ) as { status: string; previousVersion: string; parityStatus: string };

  assert.equal(persisted.status, "PASS");
  assert.equal(persisted.previousVersion, previousVersion);
  assert.equal(persisted.parityStatus, "PASS");
});
