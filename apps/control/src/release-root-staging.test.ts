import assert from "node:assert/strict";
import { existsSync, realpathSync } from "node:fs";
import { rm } from "node:fs/promises";
import test from "node:test";

import { diffCombinedControlReleaseRootStaging } from "./release-root-staging.js";
import { createCombinedControlReleaseRootStagingLayout } from "./release-root-staging-layout.js";
import { startCombinedControlReleaseRootStaging } from "./release-root-staging-runner.js";
import { startCombinedControlReleaseTarget } from "./release-target-runner.js";

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
  assert.ok(cookie, `login should set shp_session for ${origin}`);
  return cookie;
}

async function readComparableResponse(url: URL, cookie: string) {
  const response = await fetch(url, {
    headers: { cookie }
  });
  return {
    status: response.status,
    body: await response.text()
  };
}

test("release-root staging materializes under the real release root staging area and matches release-target", async () => {
  const version = "0.1.0";
  const layout = createCombinedControlReleaseRootStagingLayout({ version });
  await rm(layout.stagingRoot, { recursive: true, force: true });

  const diffBefore = await diffCombinedControlReleaseRootStaging({
    version,
    host: "127.0.0.1",
    port: 0
  });
  assert.equal(diffBefore.diffManifest.status, "FAIL");

  const target = await startCombinedControlReleaseTarget({
    sandboxId: "release-root-staging",
    version,
    host: "127.0.0.1",
    port: 0
  });
  const staging = await startCombinedControlReleaseRootStaging({
    version,
    host: "127.0.0.1",
    port: 0
  });

  try {
    const [targetCookie, stagingCookie] = await Promise.all([
      login(target.origin),
      login(staging.origin)
    ]);

    const [targetPackages, stagingPackages, targetProxy, stagingProxy] = await Promise.all([
      readComparableResponse(new URL("/?view=packages", target.origin), targetCookie),
      readComparableResponse(new URL("/?view=packages", staging.origin), stagingCookie),
      readComparableResponse(new URL("/proxy-vhost?slug=adudoc&format=json", target.origin), targetCookie),
      readComparableResponse(new URL("/proxy-vhost?slug=adudoc&format=json", staging.origin), stagingCookie)
    ]);

    const diffAfter = await diffCombinedControlReleaseRootStaging({ version, persist: true });

    assert.equal(diffAfter.diffManifest.status, "PASS");
    assert.equal(staging.layout.actualReleaseRoot, "/opt/simplehostman/release");
    assert.ok(staging.layout.stagingRoot.startsWith("/opt/simplehostman/release/.staging/control"));
    assert.equal(stagingPackages.status, targetPackages.status);
    assert.equal(stagingPackages.body, targetPackages.body);
    assert.equal(stagingProxy.status, targetProxy.status);
    assert.equal(stagingProxy.body, targetProxy.body);
    if (existsSync(staging.layout.actualCurrentRoot)) {
      assert.ok(!realpathSync(staging.layout.actualCurrentRoot).startsWith(staging.layout.stagingRoot));
    }
  } finally {
    await Promise.all([staging.close(), target.close()]);
  }
});
