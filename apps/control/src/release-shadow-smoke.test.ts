import assert from "node:assert/strict";
import { existsSync, lstatSync } from "node:fs";
import test from "node:test";

import { startCombinedControlReleaseShadow } from "./release-shadow-runner.js";

test("release-shadow candidate serves key HTTP routes over a release-root-like layout", async () => {
  const runtime = await startCombinedControlReleaseShadow({
    sandboxId: "release-shadow-smoke",
    version: "0.1.0-shadow",
    host: "127.0.0.1",
    port: 0
  });

  try {
    const healthResponse = await fetch(new URL("/healthz", runtime.origin));
    assert.equal(healthResponse.status, 200);
    assert.match(runtime.shadowSummary, /Combined control release-shadow/);
    assert.ok(lstatSync(runtime.packed.layout.currentRoot).isSymbolicLink());
    assert.ok(existsSync(runtime.packed.layout.releaseVersionRoot));
    assert.ok(existsSync(runtime.packed.layout.sharedMetaDir));
    assert.ok(existsSync(runtime.packed.layout.shadowManifestFile));

    const loginResponse = await fetch(new URL("/auth/login", runtime.origin), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      },
      body: "email=admin%40example.com&password=good-pass",
      redirect: "manual"
    });
    assert.equal(loginResponse.status, 303);
    const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
    assert.ok(cookie);

    const overviewResponse = await fetch(new URL("/?view=overview", runtime.origin), {
      headers: {
        cookie
      }
    });
    assert.equal(overviewResponse.status, 200);

    const proxyResponse = await fetch(
      new URL("/proxy-vhost?slug=adudoc&format=json", runtime.origin),
      {
        headers: {
          cookie
        }
      }
    );
    assert.equal(proxyResponse.status, 200);

    const packageInstallResponse = await fetch(
      new URL("/actions/package-install", runtime.origin),
      {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/x-www-form-urlencoded; charset=utf-8"
        },
        body: "packageNames=htop&nodeIds=primary&returnTo=%2F%3Fview%3Dpackages",
        redirect: "manual"
      }
    );
    assert.equal(packageInstallResponse.status, 303);
  } finally {
    await runtime.close();
  }
});
