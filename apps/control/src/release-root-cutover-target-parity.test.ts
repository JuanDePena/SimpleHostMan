import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  createCombinedControlReleaseRootCutoverTargetLayout
} from "./release-root-cutover-target-layout.js";
import {
  runCombinedControlReleaseRootCutoverTargetParity
} from "./release-root-cutover-target-parity.js";
import { resolveWorkspaceRoot } from "./release-sandbox-layout.js";

test("release-root cutover target parity aligns actual cutover planning with the emulated target rehearsal", async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const version = "0.1.0";
  const targetId = "release-root-cutover-target-parity";
  const previousVersion = "0.0.4";
  const layout = createCombinedControlReleaseRootCutoverTargetLayout({
    workspaceRoot,
    targetId,
    version
  });

  const { parity, ready, rehearsal } = await runCombinedControlReleaseRootCutoverTargetParity({
    workspaceRoot,
    targetId,
    version,
    previousVersion
  });

  assert.equal(parity.status, "PASS");
  assert.equal(ready.status, "PASS");
  assert.equal(rehearsal.status, "PASS");

  const persisted = JSON.parse(
    readFileSync(layout.cutoverParityManifestFile, "utf8")
  ) as { status: string; previousVersion: string; rehearsalStatus: string };

  assert.equal(persisted.status, "PASS");
  assert.equal(persisted.previousVersion, previousVersion);
  assert.equal(persisted.rehearsalStatus, "PASS");
});
