import { realpathSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

import { createPanelRuntimeConfig } from "@simplehost/panel-config";
import {
  createPostgresControlPlaneStore,
  NodeAuthorizationError,
  UserAuthorizationError
} from "@simplehost/panel-database";

import { writeJson } from "./api-http.js";
import { createApiRequestHandler } from "./api-routes.js";

const startedAt = Date.now();
const config = createPanelRuntimeConfig();

export async function createPanelApiRuntime(): Promise<{
  server: ReturnType<typeof createServer>;
  close: () => Promise<void>;
}> {
  const controlPlaneStore = await createPostgresControlPlaneStore(
    config.database.url,
    {
      pollIntervalMs: config.worker.pollIntervalMs,
      bootstrapEnrollmentToken: config.auth.bootstrapEnrollmentToken,
      sessionTtlSeconds: config.auth.sessionTtlSeconds,
      bootstrapAdminEmail: config.auth.bootstrapAdminEmail,
      bootstrapAdminPassword: config.auth.bootstrapAdminPassword,
      bootstrapAdminName: config.auth.bootstrapAdminName,
      defaultInventoryImportPath: config.inventory.importPath,
      jobPayloadSecret: config.jobs.payloadSecret
    }
  );
  const requestHandler = createApiRequestHandler({
    config,
    startedAt,
    controlPlaneStore
  });
  const server = createServer((request, response) => {
    void requestHandler(request, response).catch((error: unknown) => {
      if (error instanceof NodeAuthorizationError) {
        writeJson(response, 401, {
          error: "Unauthorized",
          message: error.message
        });
        return;
      }

      if (error instanceof UserAuthorizationError) {
        writeJson(
          response,
          error.message.includes("required role") ? 403 : 401,
          {
            error: error.message.includes("required role") ? "Forbidden" : "Unauthorized",
            message: error.message
          }
        );
        return;
      }

      writeJson(response, 500, {
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error)
      });
    });
  });

  server.listen(config.api.port, config.api.host, () => {
    console.log(`SHP API listening on http://${config.api.host}:${config.api.port}`);
  });

  return {
    server,
    close: async () => {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
      await controlPlaneStore.close();
    }
  };
}

export async function startPanelApi(): Promise<ReturnType<typeof createServer>> {
  const runtime = await createPanelApiRuntime();
  return runtime.server;
}

function isMainModule(): boolean {
  if (process.argv[1] === undefined) {
    return false;
  }

  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return fileURLToPath(import.meta.url) === process.argv[1];
  }
}

if (isMainModule()) {
  createPanelApiRuntime()
    .then(({ close, server }) => {
      for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.on(signal, () => {
          void close().finally(() => {
            if (server.listening) {
              server.unref();
            }
            process.exit(0);
          });
        });
      }
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
