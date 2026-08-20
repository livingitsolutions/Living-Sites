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
import { createTenantContextRunner, tenantDatabase } from "./tenant-context.js";
export async function createTestDatabaseHarness(migrationsDir = "./netlify/database/migrations") {
    const netlifyDB = new NetlifyDB({
        directory: undefined,
        logger: () => { },
    });
    let sqlClient;
    let db;
    let connectionString = "";
    async function start() {
        connectionString = await netlifyDB.start();
        await netlifyDB.applyMigrations(migrationsDir);
        sqlClient = postgres(connectionString, { max: 1 });
        await sqlClient `select set_config('app.context_mode', 'internal', false)`;
        await sqlClient `select set_config('app.tenant_authorized', 'true', false)`;
        db = drizzle({ client: sqlClient, schema });
    }
    async function stop() {
        if (sqlClient)
            await sqlClient.end();
        await netlifyDB.stop();
    }
    async function reset() {
        if (!db)
            return;
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
//# sourceMappingURL=test-harness.js.map