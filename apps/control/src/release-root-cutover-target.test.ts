import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { mkdir, rm, symlink } from "node:fs/promises";

import {
  applyCombinedControlReleaseRootCutoverTarget
} from "./release-root-cutover-target.js";
import {
  createCombinedControlReleaseRootCutoverTargetLayout
} from "./release-root-cutover-target-layout.js";
import {
  startCombinedControlReleaseRootCutoverTarget
} from "./release-root-cutover-target-runner.js";
import { applyCombinedControlReleaseRootPromotion } from "./release-root-promotion.js";
import {
  startExistingCombinedControlReleaseRootPromotion
} from "./release-root-promotion-runner.js";
import { applyCombinedControlReleaseRootStaging } from "./release-root-staging.js";
import { resolveWorkspaceRoot } from "./release-sandbox-layout.js";

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

test("release-root cutover target applies the cutover plan into an emulated actual release root and matches release-root promotion behavior", async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const version = "0.1.0";
  const targetId = "release-root-cutover-target";

  await applyCombinedControlReleaseRootStaging({
    workspaceRoot,
    version,
    clean: false
  });
  await applyCombinedControlReleaseRootPromotion({
    workspaceRoot,
    targetId,
    version,
    clean: true
  });

  const promotion = await startExistingCombinedControlReleaseRootPromotion({
    workspaceRoot,
    targetId,
    version
  });
  const cutoverTarget = await startCombinedControlReleaseRootCutoverTarget({
    workspaceRoot,
    targetId,
    version
  });

  try {
    const promotionCookie = await login(promotion.origin);
    const targetCookie = await login(cutoverTarget.origin);

    const [promotionPackages, targetPackages, promotionProxy, targetProxy] = await Promise.all([
      fetch(new URL("/?view=packages", promotion.origin), {
        headers: { cookie: promotionCookie }
      }).then((response) => response.text().then((body) => ({ status: response.status, body }))),
      fetch(new URL("/?view=packages", cutoverTarget.origin), {
        headers: { cookie: targetCookie }
      }).then((response) => response.text().then((body) => ({ status: response.status, body }))),
      fetch(new URL("/proxy-vhost?slug=adudoc&format=json", promotion.origin), {
        headers: { cookie: promotionCookie }
      }).then((response) => response.text().then((body) => ({ status: response.status, body }))),
      fetch(new URL("/proxy-vhost?slug=adudoc&format=json", cutoverTarget.origin), {
        headers: { cookie: targetCookie }
      }).then((response) => response.text().then((body) => ({ status: response.status, body })))
    ]);

    assert.equal(cutoverTarget.applyManifest.targetReleaseRoot, cutoverTarget.layout.releaseRoot);
    assert.equal(cutoverTarget.applyManifest.targetCurrentRoot, cutoverTarget.layout.currentRoot);
    assert.equal(
      cutoverTarget.applyManifest.targetReleaseVersionRoot,
      cutoverTarget.layout.releaseVersionRoot
    );
    assert.equal(cutoverTarget.applyManifest.rollbackCandidateRoot, null);
    assert.equal(promotionPackages.status, targetPackages.status);
    assert.equal(promotionPackages.body, targetPackages.body);
    assert.equal(promotionProxy.status, targetProxy.status);
    assert.equal(promotionProxy.body, targetProxy.body);
  } finally {
    await Promise.all([cutoverTarget.close(), promotion.close()]);
  }
});

test("release-root cutover target preserves a rollback candidate from an existing current symlink", async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const version = "0.1.0";
  const targetId = "release-root-cutover-target-rollback";
  const layout = createCombinedControlReleaseRootCutoverTargetLayout({
    workspaceRoot,
    targetId,
    version
  });
  const previousVersion = "0.0.8";
  const previousVersionRoot = join(layout.releasesRoot, previousVersion);

  await rm(layout.targetRoot, { recursive: true, force: true });
  await mkdir(previousVersionRoot, { recursive: true });
  await symlink(previousVersionRoot, layout.currentRoot);

  await applyCombinedControlReleaseRootStaging({
    workspaceRoot,
    version,
    clean: false
  });
  await applyCombinedControlReleaseRootPromotion({
    workspaceRoot,
    targetId,
    version,
    clean: true
  });

  const applied = await applyCombinedControlReleaseRootCutoverTarget({
    workspaceRoot,
    targetId,
    version,
    clean: false
  });

  assert.equal(applied.planManifest.rollbackCandidateRoot, previousVersionRoot);
  assert.equal(applied.applyManifest.rollbackCandidateRoot, previousVersionRoot);
  assert.ok(existsSync(previousVersionRoot));
  assert.equal(realpathSync(layout.currentRoot), realpathSync(layout.releaseVersionRoot));
});
