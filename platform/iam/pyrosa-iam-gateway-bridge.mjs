#!/usr/bin/env node
import http from "node:http";
import https from "node:https";

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

const identityHeaderMap = new Map([
  ["x-pyrosa-iam-gateway", "X-Pyrosa-IAM-Gateway"],
  ["x-pyrosa-iam-user-id", "X-Pyrosa-IAM-User-Id"],
  ["x-pyrosa-iam-email", "X-Pyrosa-IAM-Email"],
  ["x-pyrosa-iam-username", "X-Pyrosa-IAM-Username"],
  ["x-pyrosa-iam-role", "X-Pyrosa-IAM-Role"],
  ["x-pyrosa-iam-groups", "X-Pyrosa-IAM-Groups"],
  ["x-pyrosa-iam-assurance-level", "X-Pyrosa-IAM-Assurance-Level"],
  ["x-pyrosa-iam-mfa", "X-Pyrosa-IAM-Mfa"]
]);

const config = {
  listenHost: env("PYROSA_IAM_GATEWAY_BRIDGE_LISTEN_HOST", "127.0.0.1"),
  listenPort: Number(env("PYROSA_IAM_GATEWAY_BRIDGE_LISTEN_PORT", "10144")),
  checkUrl: requiredUrl("PYROSA_IAM_GATEWAY_CHECK_URL"),
  upstreamUrl: requiredUrl("PYROSA_IAM_GATEWAY_UPSTREAM_URL"),
  loginUrl: requiredUrl("PYROSA_IAM_GATEWAY_LOGIN_URL"),
  publicUrl: requiredUrl("PYROSA_IAM_GATEWAY_PUBLIC_URL"),
  requiredGroup: env("PYROSA_IAM_GATEWAY_REQUIRED_GROUP", ""),
  requireMfa: env("PYROSA_IAM_GATEWAY_REQUIRE_MFA", "true") !== "false",
  timeoutMs: Number(env("PYROSA_IAM_GATEWAY_TIMEOUT_MS", "5000"))
};

if (!Number.isInteger(config.listenPort) || config.listenPort < 1 || config.listenPort > 65535) {
  throw new Error("PYROSA_IAM_GATEWAY_BRIDGE_LISTEN_PORT must be a valid TCP port.");
}

const server = http.createServer(async (req, res) => {
  try {
    if (isLocalHealthRequest(req)) {
      sendText(res, 200, "ok\n");
      return;
    }

    const decision = await checkIamSession(req);
    if (!decision.allowed) {
      denyOrRedirect(req, res, decision.status, decision.errorCode);
      return;
    }
    if (!hasRequiredAssurance(decision.headers)) {
      denyOrRedirect(req, res, 403, "gateway_mfa_required");
      return;
    }
    if (!hasRequiredGroup(decision.headers)) {
      denyOrRedirect(req, res, 403, "gateway_group_required");
      return;
    }

    proxyToUpstream(req, res, decision.headers);
  } catch (error) {
    console.error(error);
    sendText(res, 502, "Pyrosa IAM gateway bridge failed closed.\n");
  }
});

server.listen(config.listenPort, config.listenHost, () => {
  console.log(`Pyrosa IAM gateway bridge listening on ${config.listenHost}:${config.listenPort}`);
});

function env(name, fallback) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function requiredUrl(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set.`);
  }
  return new URL(value);
}

function isLocalHealthRequest(req) {
  if (req.url !== "/__pyrosa_iam_gateway_health") {
    return false;
  }
  const remote = req.socket.remoteAddress ?? "";
  return remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
}

function checkIamSession(req) {
  const headers = sanitizeHeaders({
    Cookie: req.headers.cookie ?? "",
    "X-Forwarded-Method": req.method ?? "GET",
    "X-Forwarded-Uri": req.url ?? "/",
    "X-Forwarded-Host": req.headers.host ?? "",
    "X-Forwarded-Proto": "https"
  });

  return new Promise((resolve, reject) => {
    const client = config.checkUrl.protocol === "https:" ? https : http;
    const request = client.request(
      config.checkUrl,
      {
        method: "GET",
        headers,
        timeout: config.timeoutMs
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          const responseHeaders = normalizeHeaders(response.headers);
          resolve({
            allowed: response.statusCode === 204,
            status: response.statusCode ?? 502,
            errorCode: responseHeaders["x-pyrosa-iam-error-code"] ?? "gateway_denied",
            headers: responseHeaders
          });
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("IAM gateway check timed out."));
    });
    request.on("error", reject);
    request.end();
  });
}

function hasRequiredAssurance(headers) {
  if (!config.requireMfa) {
    return true;
  }
  return headers["x-pyrosa-iam-mfa"] === "true" &&
    headers["x-pyrosa-iam-assurance-level"] === "aal2";
}

function hasRequiredGroup(headers) {
  if (!config.requiredGroup) {
    return true;
  }
  const groups = String(headers["x-pyrosa-iam-groups"] ?? "")
    .split(",")
    .map((group) => group.trim())
    .filter(Boolean);
  return groups.includes(config.requiredGroup);
}

function denyOrRedirect(req, res, status, errorCode) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Pyrosa-IAM-Gateway", "bridge");
  res.setHeader("X-Pyrosa-IAM-Error-Code", errorCode);

  if ((req.method === "GET" || req.method === "HEAD") && (status === 401 || status === 403)) {
    const redirectUrl = new URL(config.loginUrl);
    redirectUrl.searchParams.set("return_to", new URL(req.url ?? "/", config.publicUrl).toString());
    res.statusCode = 302;
    res.setHeader("Location", redirectUrl.toString());
    res.end();
    return;
  }

  sendText(res, status, "Pyrosa IAM gateway denied the request.\n");
}

function proxyToUpstream(req, res, identityHeaders) {
  const target = new URL(req.url ?? "/", config.upstreamUrl);
  const headers = sanitizeHeaders(req.headers);
  headers.host = req.headers.host ?? config.upstreamUrl.host;
  headers["x-forwarded-proto"] = "https";
  headers["x-forwarded-port"] = "443";

  for (const [lowerName, canonicalName] of identityHeaderMap.entries()) {
    const value = identityHeaders[lowerName];
    if (value) {
      headers[canonicalName] = value;
    }
  }

  const client = target.protocol === "https:" ? https : http;
  const upstreamRequest = client.request(
    target,
    {
      method: req.method,
      headers,
      timeout: config.timeoutMs
    },
    (upstreamResponse) => {
      res.statusCode = upstreamResponse.statusCode ?? 502;
      for (const [name, value] of Object.entries(upstreamResponse.headers)) {
        if (!hopByHopHeaders.has(name.toLowerCase()) && typeof value !== "undefined") {
          res.setHeader(name, value);
        }
      }
      upstreamResponse.pipe(res);
    }
  );

  upstreamRequest.on("timeout", () => {
    upstreamRequest.destroy(new Error("Upstream request timed out."));
  });
  upstreamRequest.on("error", (error) => {
    console.error(error);
    if (!res.headersSent) {
      sendText(res, 502, "Pyrosa IAM gateway upstream failed closed.\n");
    } else {
      res.destroy(error);
    }
  });

  req.pipe(upstreamRequest);
}

function sanitizeHeaders(headers) {
  const sanitized = {};
  for (const [name, value] of Object.entries(headers)) {
    const lowerName = name.toLowerCase();
    if (
      hopByHopHeaders.has(lowerName) ||
      lowerName.startsWith("x-pyrosa-iam-") ||
      lowerName.startsWith("x-pyrosa-account-") ||
      lowerName.startsWith("x-pyrosa-accounts-")
    ) {
      continue;
    }
    if (typeof value !== "undefined") {
      sanitized[name] = value;
    }
  }
  return sanitized;
}

function normalizeHeaders(headers) {
  const normalized = {};
  for (const [name, value] of Object.entries(headers)) {
    normalized[name.toLowerCase()] = Array.isArray(value) ? value.join(",") : String(value ?? "");
  }
  return normalized;
}

function sendText(res, status, message) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(message);
}
