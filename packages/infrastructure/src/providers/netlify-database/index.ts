/**
 * Netlify Database provider — creates a Drizzle client using the
 * drizzle-orm/node-postgres adapter when running inside Netlify.
 *
 * In the Netlify runtime, @netlify/database automatically provides the
 * connection — no manually copied connection string is required.
 *
 * For local development and testing, the caller can pass an explicit
 * connection string (e.g. from NETLIFY_DB_URL or @netlify/database-dev).
 *
 * This module is the ONLY place in the codebase that imports
 * @netlify/database or drizzle-orm/node-postgres. Application and Domain
 * layers never see these types.
 */
import { drizzle as drizzlePostgres, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import { getDatabase, type DatabaseConnection } from "@netlify/database";
import type { Pool } from "pg";
import postgres from "postgres";
import * as schema from "../../db/schema";
import type { DrizzleDB } from "../../db/drizzle-instance";

export type NetlifyDrizzleDB = NodePgDatabase<typeof schema> | DrizzleDB;

export interface NetlifyDatabaseProviderConfig {
  /**
   * Optional explicit connection string. When provided, used directly
   * (e.g. for local development with @netlify/database-dev).
   * When absent, @netlify/database resolves the connection automatically.
   */
  readonly connectionString?: string;
}

export interface NetlifyDatabaseProvider {
  readonly db: NetlifyDrizzleDB;
  close(): Promise<void>;
}

export class MissingNetlifyDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingNetlifyDatabaseError";
  }
}

/**
 * Creates a Drizzle client backed by Netlify Database.
 *
 * In the Netlify runtime, this uses @netlify/database's getDatabase()
 * which returns a server-side pg.Pool connection automatically configured
 * for the current environment (production or deploy preview branch).
 *
 * For local development, pass a connectionString obtained from
 * @netlify/database-dev or NETLIFY_DB_URL.
 */
export function createNetlifyDatabase(
  config: NetlifyDatabaseProviderConfig = {},
): NetlifyDatabaseProvider {
  if (config.connectionString) {
    const client = postgres(config.connectionString);
    const db = drizzlePostgresJs(client, { schema });
    return {
      db,
      async close(): Promise<void> {
        await client.end();
      },
    };
  }

  const connection: DatabaseConnection = getDatabase();

  if (!connection) {
    throw new MissingNetlifyDatabaseError(
      "Netlify Database connection could not be established. " +
        "Ensure @netlify/database is installed and the database is provisioned, " +
        "or provide a connectionString for local development.",
    );
  }

  const db = drizzlePostgres(connection.pool as unknown as Pool, { schema });

  return {
    db,
    async close(): Promise<void> {
      // The pg.Pool manages its own lifecycle; closing is handled by the caller.
      // In serverless contexts, connections are automatically managed.
    },
  };
}
