import { readFileSync } from "node:fs";

export interface ControlListenerConfig {
  host: string;
  port: number;
}

export interface ControlWorkerConfig {
  pollIntervalMs: number;
  reconciliationIntervalMs: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

export interface ControlDatabaseRuntimeConfig {
  url: string;
}

export interface ControlAuthRuntimeConfig {
  bootstrapEnrollmentToken: string | null;
  bootstrapAdminEmail: string | null;
  bootstrapAdminPassword: string | null;
  bootstrapAdminName: string | null;
  sessionTtlSeconds: number;
}

export interface ControlJobRuntimeConfig {
  payloadSecret: string | null;
}

export interface ControlRustDeskRuntimeConfig {
  publicHostname: string | null;
  txtRecordFqdn: string | null;
  primaryNodeId: string | null;
  primaryDnsTarget: string | null;
  secondaryNodeId: string | null;
  secondaryDnsTarget: string | null;
}

export interface ControlOAuthResourceServerRuntimeConfig {
  enabled: boolean;
  issuer: string | null;
  authorizationUrl: string | null;
  tokenUrl: string | null;
  introspectionUrl: string | null;
  revocationUrl: string | null;
  clientId: string | null;
  clientSecret: string | null;
  clientSecretFile: string | null;
  requiredScope: string | null;
  requiredAudience: string | null;
  requiredPrincipalType: string | null;
  requiredAssuranceLevel: string | null;
  pilotRedirectUri: string | null;
  pilotScope: string | null;
  pilotRequiredPrincipalType: string | null;
  pilotRequiredAssuranceLevel: string | null;
  pilotRevokeTokens: boolean;
  loginEnabled: boolean;
  loginRedirectUri: string | null;
  loginScope: string | null;
  loginRequiredPrincipalType: string | null;
  loginRequiredAssuranceLevel: string | null;
  loginRequiredGroup: string | null;
  loginLogoutUrl: string | null;
  loginPostLogoutRedirectUri: string | null;
  introspectionTimeoutMs: number;
}

export interface ControlRuntimeConfig {
  env: string;
  version: string;
  api: ControlListenerConfig;
  web: ControlListenerConfig;
  worker: ControlWorkerConfig;
  database: ControlDatabaseRuntimeConfig;
  auth: ControlAuthRuntimeConfig;
  jobs: ControlJobRuntimeConfig;
  rustdesk: ControlRustDeskRuntimeConfig;
  oauthResourceServer: ControlOAuthResourceServerRuntimeConfig;
}

function readPackageVersion(fallback: string): string {
  try {
    const payload = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as { version?: string };
    return typeof payload.version === "string" && payload.version.trim().length > 0
      ? payload.version.trim()
      : fallback;
  } catch {
    return fallback;
  }
}

function readString(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function readPort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    return fallback;
  }

  return parsed;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function readOptionalString(value: string | undefined): string | null {
  return value && value.trim().length > 0 ? value.trim() : null;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return fallback;
  }
}

export function createControlRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env
): ControlRuntimeConfig {
  const defaultVersion = readPackageVersion("0000.00.00");

  return {
    env: readString(env.NODE_ENV, "development"),
    version: readString(env.SIMPLEHOST_VERSION, defaultVersion),
    api: {
      host: readString(env.SIMPLEHOST_API_HOST, "127.0.0.1"),
      port: readPort(env.SIMPLEHOST_API_PORT, 3100)
    },
    web: {
      host: readString(env.SIMPLEHOST_WEB_HOST, "127.0.0.1"),
      port: readPort(env.SIMPLEHOST_WEB_PORT, 3200)
    },
    worker: {
      pollIntervalMs: readPositiveInt(env.SIMPLEHOST_WORKER_POLL_INTERVAL_MS, 5000),
      reconciliationIntervalMs: readPositiveInt(
        env.SIMPLEHOST_WORKER_RECONCILE_INTERVAL_MS,
        5 * 60 * 1000
      ),
      logLevel: readString(env.SIMPLEHOST_LOG_LEVEL, "info") as ControlWorkerConfig["logLevel"]
    },
    database: {
      url: readString(
        env.SIMPLEHOST_DATABASE_URL,
        "postgresql://simplehost_control:change-me@127.0.0.1:5433/simplehost_control"
      )
    },
    auth: {
      bootstrapEnrollmentToken: readOptionalString(env.SIMPLEHOST_BOOTSTRAP_ENROLLMENT_TOKEN),
      bootstrapAdminEmail: readOptionalString(env.SIMPLEHOST_BOOTSTRAP_ADMIN_EMAIL),
      bootstrapAdminPassword: readOptionalString(env.SIMPLEHOST_BOOTSTRAP_ADMIN_PASSWORD),
      bootstrapAdminName: readOptionalString(env.SIMPLEHOST_BOOTSTRAP_ADMIN_NAME),
      sessionTtlSeconds: readPositiveInt(env.SIMPLEHOST_SESSION_TTL_SECONDS, 43200)
    },
    jobs: {
      payloadSecret:
        readOptionalString(env.SIMPLEHOST_JOB_SECRET_KEY) ??
        readOptionalString(env.SIMPLEHOST_BOOTSTRAP_ENROLLMENT_TOKEN)
    },
    rustdesk: {
      publicHostname: readOptionalString(env.SIMPLEHOST_RUSTDESK_PUBLIC_HOSTNAME),
      txtRecordFqdn: readOptionalString(env.SIMPLEHOST_RUSTDESK_TXT_FQDN),
      primaryNodeId: readOptionalString(env.SIMPLEHOST_RUSTDESK_PRIMARY_NODE_ID),
      primaryDnsTarget: readOptionalString(env.SIMPLEHOST_RUSTDESK_PRIMARY_DNS_TARGET),
      secondaryNodeId: readOptionalString(env.SIMPLEHOST_RUSTDESK_SECONDARY_NODE_ID),
      secondaryDnsTarget: readOptionalString(env.SIMPLEHOST_RUSTDESK_SECONDARY_DNS_TARGET)
    },
    oauthResourceServer: {
      enabled: readBoolean(env.SIMPLEHOST_OAUTH_RESOURCE_SERVER_ENABLED, false),
      issuer: readOptionalString(env.SIMPLEHOST_OAUTH_ISSUER),
      authorizationUrl: readOptionalString(env.SIMPLEHOST_OAUTH_AUTHORIZATION_URL),
      tokenUrl: readOptionalString(env.SIMPLEHOST_OAUTH_TOKEN_URL),
      introspectionUrl: readOptionalString(env.SIMPLEHOST_OAUTH_INTROSPECTION_URL),
      revocationUrl: readOptionalString(env.SIMPLEHOST_OAUTH_REVOCATION_URL),
      clientId: readOptionalString(env.SIMPLEHOST_OAUTH_CLIENT_ID),
      clientSecret: readOptionalString(env.SIMPLEHOST_OAUTH_CLIENT_SECRET),
      clientSecretFile: readOptionalString(env.SIMPLEHOST_OAUTH_CLIENT_SECRET_FILE),
      requiredScope: readOptionalString(env.SIMPLEHOST_OAUTH_REQUIRED_SCOPE),
      requiredAudience: readOptionalString(env.SIMPLEHOST_OAUTH_REQUIRED_AUDIENCE),
      requiredPrincipalType: readOptionalString(env.SIMPLEHOST_OAUTH_REQUIRED_PRINCIPAL_TYPE),
      requiredAssuranceLevel: readOptionalString(env.SIMPLEHOST_OAUTH_REQUIRED_ASSURANCE_LEVEL),
      pilotRedirectUri: readOptionalString(env.SIMPLEHOST_OAUTH_PILOT_REDIRECT_URI),
      pilotScope: readOptionalString(env.SIMPLEHOST_OAUTH_PILOT_SCOPE),
      pilotRequiredPrincipalType: readOptionalString(env.SIMPLEHOST_OAUTH_PILOT_REQUIRED_PRINCIPAL_TYPE),
      pilotRequiredAssuranceLevel: readOptionalString(env.SIMPLEHOST_OAUTH_PILOT_REQUIRED_ASSURANCE_LEVEL),
      pilotRevokeTokens: readBoolean(env.SIMPLEHOST_OAUTH_PILOT_REVOKE_TOKENS, true),
      loginEnabled: readBoolean(env.SIMPLEHOST_OAUTH_LOGIN_ENABLED, false),
      loginRedirectUri: readOptionalString(env.SIMPLEHOST_OAUTH_LOGIN_REDIRECT_URI),
      loginScope: readOptionalString(env.SIMPLEHOST_OAUTH_LOGIN_SCOPE),
      loginRequiredPrincipalType: readOptionalString(env.SIMPLEHOST_OAUTH_LOGIN_REQUIRED_PRINCIPAL_TYPE),
      loginRequiredAssuranceLevel: readOptionalString(env.SIMPLEHOST_OAUTH_LOGIN_REQUIRED_ASSURANCE_LEVEL),
      loginRequiredGroup: readOptionalString(env.SIMPLEHOST_OAUTH_LOGIN_REQUIRED_GROUP),
      loginLogoutUrl: readOptionalString(env.SIMPLEHOST_OAUTH_LOGIN_LOGOUT_URL),
      loginPostLogoutRedirectUri: readOptionalString(env.SIMPLEHOST_OAUTH_LOGIN_POST_LOGOUT_REDIRECT_URI),
      introspectionTimeoutMs: readPositiveInt(
        env.SIMPLEHOST_OAUTH_INTROSPECTION_TIMEOUT_MS,
        3000
      )
    }
  };
}
