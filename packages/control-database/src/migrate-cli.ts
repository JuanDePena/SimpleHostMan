import { Pool } from "pg";

import { runControlDatabaseMigrations } from "./migrations.js";

function readDatabaseUrl(): string {
  const url = process.env.SIMPLEHOST_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!url || url.trim().length === 0) {
    throw new Error("SIMPLEHOST_DATABASE_URL or DATABASE_URL must be set.");
  }

  return url.trim();
}

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: readDatabaseUrl(),
    application_name: "simplehost-control-migrate"
  });

  try {
    const applied = await runControlDatabaseMigrations(pool);
    console.log(
      JSON.stringify(
        {
          appliedMigrations: applied.length,
          latestVersion: applied.at(-1)?.version ?? null
        },
        null,
        2
      )
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
