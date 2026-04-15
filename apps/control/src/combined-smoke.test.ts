import assert from "node:assert/strict";
import test from "node:test";

import { invokeRequestHandler } from "@simplehost/control-shared";

import { createControlTestHarness } from "./test-harness.js";

function pickComparableHeaders(headers: Record<string, string | string[] | undefined>) {
  return {
    "content-type": headers["content-type"],
    location: headers.location,
    "set-cookie": headers["set-cookie"]
  };
}

test("combined candidate matches split behavior with real web/api surfaces", async () => {
  const harness = await createControlTestHarness();
  const requests = [
    {
      method: "GET",
      url: "/v1/meta"
    },
    {
      method: "GET",
      url: "/login"
    },
    {
      method: "GET",
      url: "/?view=overview"
    },
    {
      method: "GET",
      url: "/?view=overview",
      headers: {
        cookie: "shp_session=test-session"
      }
    },
    {
      method: "POST",
      url: "/auth/login",
      body: "email=admin%40example.com&password=good-pass",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      }
    },
    {
      method: "POST",
      url: "/auth/logout",
      headers: {
        cookie: "shp_session=test-session"
      }
    },
    {
      method: "POST",
      url: "/resources/apps/delete",
      body: "slug=adudoc",
      headers: {
        cookie: "shp_session=test-session",
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      }
    },
    {
      method: "POST",
      url: "/resources/apps/delete",
      body: "slug=adudoc",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      }
    },
    {
      method: "POST",
      url: "/actions/package-install",
      body: "packageNames=htop&nodeIds=primary&returnTo=%2F%3Fview%3Dpackages",
      headers: {
        cookie: "shp_session=test-session",
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      }
    },
    {
      method: "POST",
      url: "/resources/mail/domains/upsert",
      body: "domainName=adudoc.com&returnTo=%2F%3Fview%3Dmail",
      headers: {
        cookie: "shp_session=test-session",
        "content-type": "application/x-www-form-urlencoded; charset=utf-8"
      }
    },
    {
      method: "GET",
      url: "/proxy-vhost?slug=adudoc&format=json",
      headers: {
        cookie: "shp_session=test-session"
      }
    },
    {
      method: "GET",
      url: "/proxy-vhost?slug=adudoc",
      headers: {
        cookie: "shp_session=test-session"
      }
    },
    {
      method: "GET",
      url: "/proxy-vhost?slug=adudoc&format=json"
    },
    {
      method: "GET",
      url: "/v1/auth/me",
      headers: {
        authorization: "Bearer test-session"
      }
    },
    {
      method: "GET",
      url: "/v1/resources/spec",
      headers: {
        authorization: "Bearer test-session"
      }
    }
  ] as const;

  for (const request of requests) {
    const [splitResponse, combinedResponse] = await Promise.all([
      invokeRequestHandler(harness.split, request),
      invokeRequestHandler(harness.combined, request)
    ]);

    assert.equal(
      combinedResponse.statusCode,
      splitResponse.statusCode,
      `status mismatch for ${request.method} ${request.url}`
    );
    assert.deepEqual(
      pickComparableHeaders(combinedResponse.headers),
      pickComparableHeaders(splitResponse.headers),
      `header mismatch for ${request.method} ${request.url}`
    );
    assert.equal(
      combinedResponse.bodyText,
      splitResponse.bodyText,
      `body mismatch for ${request.method} ${request.url}`
    );
  }
});
