/**
 * Orphan identity recovery test.
 *
 * Tests the scenario where a Better Auth identity is created but Platform User
 * creation is interrupted. The linkage reconciler should detect the pending
 * linkage and create the Platform User on retry.
 *
 * Also tests idempotency: running the reconciler multiple times on the same
 * pending linkage produces the same result.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { NetlifyDB } from "@netlify/database-dev";
import { NoopLogger } from "@livingsites/platform";
import { DrizzleUserRepository } from "../user/drizzle-user-repository";
import { LinkageReconciler } from "./linkage-reconciler";
import { identityLinkages } from "../../db/identity-linkage-schema";
import { betterAuthSessions, betterAuthUsers, platformUsers } from "../../db/schema";
import * as schema from "../../db/schema";
import { SystemClock, CryptoIdGenerator } from "@livingsites/platform";
import { DrizzleOrphanIdentityDisabler } from "./drizzle-orphan-identity-disabler";

describe("LinkageReconciler — orphan identity recovery", () => {
  let netlifyDB: NetlifyDB;
  let sql: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let userRepo: DrizzleUserRepository;
  let reconciler: LinkageReconciler;

  beforeAll(async () => {
    netlifyDB = new NetlifyDB({ logger: () => {} });
    const connectionString = await netlifyDB.start();
    await netlifyDB.applyMigrations("./netlify/database/migrations");
    sql = postgres(connectionString);
    db = drizzle({ client: sql, schema });
    userRepo = new DrizzleUserRepository({ db, logger: new NoopLogger() });
    reconciler = new LinkageReconciler({
      db,
      logger: new NoopLogger(),
      userCreator: userRepo,
      userReader: userRepo,
      identityDisabler: new DrizzleOrphanIdentityDisabler(db),
      idGenerator: new CryptoIdGenerator(),
      clock: new SystemClock(),
    });
  });

  afterAll(async () => {
    if (sql) await sql.end();
    if (netlifyDB) await netlifyDB.stop();
  });

  beforeEach(async () => {
    await db.delete(platformUsers);
    await db.delete(identityLinkages);
    await db.delete(betterAuthSessions);
    await db.delete(betterAuthUsers);
  });

  it("creates a pending linkage, then reconciles it to linked", async () => {
    await db.insert(identityLinkages).values({
      id: "linkage_001",
      auth_subject_id: "auth_orphan_001",
      email: "orphan1@example.com",
      display_name: "Orphan One",
      status: "pending",
      attempts: 0,
      max_attempts: 5,
      next_attempt_at: new Date(0),
    });

    const result = await reconciler.reconcile();

    expect(result.processed).toBe(1);
    expect(result.linked).toBe(1);

    const linkages = await db.select().from(identityLinkages);
    expect(linkages[0]!.status).toBe("linked");
    expect(linkages[0]!.platform_user_id).toBeTruthy();

    const users = await db.select().from(platformUsers);
    expect(users.length).toBe(1);
    expect(users[0]!.email).toBe("orphan1@example.com");
  });

  it("is idempotent: reconciling twice does not create duplicate users", async () => {
    await db.insert(identityLinkages).values({
      id: "linkage_002",
      auth_subject_id: "auth_orphan_002",
      email: "orphan2@example.com",
      display_name: "Orphan Two",
      status: "pending",
      attempts: 0,
      max_attempts: 5,
      next_attempt_at: new Date(0),
    });

    await reconciler.reconcile();
    const result = await reconciler.reconcile();

    expect(result.processed).toBe(0);

    const users = await db.select().from(platformUsers);
    expect(users.length).toBe(1);
  });

  it("marks linkage as failed after max attempts", async () => {
    await db.insert(betterAuthUsers).values({
      id: "auth_orphan_003",
      email: "orphan3@example.com",
      name: "Orphan Three",
    });
    await db.insert(betterAuthSessions).values({
      id: "session_orphan_003",
      user_id: "auth_orphan_003",
      token: "token_orphan_003",
      expires_at: new Date(Date.now() + 60_000),
    });
    await db.insert(identityLinkages).values({
      id: "linkage_003",
      auth_subject_id: "auth_orphan_003",
      email: "orphan3@example.com",
      display_name: "Orphan Three",
      status: "pending",
      attempts: 5,
      max_attempts: 5,
      next_attempt_at: new Date(0),
    });

    const result = await reconciler.reconcile();

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);

    const linkages = await db.select().from(identityLinkages);
    expect(linkages[0]!.status).toBe("failed");
    const [identity] = await db.select().from(betterAuthUsers);
    expect(identity?.disabled).toBe(true);
    expect(await db.select().from(betterAuthSessions)).toHaveLength(0);
  });

  it("skips linkages not yet due for retry", async () => {
    await db.insert(identityLinkages).values({
      id: "linkage_004",
      auth_subject_id: "auth_orphan_004",
      email: "orphan4@example.com",
      display_name: "Orphan Four",
      status: "pending",
      attempts: 0,
      max_attempts: 5,
      next_attempt_at: new Date(Date.now() + 60000),
    });

    const result = await reconciler.reconcile();

    expect(result.processed).toBe(0);
  });

  it("claims each linkage once under concurrent invocation", async () => {
    await db.insert(identityLinkages).values({
      id: "linkage_concurrent",
      auth_subject_id: "auth_concurrent",
      email: "concurrent@example.com",
      display_name: "Concurrent",
      next_attempt_at: new Date(0),
    });

    const [first, second] = await Promise.all([reconciler.reconcile(), reconciler.reconcile()]);
    expect(first.processed + second.processed).toBe(1);
    expect(await db.select().from(platformUsers)).toHaveLength(1);
  });
});
