import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createPanelRuntimeConfig } from "@simplehost/panel-config";

import { renderLoginPage } from "./auth-pages.js";
import { createDashboardHandler } from "./dashboard-page-routes.js";
import { startPanelWebServer } from "./web-routes.js";

const config = createPanelRuntimeConfig();
const startedAt = Date.now();

const handleDashboard = createDashboardHandler({
  defaultImportPath: config.inventory.importPath,
  renderLoginPage,
  version: config.version
});

export function startPanelWeb(): ReturnType<typeof startPanelWebServer> {
  return startPanelWebServer({
    config,
    handleDashboard,
    renderLoginPage,
    startedAt
  });
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
  const server = startPanelWeb();

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      server.close(() => {
        process.exit(0);
      });
    });
  }
}
