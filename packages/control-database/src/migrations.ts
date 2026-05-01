import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Pool, type PoolClient } from "pg";

export interface ControlDatabaseMigrationRecord {
  version: string;
  checksum: string;
  appliedAt: string;
}

export interface ControlDatabaseMigrationPlan {
  version: string;
  filename: string;
  checksum: string;
  sql: string;
}

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

const migrationsTableName = "control_plane_schema_migrations";
const legacyMigrationsTableName = "shp_schema_migrations";

function migrationsTableStatement(tableName: string): string {
  return `CREATE TABLE IF NOT EXISTS ${tableName} (
  version TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;
}

async function relationExists(client: Queryable, relationName: string): Promise<boolean> {
  const result = await client.query<{ relation: string | null }>(
    `SELECT to_regclass($1)::text AS relation`,
    [`public.${relationName}`]
  );

  return result.rows[0]?.relation !== null;
}

async function resolveMigrationsTable(client: Queryable): Promise<string> {
  if (await relationExists(client, migrationsTableName)) {
    return migrationsTableName;
  }

  if (await relationExists(client, legacyMigrationsTableName)) {
    return legacyMigrationsTableName;
  }

  await client.query(migrationsTableStatement(migrationsTableName));
  return migrationsTableName;
}

function getPackageRoot(): string {
  return path.resolve(fileURLToPath(new URL("..", import.meta.url)));
}

async function readMigrationPlans(): Promise<ControlDatabaseMigrationPlan[]> {
  const migrationsDirectory = path.join(getPackageRoot(), "migrations");
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

  const plans: ControlDatabaseMigrationPlan[] = [];

  for (const filename of files) {
    const sql = await readFile(path.join(migrationsDirectory, filename), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const [version] = filename.split("_", 1);

    plans.push({
      version: version ?? filename,
      filename,
      checksum,
      sql
    });
  }

  return plans;
}

async function withTransaction<T>(
  client: PoolClient,
  action: () => Promise<T>
): Promise<T> {
  await client.query("BEGIN");

  try {
    const result = await action();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function getAppliedControlMigrations(
  pool: Pool
): Promise<ControlDatabaseMigrationRecord[]> {
  const tableName = await resolveMigrationsTable(pool);

  const result = await pool.query<{
    version: string;
    checksum: string;
    applied_at: Date | string;
  }>(
    `SELECT version, checksum, applied_at
     FROM ${tableName}
     ORDER BY version ASC`
  );

  return result.rows.map((row) => ({
    version: row.version,
    checksum: row.checksum,
    appliedAt:
      row.applied_at instanceof Date
        ? row.applied_at.toISOString()
        : new Date(row.applied_at).toISOString()
  }));
}

export async function runControlDatabaseMigrations(
  pool: Pool
): Promise<ControlDatabaseMigrationRecord[]> {
  await resolveMigrationsTable(pool);

  const appliedMigrations = new Map(
    (await getAppliedControlMigrations(pool)).map((migration) => [
      migration.version,
      migration
    ])
  );
  const plans = await readMigrationPlans();

  for (const plan of plans) {
    const applied = appliedMigrations.get(plan.version);

    if (applied) {
      if (applied.checksum !== plan.checksum) {
        throw new Error(
          `Migration checksum mismatch for version ${plan.version}. Applied checksum ${applied.checksum} does not match ${plan.checksum}.`
        );
      }

      continue;
    }

    const client = await pool.connect();

    try {
      await withTransaction(client, async () => {
        await client.query(plan.sql);
        const tableName = await resolveMigrationsTable(client);
        await client.query(
          `INSERT INTO ${tableName} (version, checksum)
           VALUES ($1, $2)`,
          [plan.version, plan.checksum]
        );
      });
    } finally {
      client.release();
    }
  }

  return getAppliedControlMigrations(pool);
}
