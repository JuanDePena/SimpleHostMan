import assert from "node:assert/strict";
import test from "node:test";

import { runCombinedControlReleaseShadowPromotionReady } from "./release-shadow-promotion-ready.js";

test("release-shadow promotion-ready passes with shadow deploy and rollback manifests", async () => {
  const result = await runCombinedControlReleaseShadowPromotionReady({
    sandboxId: "release-shadow-promotion-ready",
    version: "0.1.0-shadow-ready",
    host: "127.0.0.1",
    port: 0
  });

  assert.equal(result.status, "PASS");
  assert.ok(result.checks.find((check) => check.name === "promotion-manifest")?.ok);
  assert.ok(result.checks.find((check) => check.name === "deploy-manifest")?.ok);
  assert.ok(result.checks.find((check) => check.name === "rollback-manifest")?.ok);
  assert.ok(result.checks.find((check) => check.name === "current-symlink")?.ok);
});
