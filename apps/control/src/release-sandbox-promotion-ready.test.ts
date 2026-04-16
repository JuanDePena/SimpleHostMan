import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCombinedControlReleaseSandboxPromotionReady,
  runCombinedControlReleaseSandboxPromotionReady
} from "./release-sandbox-promotion-ready.js";

test("release-sandbox promotion-ready passes with deploy and rollback manifests", async () => {
  const sandboxId = `promotion-ready-${process.pid}-${Date.now()}`;
  const result = await runCombinedControlReleaseSandboxPromotionReady({
    sandboxId,
    version: "0.1.0-pr",
    host: "127.0.0.1",
    port: 0
  });

  assert.equal(result.kind, "combined-release-sandbox-promotion-ready");
  assert.equal(result.status, "PASS");
  assert.equal(result.checks.every((check) => check.ok), true);
  assert.ok(result.checks.find((check) => check.name === "promotion-manifest")?.ok);
  assert.ok(result.checks.find((check) => check.name === "deploy-manifest")?.ok);
  assert.ok(result.checks.find((check) => check.name === "rollback-manifest")?.ok);
  assert.ok(result.checks.find((check) => check.name === "runtime-healthz")?.ok);
  assert.ok(result.checks.find((check) => check.name === "runtime-login")?.ok);
  assert.match(
    formatCombinedControlReleaseSandboxPromotionReady(result),
    /Status: PASS/
  );
});
