import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { OrganizationId, UserId, WebsiteId } from "@livingsites/domain";
import type { DrizzleDB } from "./drizzle-instance.js";
import { memberships, platformSuperAdmins } from "./schema.js";

export type TenantContext =
  | { readonly mode: "tenant"; readonly userId: UserId; readonly organizationId: OrganizationId; readonly websiteId?: WebsiteId }
  | { readonly mode: "directory"; readonly userId: UserId }
  | { readonly mode: "public" }
  | { readonly mode: "internal" };

interface ActiveTenantTransaction {
  readonly rootDb: DrizzleDB;
  readonly db: DrizzleDB;
  readonly context: TenantContext;
}

const activeTenantTransaction = new AsyncLocalStorage<ActiveTenantTransaction>();

export class TenantContextDeniedError extends Error {
  constructor(message = "The authenticated actor has no access to the requested tenant context.") {
    super(message);
    this.name = "TenantContextDeniedError";
  }
}

async function setContextValue(db: DrizzleDB, key: string, value: string): Promise<void> {
  await db.execute(sql`select set_config(${key}, ${value}, true)`);
}

async function initializeContext(db: DrizzleDB, context: TenantContext): Promise<void> {
  await setContextValue(db, "app.context_mode", context.mode);
  await setContextValue(db, "app.user_id", "userId" in context ? String(context.userId) : "");
  await setContextValue(db, "app.organization_id", "organizationId" in context ? String(context.organizationId) : "");
  await setContextValue(db, "app.website_id", "websiteId" in context && context.websiteId ? String(context.websiteId) : "");
  await setContextValue(db, "app.tenant_authorized", context.mode === "tenant" ? "false" : "true");
}

async function authorizeTenantContext(db: DrizzleDB, context: Extract<TenantContext, { mode: "tenant" }>): Promise<void> {
  const [superAdmin] = await db.select({ userId: platformSuperAdmins.user_id }).from(platformSuperAdmins)
    .where(eq(platformSuperAdmins.user_id, String(context.userId))).limit(1);

  if (!superAdmin) {
    const scopeCondition = context.websiteId
      ? or(isNull(memberships.website_scope_id), eq(memberships.website_scope_id, String(context.websiteId)))
      : isNull(memberships.website_scope_id);
    const [membership] = await db.select({ id: memberships.id }).from(memberships).where(and(
      eq(memberships.organization_id, String(context.organizationId)),
      eq(memberships.user_id, String(context.userId)),
      eq(memberships.status, "active"),
      isNull(memberships.deleted_at),
      scopeCondition,
    )).limit(1);
    if (!membership) throw new TenantContextDeniedError();
  }

  await setContextValue(db, "app.tenant_authorized", "true");
}

export interface TenantContextRunner {
  run<T>(context: TenantContext, operation: () => Promise<T>): Promise<T>;
}

export function createTenantContextRunner(rootDb: DrizzleDB): TenantContextRunner {
  return {
    async run<T>(context: TenantContext, operation: () => Promise<T>): Promise<T> {
      return rootDb.transaction(async (transaction: DrizzleDB) => {
        await initializeContext(transaction, context);
        if (context.mode === "tenant") await authorizeTenantContext(transaction, context);
        return activeTenantTransaction.run({ rootDb, db: transaction, context }, operation);
      });
    },
  };
}

export function tenantDatabase(rootDb: DrizzleDB): DrizzleDB {
  const active = activeTenantTransaction.getStore();
  if (active && active.rootDb === rootDb) return active.db;
  return rootDb;
}

export function currentTenantContext(): TenantContext | null {
  return activeTenantTransaction.getStore()?.context ?? null;
}
