import { Pool } from "pg";

import { ensureBootstrapAdmin, createControlPlaneAuthMethods } from "./control-plane-store-auth.js";
import { deriveJobPayloadKey } from "./control-plane-store-helpers.js";
import { createControlPlaneOperationsMethods } from "./control-plane-store-operations.js";
import { createControlPlaneSpecMethods } from "./control-plane-store-spec.js";
import {
  NodeAuthorizationError,
  UserAuthorizationError,
  type PanelControlPlaneStore,
  type PanelControlPlaneStoreOptions
} from "./control-plane-store-types.js";
import { runPanelDatabaseMigrations } from "./migrations.js";

export {
  NodeAuthorizationError,
  UserAuthorizationError,
  type PanelControlPlaneStore,
  type PanelControlPlaneStoreOptions
};

export async function createPostgresControlPlaneStore(
  databaseUrl: string,
  options: PanelControlPlaneStoreOptions
): Promise<PanelControlPlaneStore> {
  const pollIntervalMs = options.pollIntervalMs ?? 5000;
  const jobPayloadKey = deriveJobPayloadKey(options.jobPayloadSecret);
  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: "simplehost-panel-api"
  });

  await runPanelDatabaseMigrations(pool);
  await ensureBootstrapAdmin(pool, options);

  return {
    ...createControlPlaneAuthMethods({
      pool,
      options,
      pollIntervalMs,
      jobPayloadKey
    }),
    ...createControlPlaneSpecMethods({
      pool,
      options,
      jobPayloadKey
    }),
    ...createControlPlaneOperationsMethods({
      pool,
      jobPayloadKey
    }),
    async close() {
      await pool.end();
    }
  };
}
