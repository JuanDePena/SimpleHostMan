export type ControlDatabaseEngine = "postgresql" | "mariadb";

export interface ControlDatabaseSettings {
  applicationName: string;
  engine: ControlDatabaseEngine;
  url: string;
  host: string;
  port: number | null;
  database: string;
}

export function detectControlDatabaseEngine(url: string): ControlDatabaseEngine {
  if (url.startsWith("mariadb://") || url.startsWith("mysql://")) {
    return "mariadb";
  }

  return "postgresql";
}

export function createControlDatabaseSettings(
  url: string,
  applicationName = "simplehost-panel"
): ControlDatabaseSettings {
  const parsed = new URL(url);

  return {
    applicationName,
    engine: detectControlDatabaseEngine(url),
    url,
    host: parsed.hostname,
    port: parsed.port ? Number.parseInt(parsed.port, 10) : null,
    database: parsed.pathname.replace(/^\//, "")
  };
}

export function createControlDatabaseHealthSummary(url: string): Record<string, unknown> {
  const settings = createControlDatabaseSettings(url);

  return {
    applicationName: settings.applicationName,
    engine: settings.engine,
    host: settings.host,
    port: settings.port,
    database: settings.database
  };
}

export {
  getAppliedControlMigrations,
  runControlDatabaseMigrations,
  type ControlDatabaseMigrationPlan,
  type ControlDatabaseMigrationRecord
} from "./migrations.js";
export {
  createPostgresControlPlaneStore,
  NodeAuthorizationError,
  UserAuthorizationError,
  type ControlPlaneStore,
  type ControlPlaneStoreOptions
} from "./control-plane-store.js";
