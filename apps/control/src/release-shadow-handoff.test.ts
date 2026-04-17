import assert from "node:assert/strict";
import test from "node:test";

import { runCombinedControlReleaseShadowHandoff } from "./release-shadow-handoff-runner.js";

test("release-shadow handoff stays ready for a real release-root dry-run", async () => {
  const result = await runCombinedControlReleaseShadowHandoff({
    sandboxId: "release-shadow-handoff",
    version: "0.1.0-handoff-ready",
    host: "127.0.0.1",
    port: 0
  });

  assert.equal(result.status, "PASS");
  assert.ok(result.checks.find((check) => check.name === "handoff-manifest")?.ok);
  assert.ok(result.checks.find((check) => check.name === "target-root-contract")?.ok);
  assert.ok(result.checks.find((check) => check.name === "planned-steps")?.ok);
});
