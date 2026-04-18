import assert from "node:assert/strict";
import { cp, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import test from "node:test";

import {
  activateCombinedControlReleaseRootPromotionVersion,
  readCombinedControlReleaseRootPromotionInventory,
  syncCombinedControlReleaseRootPromotionInventory,
  resolveActiveCombinedControlReleaseRootPromotion
} from "./release-root-promotion-activation.js";
import { applyCombinedControlReleaseRootPromotion } from "./release-root-promotion.js";
import { createCombinedControlReleaseRootPromotionLayout } from "./release-root-promotion-layout.js";
import { startExistingCombinedControlReleaseRootPromotion } from "./release-root-promotion-runner.js";
import { applyCombinedControlReleaseRootStaging } from "./release-root-staging.js";

async function login(origin: string) {
  const response = await fetch(new URL("/auth/login", origin), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8"
    },
    body: "email=admin%40example.com&password=good-pass",
    redirect: "manual"
  });
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);
  return cookie;
}

test("release-root promotion keeps inventory and can switch active versions", async () => {
  const targetId = "release-root-promotion-activation";
  const versionA = "0.1.0";
  const versionB = "0.1.0-live-b";

  await applyCombinedControlReleaseRootStaging({
    sandboxId: `${targetId}-staging`,
    version: versionA,
    host: "127.0.0.1",
    port: 0,
    clean: true
  });
  await applyCombinedControlReleaseRootPromotion({
    targetId,
    version: versionA,
    clean: true
  });

  const layoutA = createCombinedControlReleaseRootPromotionLayout({
    targetId,
    version: versionA
  });
  const versionBRoot = createCombinedControlReleaseRootPromotionLayout({
    targetId,
    version: versionB
  }).releaseVersionRoot;
  await mkdir(dirname(versionBRoot), { recursive: true });
  await cp(layoutA.releaseVersionRoot, versionBRoot, { recursive: true });
  await syncCombinedControlReleaseRootPromotionInventory({ targetId });
  await activateCombinedControlReleaseRootPromotionVersion({
    targetId,
    version: versionB
  });

  const inventory = await readCombinedControlReleaseRootPromotionInventory({ targetId });
  assert.deepEqual(
    inventory.releases.map((release) => release.version),
    [versionA, versionB]
  );

  const switched = await activateCombinedControlReleaseRootPromotionVersion({
    targetId,
    version: versionA
  });
  assert.equal(switched.activeVersion, versionA);
  assert.equal(switched.previousVersion, versionB);

  const active = await resolveActiveCombinedControlReleaseRootPromotion({ targetId });
  assert.equal(active.activation.activeVersion, versionA);

  const runtime = await startExistingCombinedControlReleaseRootPromotion({
    targetId,
    version: versionA
  });

  try {
    assert.equal(runtime.layout.version, versionA);
    assert.equal(runtime.applyManifest.version, versionA);

    const cookie = await login(runtime.origin);
    const response = await fetch(new URL("/?view=packages", runtime.origin), {
      headers: { cookie }
    });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Packages/i);
  } finally {
    await runtime.close();
  }
});
