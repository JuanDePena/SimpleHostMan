import assert from "node:assert/strict";
import test from "node:test";

import { startCombinedControlReleaseSandbox } from "./release-sandbox-runner.js";
import { startCombinedControlReleaseShadow } from "./release-shadow-runner.js";

async function readResponse(response: Response) {
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    location: response.headers.get("location") ?? "",
    body: await response.text()
  };
}

test("release-shadow candidate matches the release-sandbox candidate for representative routes", async () => {
  const sandbox = await startCombinedControlReleaseSandbox({
    sandboxId: "release-shadow-parity-sandbox",
    version: "0.1.0-shadow",
    host: "127.0.0.1",
    port: 0
  });
  const shadow = await startCombinedControlReleaseShadow({
    sandboxId: "release-shadow-parity-shadow",
    version: "0.1.0-shadow",
    host: "127.0.0.1",
    port: 0
  });

  try {
    const [sandboxLogin, shadowLogin] = await Promise.all([
      fetch(new URL("/auth/login", sandbox.origin), {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=utf-8"
        },
        body: "email=admin%40example.com&password=good-pass",
        redirect: "manual"
      }).then(readResponse),
      fetch(new URL("/auth/login", shadow.origin), {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=utf-8"
        },
        body: "email=admin%40example.com&password=good-pass",
        redirect: "manual"
      }).then(readResponse)
    ]);

    assert.equal(sandboxLogin.status, shadowLogin.status);

    const sandboxSession = (
      await fetch(new URL("/auth/login", sandbox.origin), {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=utf-8"
        },
        body: "email=admin%40example.com&password=good-pass",
        redirect: "manual"
      })
    ).headers.get("set-cookie")?.split(";", 1)[0];
    const shadowSession = (
      await fetch(new URL("/auth/login", shadow.origin), {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=utf-8"
        },
        body: "email=admin%40example.com&password=good-pass",
        redirect: "manual"
      })
    ).headers.get("set-cookie")?.split(";", 1)[0];

    assert.ok(sandboxSession);
    assert.ok(shadowSession);

    const requests = [
      {
        url: "/healthz",
        compareBody: false
      },
      {
        url: "/?view=packages",
        init: {
          headers: {
            cookie: sandboxSession
          }
        } as RequestInit,
        shadowInit: {
          headers: {
            cookie: shadowSession
          }
        } as RequestInit
      },
      {
        url: "/proxy-vhost?slug=adudoc&format=json",
        init: {
          headers: {
            cookie: sandboxSession
          }
        } as RequestInit,
        shadowInit: {
          headers: {
            cookie: shadowSession
          }
        } as RequestInit
      }
    ];

    for (const request of requests) {
      const [sandboxResponse, shadowResponse] = await Promise.all([
        fetch(new URL(request.url, sandbox.origin), request.init).then(readResponse),
        fetch(new URL(request.url, shadow.origin), request.shadowInit ?? request.init).then(
          readResponse
        )
      ]);

      assert.equal(shadowResponse.status, sandboxResponse.status, request.url);
      assert.equal(shadowResponse.contentType, sandboxResponse.contentType, request.url);
      if (request.compareBody !== false) {
        assert.equal(shadowResponse.body, sandboxResponse.body, request.url);
      }
    }
  } finally {
    await Promise.all([sandbox.close(), shadow.close()]);
  }
});
