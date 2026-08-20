/**
 * Local database integration test harness using @netlify/database-dev.
 *
 * Starts a real Postgres-compatible local database, applies migrations,
 * and provides a Drizzle client for integration tests.
 */
import { NetlifyDB } from "@netlify/database-dev";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import type { DrizzleDB } from "./drizzle-instance.js";
import { createTenantContextRunner, tenantDatabase } from "./tenant-context.js";

export interface TestDatabaseHarness {
  readonly db: DrizzleDB;
  readonly sqlClient: postgres.Sql;
  readonly netlifyDB: NetlifyDB;
  readonly connectionString: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  reset(): Promise<void>;
}

export async function createTestDatabaseHarness(
  migrationsDir: string = "./netlify/database/migrations",
): Promise<TestDatabaseHarness> {
  const netlifyDB = new NetlifyDB({
    directory: undefined,
    logger: () => {},
  });

  let sqlClient: postgres.Sql;
  let db: DrizzleDB;
  let connectionString = "";

  async function start(): Promise<void> {
    connectionString = await netlifyDB.start();
    await netlifyDB.applyMigrations(migrationsDir);
    sqlClient = postgres(connectionString, { max: 1 });
    await sqlClient`select set_config('app.context_mode', 'internal', false)`;
    await sqlClient`select set_config('app.tenant_authorized', 'true', false)`;
    db = drizzle({ client: sqlClient, schema });
  }

  async function stop(): Promise<void> {
    if (sqlClient) await sqlClient.end();
    await netlifyDB.stop();
  }

  async function reset(): Promise<void> {
    if (!db) return;
    await createTenantContextRunner(db).run({ mode: "internal" }, async () => {
      const transaction = tenantDatabase(db);
      await transaction.delete(schema.pageSnapshots);
      await transaction.delete(schema.pageSections);
      await transaction.delete(schema.pages);
      await transaction.delete(schema.websites);
      await transaction.delete(schema.platformSuperAdmins);
      await transaction.delete(schema.memberships);
      await transaction.delete(schema.applicationOutbox);
      await transaction.delete(schema.planFeatureEntitlements);
      await transaction.delete(schema.features);
      await transaction.delete(schema.plans);
      await transaction.delete(schema.platformUsers);
      await transaction.delete(schema.organizations);
    });
  }

  return {
    get db() { return db; },
    get sqlClient() { return sqlClient; },
    get netlifyDB() { return netlifyDB; },
    get connectionString() { return connectionString; },
    start,
    stop,
    reset,
  };
}
