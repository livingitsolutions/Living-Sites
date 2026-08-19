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
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import { getDatabase } from "@netlify/database";
import postgres from "postgres";
import * as schema from "../../db/schema.js";
export class MissingNetlifyDatabaseError extends Error {
    constructor(message) {
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
export function createNetlifyDatabase(config = {}) {
    if (config.connectionString) {
        const client = postgres(config.connectionString);
        const db = drizzlePostgresJs(client, { schema });
        return {
            db,
            async close() {
                await client.end();
            },
        };
    }
    const connection = getDatabase();
    if (!connection) {
        throw new MissingNetlifyDatabaseError("Netlify Database connection could not be established. " +
            "Ensure @netlify/database is installed and the database is provisioned, " +
            "or provide a connectionString for local development.");
    }
    const db = drizzlePostgres(connection.pool, { schema });
    return {
        db,
        async close() {
            // The pg.Pool manages its own lifecycle; closing is handled by the caller.
            // In serverless contexts, connections are automatically managed.
        },
    };
}
//# sourceMappingURL=index.js.map