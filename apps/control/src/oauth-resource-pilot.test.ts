import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
      authorizationUrl: null,
      tokenUrl: null,
      introspectionUrl: "http://127.0.0.1/not-configured",
      revocationUrl: null,
      clientId: "oauth-smoke",
      clientSecret: "test-client-secret",
      clientSecretFile: null,
      requiredScope: "profile:read",
      requiredAudience: "simplehost-control",
      requiredPrincipalType: null,
      requiredAssuranceLevel: null,
      pilotRedirectUri: "https://vps-prd.pyrosa.com.do:3200/v1/oauth/pilot/callback",
      pilotScope: "profile:read",
      pilotRequiredPrincipalType: null,
      pilotRequiredAssuranceLevel: null,
      pilotRevokeTokens: true,
      loginEnabled: false,
      loginRedirectUri: "https://vps-prd.pyrosa.com.do:3200/auth/pyrosa-accounts/callback",
      loginScope: "profile:read mfa:read",
      loginRequiredPrincipalType: "human",
      loginRequiredAssuranceLevel: "aal2",
      loginRequiredGroup: null,
      loginLogoutUrl: "https://accounts.pyrosa.com.do/logout",
      loginPostLogoutRedirectUri: "https://vps-prd.pyrosa.com.do:3200/login?notice=Session%20closed&kind=info",
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

async function startOAuthPilotServer(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
  tokenBodies: URLSearchParams[];
  introspectionBodies: URLSearchParams[];
  revocationBodies: URLSearchParams[];
}> {
  const tokenBodies: URLSearchParams[] = [];
  const introspectionBodies: URLSearchParams[] = [];
  const revocationBodies: URLSearchParams[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));

    if (request.method === "POST" && request.url === "/oauth/token") {
      tokenBodies.push(body);
      assert.equal(body.get("grant_type"), "authorization_code");
      assert.equal(body.get("client_id"), "oauth-smoke");
      assert.equal(body.get("client_secret"), "test-client-secret");
      assert.equal(body.get("code"), "human-code");
      assert.ok(body.get("code_verifier"));
      assert.equal(body.get("audience"), "simplehost-control");
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        access_token: "human-access-token",
        token_type: "Bearer",
        expires_in: 900,
        scope: "profile:read mfa:read"
      }));
      return;
    }

    if (request.method === "POST" && request.url === "/oauth/introspect") {
      introspectionBodies.push(body);
      assert.equal(body.get("token"), "human-access-token");
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        active: true,
        token_type: "access_token",
        client_id: "oauth-smoke",
        scope: "profile:read mfa:read",
        aud: "simplehost-control",
        sub: "42",
        username: "webmaster@pyrosa.com.do",
        name: "PYROSA Webmaster",
        principal_type: "human",
        assurance_level: "aal2",
        groups: ["PYROSA Operators"],
        exp: 1780884963,
        iat: 1780884063
      }));
      return;
    }

    if (request.method === "POST" && request.url === "/oauth/revoke") {
      revocationBodies.push(body);
      assert.equal(body.get("token"), "human-access-token");
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ revoked: true }));
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => closeHttpServer(server),
    tokenBodies,
    introspectionBodies,
    revocationBodies
  };
}

function createHandler(config: ControlRuntimeConfig) {
  return createControlApiHttpHandler(createApiRequestHandler({
    config,
    startedAt: Date.now() - 1000,
    controlPlaneStore: {} as ControlPlaneStore
  }));
}

function hashTokenForTest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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

test("OAuth browser pilot completes Authorization Code with human AAL2 claims", async () => {
  const oauth = await startOAuthPilotServer();
  const handler = createHandler(createConfig({
    authorizationUrl: `${oauth.baseUrl}/oauth/authorize`,
    tokenUrl: `${oauth.baseUrl}/oauth/token`,
    introspectionUrl: `${oauth.baseUrl}/oauth/introspect`,
    revocationUrl: `${oauth.baseUrl}/oauth/revoke`,
    pilotScope: "profile:read mfa:read",
    pilotRequiredPrincipalType: "human",
    pilotRequiredAssuranceLevel: "aal2"
  }));

  try {
    const startResponse = await invokeRequestHandler(handler, {
      method: "GET",
      url: "/v1/oauth/pilot/start"
    });
    assert.equal(startResponse.statusCode, 303);
    const location = String(startResponse.headers.location);
    const authorize = new URL(location);
    assert.equal(authorize.pathname, "/oauth/authorize");
    assert.equal(authorize.searchParams.get("response_type"), "code");
    assert.equal(authorize.searchParams.get("client_id"), "oauth-smoke");
    assert.equal(authorize.searchParams.get("scope"), "profile:read mfa:read");
    assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
    assert.ok(authorize.searchParams.get("code_challenge"));
    const cookie = String(startResponse.headers["set-cookie"]).split(";", 1)[0];
    assert.match(cookie, /^shp_oauth_pilot=/);

    const callback = await invokeRequestHandler(handler, {
      method: "GET",
      url: `/v1/oauth/pilot/callback?format=json&state=${authorize.searchParams.get("state")}&code=human-code`,
      headers: {
        cookie
      }
    });
    assert.equal(callback.statusCode, 200);
    const payload = JSON.parse(callback.bodyText) as {
      status: string;
      principalType: string;
      assuranceLevel: string;
      username: string;
      scope: string[];
    };
    assert.equal(payload.status, "ok");
    assert.equal(payload.principalType, "human");
    assert.equal(payload.assuranceLevel, "aal2");
    assert.equal(payload.username, "webmaster@pyrosa.com.do");
    assert.deepEqual(payload.scope, ["profile:read", "mfa:read"]);
    assert.equal(oauth.tokenBodies.length, 1);
    assert.equal(oauth.introspectionBodies.length, 1);
    assert.equal(oauth.revocationBodies.length, 1);
  } finally {
    await oauth.close();
  }
});

test("Pyrosa Accounts OAuth login validates code flow before creating a local session", async () => {
  const oauth = await startOAuthPilotServer();
  let capturedLogin: unknown;
  const handler = createControlApiHttpHandler(createApiRequestHandler({
    config: createConfig({
      loginEnabled: true,
      tokenUrl: `${oauth.baseUrl}/oauth/token`,
      introspectionUrl: `${oauth.baseUrl}/oauth/introspect`,
      loginScope: "profile:read mfa:read",
      loginRequiredPrincipalType: "human",
      loginRequiredAssuranceLevel: "aal2"
    }),
    startedAt: Date.now() - 1000,
    controlPlaneStore: {
      loginOAuthUser: async (request: Parameters<ControlPlaneStore["loginOAuthUser"]>[0]) => {
        capturedLogin = request;
        return {
          sessionToken: "session-from-oauth",
          expiresAt: "2026-06-09T12:00:00.000Z",
          user: {
            userId: "user-webmaster",
            email: request.email,
            displayName: request.displayName ?? "PYROSA Webmaster",
            status: "active",
            globalRoles: ["platform_admin"],
            tenantMemberships: []
          }
        };
      }
    } as unknown as ControlPlaneStore
  }));

  try {
    const response = await invokeRequestHandler(handler, {
      method: "POST",
      url: "/v1/auth/pyrosa-accounts/oauth-login",
      headers: {
        "content-type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        code: "human-code",
        redirectUri: "https://vps-prd.pyrosa.com.do:3200/auth/pyrosa-accounts/callback",
        codeVerifier: "pkce-verifier"
      })
    });

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.bodyText) as {
      sessionToken: string;
      oauthLogoutToken: string;
    };
    assert.equal(payload.sessionToken, "session-from-oauth");
    assert.equal(payload.oauthLogoutToken, "human-access-token");
    assert.deepEqual(capturedLogin, {
      provider: "pyrosa-accounts",
      email: "webmaster@pyrosa.com.do",
      username: "webmaster@pyrosa.com.do",
      displayName: "PYROSA Webmaster",
      externalSubject: "42",
      mfaSatisfied: true,
      assuranceLevel: "aal2",
      clientId: "oauth-smoke",
      scopes: ["profile:read", "mfa:read"],
      audience: "simplehost-control",
      issuer: "https://accounts.pyrosa.com.do",
      oauthClientId: "oauth-smoke",
      oauthScopes: ["profile:read", "mfa:read"],
      oauthTokenHash: hashTokenForTest("human-access-token"),
      oauthIssuer: "https://accounts.pyrosa.com.do"
    });
    assert.equal(oauth.tokenBodies.length, 1);
    assert.equal(oauth.introspectionBodies.length, 1);
    assert.equal(oauth.revocationBodies.length, 0);
  } finally {
    await oauth.close();
  }
});

test("Pyrosa Accounts OAuth login fails closed before local session when AAL is too low", async () => {
  const server = createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/oauth/token") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        access_token: "low-aal-token",
        token_type: "Bearer"
      }));
      return;
    }

    if (request.method === "POST" && request.url === "/oauth/introspect") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        active: true,
        token_type: "access_token",
        client_id: "oauth-smoke",
        scope: "profile:read mfa:read",
        aud: "simplehost-control",
        username: "webmaster@pyrosa.com.do",
        principal_type: "human",
        assurance_level: "aal1"
      }));
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const handler = createControlApiHttpHandler(createApiRequestHandler({
      config: createConfig({
        loginEnabled: true,
        tokenUrl: `${baseUrl}/oauth/token`,
        introspectionUrl: `${baseUrl}/oauth/introspect`,
        loginRequiredAssuranceLevel: "aal2"
      }),
      startedAt: Date.now() - 1000,
      controlPlaneStore: {
        loginOAuthUser: async () => {
          throw new Error("local session should not be created");
        },
        recordOAuthLoginRejected: async () => {
          // Expected path for low AAL.
        }
      } as unknown as ControlPlaneStore
    }));

    const response = await invokeRequestHandler(handler, {
      method: "POST",
      url: "/v1/auth/pyrosa-accounts/oauth-login",
      headers: {
        "content-type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        code: "human-code",
        redirectUri: "https://vps-prd.pyrosa.com.do:3200/auth/pyrosa-accounts/callback",
        codeVerifier: "pkce-verifier"
      })
    });

    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.bodyText).error, "insufficient_assurance");
  } finally {
    await closeHttpServer(server);
  }
});

test("Pyrosa Accounts OAuth login rejects identities without an active local operator", async () => {
  const oauth = await startOAuthPilotServer();
  let rejection: Parameters<ControlPlaneStore["recordOAuthLoginRejected"]>[0] | null = null;
  const handler = createControlApiHttpHandler(createApiRequestHandler({
    config: createConfig({
      loginEnabled: true,
      tokenUrl: `${oauth.baseUrl}/oauth/token`,
      introspectionUrl: `${oauth.baseUrl}/oauth/introspect`,
      loginScope: "profile:read mfa:read",
      loginRequiredPrincipalType: "human",
      loginRequiredAssuranceLevel: "aal2"
    }),
    startedAt: Date.now() - 1000,
    controlPlaneStore: {
      loginOAuthUser: async () => {
        const error = new Error("OAuth user is not active.");
        error.name = "UserAuthorizationError";
        throw error;
      },
      recordOAuthLoginRejected: async (
        request: Parameters<ControlPlaneStore["recordOAuthLoginRejected"]>[0]
      ) => {
        rejection = request;
      }
    } as unknown as ControlPlaneStore
  }));

  try {
    const response = await invokeRequestHandler(handler, {
      method: "POST",
      url: "/v1/auth/pyrosa-accounts/oauth-login",
      headers: {
        "content-type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        code: "human-code",
        redirectUri: "https://vps-prd.pyrosa.com.do:3200/auth/pyrosa-accounts/callback",
        codeVerifier: "pkce-verifier"
      })
    });

    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.bodyText).error, "local_operator_not_active");
    assert.deepEqual(rejection, {
      provider: "pyrosa-accounts",
      reason: "local_operator_not_active",
      email: "webmaster@pyrosa.com.do",
      clientId: "oauth-smoke",
      externalSubject: "42",
      assuranceLevel: "aal2"
    });
  } finally {
    await oauth.close();
  }
});

test("Pyrosa Accounts OAuth login can require a provider group before local session", async () => {
  const server = createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/oauth/token") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        access_token: "no-group-token",
        token_type: "Bearer"
      }));
      return;
    }

    if (request.method === "POST" && request.url === "/oauth/introspect") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({
        active: true,
        token_type: "access_token",
        client_id: "oauth-smoke",
        scope: "profile:read mfa:read",
        aud: "simplehost-control",
        username: "webmaster@pyrosa.com.do",
        principal_type: "human",
        assurance_level: "aal2",
        groups: ["Auditors"]
      }));
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const handler = createControlApiHttpHandler(createApiRequestHandler({
      config: createConfig({
        loginEnabled: true,
        tokenUrl: `${baseUrl}/oauth/token`,
        introspectionUrl: `${baseUrl}/oauth/introspect`,
        loginRequiredGroup: "PYROSA Operators"
      }),
      startedAt: Date.now() - 1000,
      controlPlaneStore: {
        loginOAuthUser: async () => {
          throw new Error("local session should not be created");
        },
        recordOAuthLoginRejected: async () => {
          // Expected path for missing provider group.
        }
      } as unknown as ControlPlaneStore
    }));

    const response = await invokeRequestHandler(handler, {
      method: "POST",
      url: "/v1/auth/pyrosa-accounts/oauth-login",
      headers: {
        "content-type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        code: "human-code",
        redirectUri: "https://vps-prd.pyrosa.com.do:3200/auth/pyrosa-accounts/callback",
        codeVerifier: "pkce-verifier"
      })
    });

    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.bodyText).error, "missing_provider_group");
  } finally {
    await closeHttpServer(server);
  }
});

test("Pyrosa Accounts OAuth revoke endpoint revokes token and audits token hash", async () => {
  const revocationBodies: URLSearchParams[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));

    if (request.method === "POST" && request.url === "/oauth/revoke") {
      revocationBodies.push(body);
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ revoked: true }));
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let capturedAudit: unknown;
  let capturedBearerToken: string | null = null;

  try {
    const handler = createControlApiHttpHandler(createApiRequestHandler({
      config: createConfig({
        revocationUrl: `${baseUrl}/oauth/revoke`
      }),
      startedAt: Date.now() - 1000,
      controlPlaneStore: {
        recordOAuthTokenRevoked: async (
          request: Parameters<ControlPlaneStore["recordOAuthTokenRevoked"]>[0],
          presentedToken: string | null
        ) => {
          capturedAudit = request;
          capturedBearerToken = presentedToken;
        }
      } as unknown as ControlPlaneStore
    }));

    const response = await invokeRequestHandler(handler, {
      method: "POST",
      url: "/v1/auth/pyrosa-accounts/oauth-revoke",
      headers: {
        authorization: "Bearer local-session-token",
        "content-type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        token: "human-access-token"
      })
    });

    assert.equal(response.statusCode, 200);
    assert.equal(revocationBodies.length, 1);
    assert.equal(revocationBodies[0]?.get("token"), "human-access-token");
    assert.deepEqual(capturedAudit, {
      provider: "pyrosa-accounts",
      tokenHash: hashTokenForTest("human-access-token"),
      clientId: "oauth-smoke"
    });
    assert.equal(capturedBearerToken, "local-session-token");
  } finally {
    await closeHttpServer(server);
  }
});

test("OAuth bearer profile fails closed when configured AAL is too low", async () => {
  const introspection = await startIntrospectionServer(() => ({
    active: true,
    token_type: "access_token",
    client_id: "oauth-smoke",
    scope: "profile:read mfa:read",
    aud: "simplehost-control",
    principal_type: "human",
    assurance_level: "aal1"
  }));

  try {
    const response = await invokeRequestHandler(
      createHandler(createConfig({
        introspectionUrl: introspection.url,
        requiredPrincipalType: "human",
        requiredAssuranceLevel: "aal2"
      })),
      {
        method: "GET",
        url: "/v1/oauth/pilot/profile",
        headers: {
          authorization: "Bearer low-aal-token"
        }
      }
    );
    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.bodyText).error, "insufficient_assurance");
  } finally {
    await introspection.close();
  }
});
