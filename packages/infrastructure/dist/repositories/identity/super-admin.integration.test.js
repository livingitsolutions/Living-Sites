import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { NetlifyDB } from "@netlify/database-dev";
import { NoopLogger } from "@livingsites/platform";
import { DrizzleSuperAdminStore } from "./drizzle-super-admin-store";
import { platformSuperAdmins, platformUsers } from "../../db/schema";
import * as schema from "../../db/schema";
describe("Platform Super Admin Bootstrap — integration", () => {
    let netlifyDB;
    let db;
    let sql;
    let store;
    beforeAll(async () => {
        netlifyDB = new NetlifyDB({ logger: () => { } });
        const connectionString = await netlifyDB.start();
        await netlifyDB.applyMigrations("./netlify/database/migrations");
        sql = postgres(connectionString);
        db = drizzle({ client: sql, schema });
        store = new DrizzleSuperAdminStore({ db, logger: new NoopLogger() });
    });
    afterAll(async () => {
        if (sql)
            await sql.end();
        if (netlifyDB)
            await netlifyDB.stop();
    });
    beforeEach(async () => {
        await db.delete(platformSuperAdmins);
        await db.delete(platformUsers);
    });
    it("bootstraps the initial super admin idempotently", async () => {
        const email = "superadmin@platform.test";
        // 1. Initial bootstrap succeeds
        const res1 = await store.bootstrap({
            email,
            displayName: "Initial Super Admin",
        });
        expect(res1.ok).toBe(true);
        if (!res1.ok)
            return;
        expect(res1.value.alreadyExisted).toBe(false);
        expect(res1.value.user.email).toBe(email);
        // 2. Checking super admin status returns true
        const isSuper1 = await store.isSuperAdmin(res1.value.user.id);
        expect(isSuper1).toBe(true);
        const isSuperByEmail = await store.isSuperAdminByEmail(email);
        expect(isSuperByEmail).toBe(true);
        // 3. Repeating the bootstrap with the same email is idempotent
        const res2 = await store.bootstrap({ email });
        expect(res2.ok).toBe(true);
        if (!res2.ok)
            return;
        expect(res2.value.alreadyExisted).toBe(true);
    });
    it("cannot accidentally bootstrap a second different super admin", async () => {
        const email1 = "first-super@platform.test";
        const email2 = "second-super@platform.test";
        await store.bootstrap({ email: email1 });
        const res2 = await store.bootstrap({ email: email2 });
        expect(res2.ok).toBe(false);
        if (!res2.ok) {
            expect(res2.error.code).toBe("bootstrap_locked");
        }
    });
});
//# sourceMappingURL=super-admin.integration.test.js.map