import assert from "node:assert/strict";
import test from "node:test";

import { createCombinedControlReleaseRootStagingLayout } from "./release-root-staging-layout.js";
import { runCombinedControlReleaseRootPromotionReady } from "./release-root-promotion-ready.js";

test("release-root promotion ready verifies the promoted live-root candidate", async () => {
  const targetId = "default";
  const version = createCombinedControlReleaseRootStagingLayout().version;

  const result = await runCombinedControlReleaseRootPromotionReady({
    targetId,
    version,
    host: "127.0.0.1",
    port: 0
  });

  assert.equal(result.targetId, targetId);
  assert.equal(result.version, version);
  assert.equal(result.status, "PASS");
  assert.ok(result.checks.every((check) => check.ok));
});
