import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http, { request } from "node:http";
import { once } from "node:events";
import { test } from "node:test";

const bridgePath = new URL("./pyrosa-iam-gateway-bridge.mjs", import.meta.url);
const trustedSecret = "test-only-forward-auth-secret-with-32-bytes";

test("replaces an inbound gateway secret and strips it before the upstream", async (t) => {
  let iamHeaders;
  let upstreamHeaders;
  const iam = http.createServer((req, res) => {
    iamHeaders = req.headers;
    res.statusCode = 204;
    res.setHeader("X-Pyrosa-IAM-Mfa", "true");
    res.setHeader("X-Pyrosa-IAM-Assurance-Level", "aal2");
    res.setHeader("X-Pyrosa-IAM-Groups", "PYROSA Operators");
    res.end();
  });
  const upstream = http.createServer((req, res) => {
    upstreamHeaders = req.headers;
    res.statusCode = 200;
    res.end("upstream ok\n");
  });
  await Promise.all([listen(iam), listen(upstream)]);
  t.after(() => Promise.all([close(iam), close(upstream)]));

  const bridgePort = await freePort();
  const child = startBridge({
    bridgePort,
    checkPort: iam.address().port,
    upstreamPort: upstream.address().port
  });
  t.after(() => stop(child));
  await waitForHealth(bridgePort, child);

  const response = await httpRequest({
    port: bridgePort,
    path: "/",
    headers: {
      Host: "pgadmin.pyrosa.com.do",
      "X-Pyrosa-IAM-Gateway-Secret": "attacker-controlled"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, "upstream ok\n");
  assert.equal(iamHeaders["x-pyrosa-iam-gateway-secret"], trustedSecret);
  assert.equal(upstreamHeaders["x-pyrosa-iam-gateway-secret"], undefined);
});

test("fails at startup when the trusted proxy secret is absent", async () => {
  const child = spawn(process.execPath, [bridgePath.pathname], {
    env: {
      ...process.env,
      PYROSA_IAM_GATEWAY_BRIDGE_LISTEN_HOST: "127.0.0.1",
      PYROSA_IAM_GATEWAY_BRIDGE_LISTEN_PORT: String(await freePort()),
      PYROSA_IAM_GATEWAY_CHECK_URL: "http://127.0.0.1:9/oauth/gateway/check",
      PYROSA_IAM_GATEWAY_UPSTREAM_URL: "http://127.0.0.1:9",
      PYROSA_IAM_GATEWAY_LOGIN_URL: "https://iam.pyrosa.com.do/oauth/gateway/start",
      PYROSA_IAM_GATEWAY_PUBLIC_URL: "https://pgadmin.pyrosa.com.do/",
      PYROSA_IAM_GATEWAY_TRUSTED_PROXY_SECRET: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const stderr = [];
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  const [code] = await once(child, "exit");

  assert.notEqual(code, 0);
  assert.match(Buffer.concat(stderr).toString(), /must contain at least 32 bytes/);
});

function startBridge({ bridgePort, checkPort, upstreamPort }) {
  return spawn(process.execPath, [bridgePath.pathname], {
    env: {
      ...process.env,
      PYROSA_IAM_GATEWAY_BRIDGE_LISTEN_HOST: "127.0.0.1",
      PYROSA_IAM_GATEWAY_BRIDGE_LISTEN_PORT: String(bridgePort),
      PYROSA_IAM_GATEWAY_CHECK_URL: `http://127.0.0.1:${checkPort}/oauth/gateway/check`,
      PYROSA_IAM_GATEWAY_UPSTREAM_URL: `http://127.0.0.1:${upstreamPort}`,
      PYROSA_IAM_GATEWAY_LOGIN_URL: "https://iam.pyrosa.com.do/oauth/gateway/start",
      PYROSA_IAM_GATEWAY_PUBLIC_URL: "https://pgadmin.pyrosa.com.do/",
      PYROSA_IAM_GATEWAY_REQUIRED_GROUP: "PYROSA Operators",
      PYROSA_IAM_GATEWAY_REQUIRE_MFA: "true",
      PYROSA_IAM_GATEWAY_TRUSTED_PROXY_SECRET: trustedSecret
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
}

async function close(server) {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}

async function freePort() {
  const server = http.createServer();
  await listen(server);
  const port = server.address().port;
  await close(server);
  return port;
}

async function waitForHealth(port, child) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`bridge exited before health check with code ${child.exitCode}`);
    }
    try {
      const response = await httpRequest({
        port,
        path: "/__pyrosa_iam_gateway_health"
      });
      if (response.statusCode === 200) return;
    } catch {
      // The bridge may still be binding its loopback listener.
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("bridge did not become healthy");
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await once(child, "exit");
}

function httpRequest({ port, path, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: "127.0.0.1",
        port,
        path,
        headers
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString()
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}
