import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

import { createCombinedControlReleaseRootCutoverTargetLayout } from "./release-root-cutover-target-layout.js";
import {
  runCombinedControlReleaseRootCutoverTargetRehearsal
} from "./release-root-cutover-target-rehearsal.js";
import { resolveWorkspaceRoot } from "./release-sandbox-layout.js";

test("release-root cutover target rehearsal exercises cutover, ready, and rollback over one emulated actual release root", async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const version = "0.1.0";
  const targetId = "release-root-cutover-target-rehearsal";
  const previousVersion = "0.0.5";
  const layout = createCombinedControlReleaseRootCutoverTargetLayout({
    workspaceRoot,
    targetId,
    version
  });
  const previousVersionRoot = join(layout.releasesRoot, previousVersion);

  const { rehearsal, ready, rollbackManifest } =
    await runCombinedControlReleaseRootCutoverTargetRehearsal({
      workspaceRoot,
      targetId,
      version,
      previousVersion
    });

  assert.equal(rehearsal.status, "PASS");
  assert.equal(ready.status, "PASS");
  assert.equal(rollbackManifest.rollbackVersion, previousVersion);
  assert.equal(realpathSync(layout.currentRoot), realpathSync(previousVersionRoot));

  const persisted = JSON.parse(
    readFileSync(layout.cutoverRehearsalManifestFile, "utf8")
  ) as { status: string; rollbackVersion: string | null };

  assert.equal(persisted.status, "PASS");
  assert.equal(persisted.rollbackVersion, previousVersion);
});
