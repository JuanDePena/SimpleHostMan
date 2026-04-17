import assert from "node:assert/strict";
import test from "node:test";

import {
  activateCombinedControlReleaseShadowVersion,
  readCombinedControlReleaseShadowInventory,
  resolveActiveCombinedControlReleaseShadow
} from "./release-shadow-activation.js";
import { packCombinedControlReleaseShadow } from "./release-shadow-pack.js";
import { packCombinedControlReleaseSandbox } from "./release-sandbox-pack.js";

test("release-shadow copies sandbox inventory and can switch active versions", async () => {
  const sandboxId = "release-shadow-activation";
  await packCombinedControlReleaseSandbox({
    sandboxId,
    version: "0.1.0-shadow-a",
    host: "127.0.0.1",
    port: 0,
    clean: true
  });
  await packCombinedControlReleaseSandbox({
    sandboxId,
    version: "0.1.0-shadow-b",
    host: "127.0.0.1",
    port: 0,
    clean: false
  });

  const packed = await packCombinedControlReleaseShadow({
    sandboxId,
    version: "0.1.0-shadow-b",
    host: "127.0.0.1",
    port: 0,
    clean: true
  });

  const inventory = await readCombinedControlReleaseShadowInventory({ sandboxId });
  assert.deepEqual(
    inventory.releases.map((release) => release.version),
    ["0.1.0-shadow-a", "0.1.0-shadow-b"]
  );
  assert.equal(packed.activation.activeVersion, "0.1.0-shadow-b");

  const switched = await activateCombinedControlReleaseShadowVersion({
    sandboxId,
    version: "0.1.0-shadow-a"
  });
  assert.equal(switched.activeVersion, "0.1.0-shadow-a");

  const active = await resolveActiveCombinedControlReleaseShadow({ sandboxId });
  assert.equal(active.activation.activeVersion, "0.1.0-shadow-a");
  assert.equal(active.manifest.version, "0.1.0-shadow-a");
});
