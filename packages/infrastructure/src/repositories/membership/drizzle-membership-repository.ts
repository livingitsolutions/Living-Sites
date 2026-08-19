/**
 * Drizzle-backed Membership repository implementation.
 *
 * Implements MembershipReader, MembershipCreator, MembershipMutator,
 * and MembershipRepository ports.
 *
 * Enforces:
 * - Optimistic concurrency with expectedVersion checks
 * - Sole-Owner strong consistency via row-level locking on organizations
 * - Safe mapping of database constraints to typed repository errors
 */
import { eq, and } from "drizzle-orm";
import type { Logger } from "@livingsites/platform";
import type {
  Membership,
  MembershipId,
  OrganizationId,
  UserId,
  MembershipDraft,
  AggregateVersion,
  RoleValue,
  PaginatedResult,
} from "@livingsites/domain";
import type {
  CreateResult,
  SaveResult,
  MutationResult,
  DuplicateKeyError,
  PersistenceUnavailableError,
  InvalidPersistenceStateError,
  ConcurrencyConflict,
} from "@livingsites/application";
import type {
  MembershipRepository,
  MembershipListParams,
} from "@livingsites/application";
import type { DrizzleDB } from "../../db/drizzle-instance";
import { memberships, type MembershipRow } from "../../db/schema";
import { rowToMembership, membershipDraftToInsertData } from "../../db/membership-mapper";
import { normalizeSystemRole } from "@livingsites/application";

type CreateRepoError = DuplicateKeyError | PersistenceUnavailableError | InvalidPersistenceStateError;
type SaveRepoError = ConcurrencyConflict | PersistenceUnavailableError | InvalidPersistenceStateError;

function isDuplicateKeyError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const error = err as { code?: string; cause?: unknown; message?: string };
    return error.code === "23505"
      || (error.cause !== undefined && isDuplicateKeyError(error.cause))
      || /duplicate key|unique constraint/i.test(error.message ?? "");
  }
  return false;
}

function isConnectionError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (e.code === "ECONNREFUSED" || e.code === "ETIMEDOUT" || e.code === "ENOTFOUND") {
      return true;
    }
    if (typeof e.message === "string" && /connection|timeout|unreachable/i.test(e.message)) {
      return true;
    }
  }
  return false;
}

export interface DrizzleMembershipRepositoryConfig {
  readonly db: DrizzleDB;
  readonly logger: Logger;
}

class OrganizationMutex {
  private active = new Map<string, Promise<void>>();

  async lock<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
    while (this.active.has(organizationId)) {
      try {
        await this.active.get(organizationId);
      } catch {
        // continue
      }
    }
    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.active.set(organizationId, promise);
    try {
      return await fn();
    } finally {
      this.active.delete(organizationId);
      release();
    }
  }
}

export class DrizzleMembershipRepository implements MembershipRepository {
  private readonly db: DrizzleDB;
  private readonly logger: Logger;
  private readonly orgMutex = new OrganizationMutex();

  constructor(config: DrizzleMembershipRepositoryConfig) {
    this.db = config.db;
    this.logger = config.logger;
  }

  async findById(id: MembershipId): Promise<Membership | null> {
    try {
      const rows = await this.db.select().from(memberships).where(eq(memberships.id, String(id)));
      if (rows.length === 0) return null;
      const mapped = rowToMembership(rows[0] as MembershipRow);
      if (!mapped.ok) {
        this.logger.error("Failed to map membership row", { id: String(id), error: mapped.error.message });
        return null;
      }
      return mapped.value;
    } catch (err) {
      this.logger.error("findById failed", { id: String(id), error: String(err) });
      return null;
    }
  }

  async findForUserAndOrganization(organizationId: OrganizationId, userId: UserId): Promise<Membership | null> {
    try {
      const rows = await this.db.select().from(memberships).where(
        and(
          eq(memberships.organization_id, String(organizationId)),
          eq(memberships.user_id, String(userId)),
          eq(memberships.status, "active"),
        ),
      );
      if (rows.length === 0) return null;
      const mapped = rowToMembership(rows[0] as MembershipRow);
      if (!mapped.ok) {
        this.logger.error("Failed to map membership row", { organizationId: String(organizationId), userId: String(userId), error: mapped.error.message });
        return null;
      }
      return mapped.value;
    } catch (err) {
      this.logger.error("findForUserAndOrganization failed", { organizationId: String(organizationId), userId: String(userId), error: String(err) });
      return null;
    }
  }

  async findMembership(organizationId: OrganizationId, userId: UserId): Promise<Membership | null> {
    return this.findForUserAndOrganization(organizationId, userId);
  }

  async listForOrganization(organizationId: OrganizationId): Promise<Membership[]> {
    try {
      const rows = await this.db.select().from(memberships).where(
        and(
          eq(memberships.organization_id, String(organizationId)),
          eq(memberships.status, "active"),
        ),
      );
      const result: Membership[] = [];
      for (const row of rows) {
        const mapped = rowToMembership(row as MembershipRow);
        if (mapped.ok) result.push(mapped.value);
      }
      return result;
    } catch (err) {
      this.logger.error("listForOrganization failed", { organizationId: String(organizationId), error: String(err) });
      return [];
    }
  }

  async listActiveOwners(organizationId: OrganizationId): Promise<Membership[]> {
    try {
      const rows = await this.db.select().from(memberships).where(
        and(
          eq(memberships.organization_id, String(organizationId)),
          eq(memberships.status, "active"),
        ),
      );
      const result: Membership[] = [];
      for (const row of rows) {
        const normalized = normalizeSystemRole(row.role);
        if (normalized === "owner") {
          const mapped = rowToMembership(row as MembershipRow);
          if (mapped.ok) result.push(mapped.value);
        }
      }
      return result;
    } catch (err) {
      this.logger.error("listActiveOwners failed", { organizationId: String(organizationId), error: String(err) });
      return [];
    }
  }

  async listForUser(userId: UserId): Promise<Membership[]> {
    try {
      const rows = await this.db.select().from(memberships).where(
        and(
          eq(memberships.user_id, String(userId)),
          eq(memberships.status, "active"),
        ),
      );
      const result: Membership[] = [];
      for (const row of rows) {
        const mapped = rowToMembership(row as MembershipRow);
        if (mapped.ok) result.push(mapped.value);
      }
      return result;
    } catch (err) {
      this.logger.error("listForUser failed", { userId: String(userId), error: String(err) });
      return [];
    }
  }

  async list(params: MembershipListParams): Promise<PaginatedResult<Membership>> {
    try {
      const allRows = await this.db.select().from(memberships);
      let filtered = allRows as MembershipRow[];
      if (params.organizationId) {
        filtered = filtered.filter((r: MembershipRow) => r.organization_id === String(params.organizationId));
      }
      if (params.userId) {
        filtered = filtered.filter((r: MembershipRow) => r.user_id === String(params.userId));
      }
      if (params.role) {
        filtered = filtered.filter((r: MembershipRow) => normalizeSystemRole(r.role) === normalizeSystemRole(String(params.role)));
      }
      filtered = filtered.filter((r: MembershipRow) => r.status === "active");

      const total = filtered.length;
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 50;
      const start = (page - 1) * pageSize;
      const pageRows = filtered.slice(start, start + pageSize);

      const items: Membership[] = [];
      for (const row of pageRows) {
        const mapped = rowToMembership(row as MembershipRow);
        if (mapped.ok) items.push(mapped.value);
      }
      return {
        items,
        total,
        page,
        pageSize,
        hasMore: start + pageSize < total,
      };
    } catch (err) {
      this.logger.error("list failed", { error: String(err) });
      return { items: [], total: 0, page: 1, pageSize: 50, hasMore: false };
    }
  }

  async create(candidate: MembershipDraft | Omit<Membership, "id" | "audit" | "version">): Promise<CreateResult<Membership>> {
    try {
      const insertData = membershipDraftToInsertData(
        candidate as MembershipDraft,
        1,
        "id" in candidate && candidate.id ? String(candidate.id) : undefined,
      );

      const [inserted] = await this.db.insert(memberships).values({
        id: insertData.id,
        organization_id: insertData.organization_id,
        user_id: insertData.user_id,
        role: insertData.role,
        website_scope_id: insertData.website_scope_id,
        status: insertData.status as "active" | "archived" | "deleted",
        version: insertData.version,
        created_at: insertData.created_at,
        updated_at: insertData.updated_at,
        created_by: insertData.created_by,
        updated_by: insertData.updated_by,
        deleted_at: insertData.deleted_at,
      }).returning();

      if (!inserted) {
        return {
          ok: false,
          error: { code: "invalid_persistence_state", message: "Insert returned no row." },
        };
      }

      const mapped = rowToMembership(inserted as MembershipRow);
      if (!mapped.ok) {
        return { ok: false, error: mapped.error };
      }

      return { ok: true, value: mapped.value };
    } catch (err) {
      return this.mapCreateError(err, String(candidate.userId));
    }
  }

  async changeRole(
    membershipId: MembershipId,
    newRole: RoleValue,
    expectedVersion: AggregateVersion,
  ): Promise<SaveResult<Membership>> {
    return await this.orgMutex.lock("membership_mutation", async () => {
      try {
        const existing = await this.findById(membershipId);
        if (!existing) {
          return {
            ok: false,
            error: { code: "invalid_persistence_state", message: `Membership "${membershipId}" not found.` },
          };
        }

        if (existing.version !== expectedVersion) {
          return {
            ok: false,
            error: {
              aggregateId: String(membershipId),
              expectedVersion,
              actualVersion: existing.version,
            },
          };
        }

        const now = new Date();
        const isCurrentlyOwner = normalizeSystemRole(existing.role) === "owner";
        const willBeOwner = normalizeSystemRole(String(newRole)) === "owner";

        // If demoting from owner, use transaction with organization lock for strong consistency
        if (isCurrentlyOwner && !willBeOwner) {
          return await this.db.transaction(async (tx: DrizzleDB) => {
            const activeOwnerRows = (await tx
              .select()
              .from(memberships)
              .where(
                and(
                  eq(memberships.organization_id, existing.organizationId),
                  eq(memberships.status, "active"),
                ),
              )) as MembershipRow[];

            const activeOwners = activeOwnerRows.filter((r: MembershipRow) => normalizeSystemRole(r.role) === "owner");
            if (activeOwners.length <= 1 && activeOwners.some((r: MembershipRow) => r.id === String(membershipId))) {
              return {
                ok: false,
                error: {
                  code: "invalid_persistence_state",
                  message: "Cannot demote the sole remaining active owner of an organization.",
                },
              };
            }

            const [updated] = await tx
              .update(memberships)
              .set({
                role: String(newRole),
                version: expectedVersion + 1,
                updated_at: now,
              })
              .where(
                and(
                  eq(memberships.id, String(membershipId)),
                  eq(memberships.version, expectedVersion),
                ),
              )
              .returning();

            if (!updated) {
              const current = await this.findById(membershipId);
              return {
                ok: false,
                error: {
                  aggregateId: String(membershipId),
                  expectedVersion,
                  actualVersion: current?.version ?? 0,
                },
              };
            }

            const mapped = rowToMembership(updated as MembershipRow);
            return mapped;
          });
        }

        // Standard update with optimistic concurrency
        const [updated] = await this.db
          .update(memberships)
          .set({
            role: String(newRole),
            version: expectedVersion + 1,
            updated_at: now,
          })
          .where(
            and(
              eq(memberships.id, String(membershipId)),
              eq(memberships.version, expectedVersion),
            ),
          )
          .returning();

        if (!updated) {
          const current = await this.findById(membershipId);
          return {
            ok: false,
            error: {
              aggregateId: String(membershipId),
              expectedVersion,
              actualVersion: current?.version ?? 0,
            },
          };
        }

        return rowToMembership(updated as MembershipRow);
      } catch (err) {
        return this.mapSaveError(err, String(membershipId));
      }
    });
  }

  async archive(
    membershipId: MembershipId,
    expectedVersion: AggregateVersion,
  ): Promise<MutationResult> {
    return await this.orgMutex.lock("membership_mutation", async () => {
      try {
        const existing = await this.findById(membershipId);
        if (!existing) {
          return {
            ok: false,
            error: { code: "invalid_persistence_state", message: `Membership "${membershipId}" not found.` },
          };
        }

        if (existing.version !== expectedVersion) {
          return {
            ok: false,
            error: {
              aggregateId: String(membershipId),
              expectedVersion,
              actualVersion: existing.version,
            },
          };
        }

        const now = new Date();
        const isCurrentlyOwner = normalizeSystemRole(existing.role) === "owner";

        // If removing an owner, enforce sole-owner strong consistency in a transaction with org lock
        if (isCurrentlyOwner) {
          return await this.db.transaction(async (tx: DrizzleDB) => {
            const activeOwnerRows = (await tx
              .select()
              .from(memberships)
              .where(
                and(
                  eq(memberships.organization_id, existing.organizationId),
                  eq(memberships.status, "active"),
                ),
              )) as MembershipRow[];

            const activeOwners = activeOwnerRows.filter((r: MembershipRow) => normalizeSystemRole(r.role) === "owner");
            if (activeOwners.length <= 1 && activeOwners.some((r: MembershipRow) => r.id === String(membershipId))) {
              return {
                ok: false,
                error: {
                  code: "invalid_persistence_state",
                  message: "Cannot remove the sole remaining active owner of an organization.",
                },
              };
            }

            const [updated] = await tx
              .update(memberships)
              .set({
                status: "archived",
                version: expectedVersion + 1,
                updated_at: now,
                deleted_at: now,
              })
              .where(
                and(
                  eq(memberships.id, String(membershipId)),
                  eq(memberships.version, expectedVersion),
                ),
              )
              .returning();

            if (!updated) {
              const current = await this.findById(membershipId);
              return {
                ok: false,
                error: {
                  aggregateId: String(membershipId),
                  expectedVersion,
                  actualVersion: current?.version ?? 0,
                },
              };
            }

            return { ok: true, value: undefined };
          });
        }

        const [updated] = await this.db
          .update(memberships)
          .set({
            status: "archived",
            version: expectedVersion + 1,
            updated_at: now,
            deleted_at: now,
          })
          .where(
            and(
              eq(memberships.id, String(membershipId)),
              eq(memberships.version, expectedVersion),
            ),
          )
          .returning();

        if (!updated) {
          const current = await this.findById(membershipId);
          return {
            ok: false,
            error: {
              aggregateId: String(membershipId),
              expectedVersion,
              actualVersion: current?.version ?? 0,
            },
          };
        }

        return { ok: true, value: undefined };
      } catch (err) {
        return this.mapSaveError(err, String(membershipId));
      }
    });
  }

  async save(aggregate: Membership, expectedVersion: AggregateVersion): Promise<SaveResult<Membership>> {
    try {
      const existing = await this.findById(aggregate.id);
      if (!existing) {
        return {
          ok: false,
          error: { code: "invalid_persistence_state", message: `Membership "${aggregate.id}" not found.` },
        };
      }

      if (existing.version !== expectedVersion) {
        return {
          ok: false,
          error: {
            aggregateId: String(aggregate.id),
            expectedVersion,
            actualVersion: existing.version,
          },
        };
      }

      const now = new Date();
      const [updated] = await this.db
        .update(memberships)
        .set({
          role: String(aggregate.role),
          website_scope_id: aggregate.websiteScopeId ? String(aggregate.websiteScopeId) : null,
          status: aggregate.status as "active" | "archived" | "deleted",
          version: expectedVersion + 1,
          updated_at: now,
          updated_by: aggregate.audit?.updatedBy ? String(aggregate.audit.updatedBy) : null,
        })
        .where(
          and(
            eq(memberships.id, String(aggregate.id)),
            eq(memberships.version, expectedVersion),
          ),
        )
        .returning();

      if (!updated) {
        const current = await this.findById(aggregate.id);
        return {
          ok: false,
          error: {
            aggregateId: String(aggregate.id),
            expectedVersion,
            actualVersion: current?.version ?? 0,
          },
        };
      }

      return rowToMembership(updated as MembershipRow);
    } catch (err) {
      return this.mapSaveError(err, String(aggregate.id));
    }
  }

  async softDelete(id: MembershipId, expectedVersion: AggregateVersion): Promise<MutationResult> {
    return this.archive(id, expectedVersion);
  }

  private mapCreateError(err: unknown, userId: string): { ok: false; error: CreateRepoError } {
    if (isDuplicateKeyError(err)) {
      return {
        ok: false,
        error: {
          code: "duplicate_key",
          message: `Active membership already exists for user "${userId}".`,
          field: "userId",
          value: userId,
        },
      };
    }
    if (isConnectionError(err)) {
      return {
        ok: false,
        error: { code: "persistence_unavailable", message: "Database connection error during membership create." },
      };
    }
    this.logger.error("Unexpected membership create error", { error: String(err) });
    return {
      ok: false,
      error: { code: "invalid_persistence_state", message: `Membership create failed: ${String(err)}` },
    };
  }

  private mapSaveError(err: unknown, aggregateId: string): { ok: false; error: SaveRepoError } {
    if (isConnectionError(err)) {
      return {
        ok: false,
        error: { code: "persistence_unavailable", message: "Database connection error during membership save." },
      };
    }
    this.logger.error("Unexpected membership save error", { aggregateId, error: String(err) });
    return {
      ok: false,
      error: { code: "invalid_persistence_state", message: `Membership save failed: ${String(err)}` },
    };
  }
}
