import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import test from "node:test";

import {
  createApiRequestHandler,
  createControlApiHttpHandler
} from "@simplehost/control-api";
import type { ControlRuntimeConfig } from "@simplehost/control-config";
import type { ControlPlaneStore } from "@simplehost/control-database";
import { closeHttpServer, invokeRequestHandler } from "@simplehost/control-shared";

type IntrospectionPayload = Record<string, unknown>;

function createConfig(overrides: Partial<ControlRuntimeConfig["oauthResourceServer"]> = {}): ControlRuntimeConfig {
  return {
    env: "test",
    version: "0.1.0-test",
    api: { host: "127.0.0.1", port: 4100 },
    web: { host: "127.0.0.1", port: 3200 },
    worker: {
      pollIntervalMs: 5000,
      reconciliationIntervalMs: 300000,
      logLevel: "info"
    },
    database: {
      url: "postgresql://simplehost_control:test@127.0.0.1:5433/simplehost_control"
    },
    auth: {
      bootstrapEnrollmentToken: null,
      bootstrapAdminEmail: null,
      bootstrapAdminPassword: null,
      bootstrapAdminName: null,
      sessionTtlSeconds: 43200
    },
    jobs: {
      payloadSecret: "test-job-secret"
    },
    rustdesk: {
      publicHostname: null,
      txtRecordFqdn: null,
      primaryNodeId: null,
      primaryDnsTarget: null,
      secondaryNodeId: null,
      secondaryDnsTarget: null
    },
    oauthResourceServer: {
      enabled: true,
      issuer: "https://accounts.pyrosa.com.do",
      introspectionUrl: "http://127.0.0.1/not-configured",
      clientId: "oauth-smoke",
      clientSecret: "test-client-secret",
      clientSecretFile: null,
      requiredScope: "profile:read",
      requiredAudience: "simplehost-control",
      introspectionTimeoutMs: 1000,
      ...overrides
    }
  };
}

async function startIntrospectionServer(
  handler: (body: URLSearchParams) => IntrospectionPayload
): Promise<{
  url: string;
  close: () => Promise<void>;
  bodies: URLSearchParams[];
}> {
  const bodies: URLSearchParams[] = [];
  const server = createServer(async (request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/oauth/introspect");

    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
    bodies.push(body);

    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify(handler(body)));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");

  return {
    url: `http://127.0.0.1:${address.port}/oauth/introspect`,
    close: () => closeHttpServer(server),
    bodies
  };
}

function createHandler(config: ControlRuntimeConfig) {
  return createControlApiHttpHandler(createApiRequestHandler({
    config,
    startedAt: Date.now() - 1000,
    controlPlaneStore: {} as ControlPlaneStore
  }));
}

test("OAuth resource-server pilot accepts active scoped tokens with matching audience", async () => {
  const introspection = await startIntrospectionServer((body) => {
    assert.equal(body.get("token"), "valid-token");
    assert.equal(body.get("token_type_hint"), "access_token");
    assert.equal(body.get("client_id"), "oauth-smoke");
    assert.equal(body.get("client_secret"), "test-client-secret");

    return {
      active: true,
      token_type: "access_token",
      client_id: "oauth-smoke",
      scope: "profile:read sessions:read",
      aud: "simplehost-control",
      sub: "client:oauth-smoke",
      principal_type: "service",
      exp: 1780884963,
      iat: 1780884063
    };
  });

  try {
    const response = await invokeRequestHandler(
      createHandler(createConfig({ introspectionUrl: introspection.url })),
      {
        method: "GET",
        url: "/v1/oauth/pilot/profile",
        headers: {
          authorization: "Bearer valid-token"
        }
      }
    );

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.bodyText) as {
      status: string;
      provider: string;
      clientId: string;
      scope: string[];
      audience: string;
      principalType: string;
    };
    assert.equal(payload.status, "ok");
    assert.equal(payload.provider, "pyrosa-accounts");
    assert.equal(payload.clientId, "oauth-smoke");
    assert.deepEqual(payload.scope, ["profile:read", "sessions:read"]);
    assert.equal(payload.audience, "simplehost-control");
    assert.equal(payload.principalType, "service");
    assert.equal(introspection.bodies.length, 1);
  } finally {
    await introspection.close();
  }
});

test("OAuth resource-server pilot fails closed for missing token, inactive token, scope and audience", async () => {
  const introspection = await startIntrospectionServer((body) => {
    switch (body.get("token")) {
      case "inactive-token":
        return { active: false };
      case "wrong-scope":
        return {
          active: true,
          token_type: "access_token",
          client_id: "oauth-smoke",
          scope: "sessions:read",
          aud: "simplehost-control"
        };
      case "wrong-audience":
        return {
          active: true,
          token_type: "access_token",
          client_id: "oauth-smoke",
          scope: "profile:read",
          aud: "other-resource"
        };
      default:
        return { active: false };
    }
  });

  try {
    const handler = createHandler(createConfig({ introspectionUrl: introspection.url }));
    const missingToken = await invokeRequestHandler(handler, {
      method: "GET",
      url: "/v1/oauth/pilot/profile"
    });
    assert.equal(missingToken.statusCode, 401);

    const inactiveToken = await invokeRequestHandler(handler, {
      method: "GET",
      url: "/v1/oauth/pilot/profile",
      headers: { authorization: "Bearer inactive-token" }
    });
    assert.equal(inactiveToken.statusCode, 401);

    const wrongScope = await invokeRequestHandler(handler, {
      method: "GET",
      url: "/v1/oauth/pilot/profile",
      headers: { authorization: "Bearer wrong-scope" }
    });
    assert.equal(wrongScope.statusCode, 403);
    assert.equal(JSON.parse(wrongScope.bodyText).error, "insufficient_scope");

    const wrongAudience = await invokeRequestHandler(handler, {
      method: "GET",
      url: "/v1/oauth/pilot/profile",
      headers: { authorization: "Bearer wrong-audience" }
    });
    assert.equal(wrongAudience.statusCode, 403);
    assert.equal(JSON.parse(wrongAudience.bodyText).error, "invalid_audience");
  } finally {
    await introspection.close();
  }
});

test("OAuth resource-server pilot can read its introspection client secret from a file", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "simplehost-oauth-pilot-"));
  const secretPath = path.join(directory, "client-secret");
  writeFileSync(secretPath, "file-client-secret\n", { mode: 0o600 });
  const introspection = await startIntrospectionServer((body) => {
    assert.equal(body.get("client_secret"), "file-client-secret");
    return {
      active: true,
      token_type: "access_token",
      client_id: "oauth-smoke",
      scope: "profile:read",
      aud: "simplehost-control"
    };
  });

  try {
    const response = await invokeRequestHandler(
      createHandler(createConfig({
        introspectionUrl: introspection.url,
        clientSecret: null,
        clientSecretFile: secretPath
      })),
      {
        method: "GET",
        url: "/v1/oauth/pilot/profile",
        headers: { authorization: "Bearer file-token" }
      }
    );
    assert.equal(response.statusCode, 200);
  } finally {
    await introspection.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
