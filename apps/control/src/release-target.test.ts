import assert from "node:assert/strict";
import test from "node:test";

import { startCombinedControlReleaseShadow } from "./release-shadow-runner.js";
import { startCombinedControlReleaseTarget } from "./release-target-runner.js";

test("release-target applies the handoff and matches release-shadow behavior", async () => {
  const shadow = await startCombinedControlReleaseShadow({
    sandboxId: "release-target",
    version: "0.1.0-target",
    host: "127.0.0.1",
    port: 0
  });
  const target = await startCombinedControlReleaseTarget({
    sandboxId: "release-target",
    version: "0.1.0-target",
    host: "127.0.0.1",
    port: 0
  });

  try {
    const [shadowLogin, targetLogin] = await Promise.all([
      fetch(new URL("/auth/login", shadow.origin), {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=utf-8"
        },
        body: "email=admin%40example.com&password=good-pass",
        redirect: "manual"
      }),
      fetch(new URL("/auth/login", target.origin), {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=utf-8"
        },
        body: "email=admin%40example.com&password=good-pass",
        redirect: "manual"
      })
    ]);
    const shadowCookie = shadowLogin.headers.get("set-cookie")?.split(";", 1)[0];
    const targetCookie = targetLogin.headers.get("set-cookie")?.split(";", 1)[0];
    assert.ok(shadowCookie);
    assert.ok(targetCookie);

    const [shadowPackages, targetPackages, shadowProxy, targetProxy] = await Promise.all([
      fetch(new URL("/?view=packages", shadow.origin), {
        headers: { cookie: shadowCookie }
      }).then((response) => response.text().then((body) => ({ status: response.status, body }))),
      fetch(new URL("/?view=packages", target.origin), {
        headers: { cookie: targetCookie }
      }).then((response) => response.text().then((body) => ({ status: response.status, body }))),
      fetch(new URL("/proxy-vhost?slug=adudoc&format=json", shadow.origin), {
        headers: { cookie: shadowCookie }
      }).then((response) => response.text().then((body) => ({ status: response.status, body }))),
      fetch(new URL("/proxy-vhost?slug=adudoc&format=json", target.origin), {
        headers: { cookie: targetCookie }
      }).then((response) => response.text().then((body) => ({ status: response.status, body })))
    ]);

    assert.equal(target.applyManifest.targetReleaseRoot, target.layout.releaseRoot);
    assert.equal(target.applyManifest.targetCurrentRoot, target.layout.currentRoot);
    assert.equal(target.applyManifest.targetReleaseVersionRoot, target.layout.releaseVersionRoot);
    assert.ok(shadow.shadowManifest.sourceCommitish.length > 0);
    assert.equal(shadowPackages.status, targetPackages.status);
    assert.equal(shadowPackages.body, targetPackages.body);
    assert.equal(shadowProxy.status, targetProxy.status);
    assert.equal(shadowProxy.body, targetProxy.body);
  } finally {
    await Promise.all([target.close(), shadow.close()]);
  }
});
