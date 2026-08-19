import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { NetlifyDB } from "@netlify/database-dev";
import { NoopLogger } from "@livingsites/platform";
import { DrizzleSuperAdminStore } from "./drizzle-super-admin-store.js";
import { platformSuperAdmins, platformUsers } from "../../db/schema.js";
import * as schema from "../../db/schema.js";
import type { DrizzleDB } from "../../db/drizzle-instance.js";

describe("Platform Super Admin Bootstrap — integration", () => {
  let netlifyDB: NetlifyDB;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let store: DrizzleSuperAdminStore;
  let secondStore: DrizzleSuperAdminStore;

  beforeAll(async () => {
    netlifyDB = new NetlifyDB({ logger: () => {} });
    await netlifyDB.start();
    await netlifyDB.applyMigrations("./netlify/database/migrations");
    const embeddedDatabase = (netlifyDB as unknown as { db: Parameters<typeof drizzle>[0] }).db;
    db = drizzle(embeddedDatabase, { schema });
    const repositoryDb = db as unknown as DrizzleDB;
    store = new DrizzleSuperAdminStore({ db: repositoryDb, logger: new NoopLogger() });
    secondStore = new DrizzleSuperAdminStore({ db: repositoryDb, logger: new NoopLogger() });
  });

  afterAll(async () => {
    if (netlifyDB) await netlifyDB.stop();
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
    if (!res1.ok) return;
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
    if (!res2.ok) return;
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

  it("concurrent different-email bootstraps establish exactly one super admin", async () => {
    const [first, second] = await Promise.all([
      store.bootstrap({ email: "concurrent-first@platform.test" }),
      secondStore.bootstrap({ email: "concurrent-second@platform.test" }),
    ]);

    expect(Number(first.ok) + Number(second.ok)).toBe(1);
    const rejected = first.ok ? second : first;
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe("bootstrap_locked");
    expect(await db.select().from(platformSuperAdmins)).toHaveLength(1);
    expect(await db.select().from(platformUsers)).toHaveLength(1);
  });
});
