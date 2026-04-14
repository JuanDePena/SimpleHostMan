import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "pg";

import type {
  AuditEventInput
} from "./control-plane-store-types.js";

export async function withTransaction<T>(
  pool: Pool,
  action: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function insertAuditEvent(
  client: PoolClient,
  input: AuditEventInput
): Promise<void> {
  await client.query(
    `INSERT INTO shp_audit_events (
       event_id,
       actor_type,
       actor_id,
       event_type,
       entity_type,
       entity_id,
       payload,
       occurred_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [
      randomUUID(),
      input.actorType,
      input.actorId ?? null,
      input.eventType,
      input.entityType ?? null,
      input.entityId ?? null,
      JSON.stringify(input.payload ?? {}),
      input.occurredAt ?? new Date().toISOString()
    ]
  );
}
