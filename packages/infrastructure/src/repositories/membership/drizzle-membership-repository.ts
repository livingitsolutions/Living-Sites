import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Logger } from "@livingsites/platform";
import type {
  AggregateVersion,
  Membership,
  MembershipDraft,
  MembershipId,
  OrganizationId,
  OrganizationMemberAddedEvent,
  OrganizationMemberRemovedEvent,
  OrganizationMemberRoleChangedEvent,
  PaginatedResult,
  RoleValue,
  UserId,
  WebsiteId,
} from "@livingsites/domain";
import type {
  ConcurrencyConflict,
  CreateResult,
  DuplicateKeyError,
  InvalidPersistenceStateError,
  MembershipListParams,
  MembershipMutationPersistence,
  MembershipRepository,
  MutationResult,
  PersistenceUnavailableError,
  SaveResult,
} from "@livingsites/application";
import { normalizeOrganizationRole, normalizeSystemRole } from "@livingsites/application";
import type { DrizzleDB } from "../../db/drizzle-instance.js";
import { tenantDatabase } from "../../db/tenant-context.js";
import { membershipDraftToInsertData, rowToMembership } from "../../db/membership-mapper.js";
import { buildOutboxInsert } from "../../db/outbox-mapper.js";
import {
  applicationOutbox,
  memberships,
  organizations,
  type MembershipRow,
} from "../../db/schema.js";

type CreateRepoError = DuplicateKeyError | PersistenceUnavailableError | InvalidPersistenceStateError;
type SaveRepoError = ConcurrencyConflict | PersistenceUnavailableError | InvalidPersistenceStateError;

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; cause?: unknown; message?: string };
  return candidate.code === "23505"
    || (candidate.cause !== undefined && isDuplicateKeyError(candidate.cause))
    || /duplicate key|unique constraint/i.test(candidate.message ?? "");
}

function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as Record<string, unknown>;
  return candidate.code === "ECONNREFUSED"
    || candidate.code === "ETIMEDOUT"
    || candidate.code === "ENOTFOUND"
    || (typeof candidate.message === "string" && /connection|timeout|unreachable/i.test(candidate.message));
}

export interface DrizzleMembershipRepositoryConfig {
  readonly db: DrizzleDB;
  readonly logger: Logger;
  readonly schemaVersion?: string;
}

export class DrizzleMembershipRepository implements MembershipRepository, MembershipMutationPersistence {
  private readonly rootDb: DrizzleDB;
  private readonly logger: Logger;
  private readonly schemaVersion: string;

  constructor(config: DrizzleMembershipRepositoryConfig) {
    this.rootDb = config.db;
    this.logger = config.logger;
    this.schemaVersion = config.schemaVersion ?? "1.0.0";
  }

  private get db(): DrizzleDB { return tenantDatabase(this.rootDb); }

  async findById(id: MembershipId): Promise<Membership | null> {
    return this.findByIdWithDb(this.db, id);
  }

  async findForUserAndOrganization(
    organizationId: OrganizationId,
    userId: UserId,
    websiteId: WebsiteId | null = null,
  ): Promise<Membership | null> {
    const candidates = await this.listForUserAndOrganization(organizationId, userId);
    const organizationWide = candidates.find((membership) => !membership.websiteScopeId);
    if (organizationWide) return organizationWide;
    if (!websiteId) return null;
    return candidates.find((membership) => membership.websiteScopeId === websiteId) ?? null;
  }

  async findMembership(
    organizationId: OrganizationId,
    userId: UserId,
    websiteId: WebsiteId | null = null,
  ): Promise<Membership | null> {
    return this.findForUserAndOrganization(organizationId, userId, websiteId);
  }

  async listForUserAndOrganization(organizationId: OrganizationId, userId: UserId): Promise<Membership[]> {
    try {
      const rows = await this.db.select().from(memberships).where(
        and(
          eq(memberships.organization_id, String(organizationId)),
          eq(memberships.user_id, String(userId)),
          eq(memberships.status, "active"),
        ),
      );
      return this.mapRows(rows as MembershipRow[]);
    } catch (error) {
      this.logger.error("listForUserAndOrganization failed", {
        organizationId: String(organizationId),
        userId: String(userId),
        error: String(error),
      });
      return [];
    }
  }

  async listForOrganization(organizationId: OrganizationId): Promise<Membership[]> {
    try {
      const rows = await this.db.select().from(memberships).where(
        and(
          eq(memberships.organization_id, String(organizationId)),
          eq(memberships.status, "active"),
        ),
      );
      return this.mapRows(rows as MembershipRow[]);
    } catch (error) {
      this.logger.error("listForOrganization failed", { organizationId: String(organizationId), error: String(error) });
      return [];
    }
  }

  async listActiveOwners(organizationId: OrganizationId): Promise<Membership[]> {
    const membershipsForOrganization = await this.listForOrganization(organizationId);
    return membershipsForOrganization.filter((membership) => normalizeSystemRole(membership.role) === "owner");
  }

  async listForUser(userId: UserId): Promise<Membership[]> {
    try {
      const rows = await this.db.select().from(memberships).where(
        and(eq(memberships.user_id, String(userId)), eq(memberships.status, "active")),
      );
      return this.mapRows(rows as MembershipRow[]);
    } catch (error) {
      this.logger.error("listForUser failed", { userId: String(userId), error: String(error) });
      return [];
    }
  }

  async list(params: MembershipListParams): Promise<PaginatedResult<Membership>> {
    try {
      const rows = await this.db.select().from(memberships);
      let filtered = (rows as MembershipRow[]).filter((row) => row.status === "active");
      if (params.organizationId) {
        filtered = filtered.filter((row) => row.organization_id === String(params.organizationId));
      }
      if (params.userId) {
        filtered = filtered.filter((row) => row.user_id === String(params.userId));
      }
      if (params.role) {
        filtered = filtered.filter((row) => normalizeSystemRole(row.role) === normalizeSystemRole(String(params.role)));
      }
      const total = filtered.length;
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 50;
      const start = (page - 1) * pageSize;
      return {
        items: this.mapRows(filtered.slice(start, start + pageSize)),
        total,
        page,
        pageSize,
        hasMore: start + pageSize < total,
      };
    } catch (error) {
      this.logger.error("list failed", { error: String(error) });
      return { items: [], total: 0, page: 1, pageSize: 50, hasMore: false };
    }
  }

  async create(
    candidate: MembershipDraft | Omit<Membership, "id" | "audit" | "version">,
  ): Promise<CreateResult<Membership>> {
    try {
      return await this.createWithDb(this.db, candidate);
    } catch (error) {
      return this.mapCreateError(error, String(candidate.userId));
    }
  }

  async createWithEvent(
    candidate: MembershipDraft | Omit<Membership, "id" | "audit" | "version">,
    event: OrganizationMemberAddedEvent,
  ): Promise<CreateResult<Membership>> {
    try {
      return await this.db.transaction(async (transaction: DrizzleDB) => {
        const result = await this.createWithDb(transaction, candidate);
        if (!result.ok) return result;
        await transaction.insert(applicationOutbox).values(this.buildMembershipOutboxInsert(event, result.value.version));
        return result;
      });
    } catch (error) {
      return this.mapCreateError(error, String(candidate.userId));
    }
  }

  async changeRole(
    membershipId: MembershipId,
    newRole: RoleValue,
    expectedVersion: AggregateVersion,
  ): Promise<SaveResult<Membership>> {
    return this.changeRoleTransaction(membershipId, newRole, expectedVersion);
  }

  async changeRoleWithEvent(
    membershipId: MembershipId,
    newRole: RoleValue,
    expectedVersion: AggregateVersion,
    event: OrganizationMemberRoleChangedEvent,
  ): Promise<SaveResult<Membership>> {
    return this.changeRoleTransaction(membershipId, newRole, expectedVersion, event);
  }

  async archive(membershipId: MembershipId, expectedVersion: AggregateVersion): Promise<MutationResult> {
    return this.archiveTransaction(membershipId, expectedVersion);
  }

  async archiveWithEvent(
    membershipId: MembershipId,
    expectedVersion: AggregateVersion,
    event: OrganizationMemberRemovedEvent,
  ): Promise<MutationResult> {
    return this.archiveTransaction(membershipId, expectedVersion, event);
  }

  async softDelete(id: MembershipId, expectedVersion: AggregateVersion): Promise<MutationResult> {
    return this.archive(id, expectedVersion);
  }

  private async changeRoleTransaction(
    membershipId: MembershipId,
    newRole: RoleValue,
    expectedVersion: AggregateVersion,
    event?: OrganizationMemberRoleChangedEvent,
  ): Promise<SaveResult<Membership>> {
    const normalizedRole = normalizeOrganizationRole(String(newRole));
    if (!normalizedRole) {
      return {
        ok: false,
        error: { code: "invalid_persistence_state", message: `Invalid organization membership role "${newRole}".` },
      };
    }

    try {
      return await this.db.transaction(async (transaction: DrizzleDB) => {
        const existing = await this.findByIdWithDb(transaction, membershipId);
        if (!existing) return this.notFound(membershipId);
        if (existing.version !== expectedVersion) return this.concurrencyConflict(membershipId, expectedVersion, existing.version);

        const isOwnerDemotion = normalizeSystemRole(existing.role) === "owner" && normalizedRole !== "owner";
        if (isOwnerDemotion) {
          await this.lockOrganization(transaction, existing.organizationId);
          const activeOwners = await this.listActiveOwnersWithDb(transaction, existing.organizationId);
          if (activeOwners.length <= 1 && activeOwners.some((owner) => owner.id === membershipId)) {
            return {
              ok: false,
              error: {
                code: "invalid_persistence_state",
                message: "Cannot demote the sole remaining active owner of an organization.",
              },
            };
          }
        }

        const [updated] = await transaction
          .update(memberships)
          .set({ role: normalizedRole, version: expectedVersion + 1, updated_at: new Date() })
          .where(and(eq(memberships.id, String(membershipId)), eq(memberships.version, expectedVersion)))
          .returning();

        if (!updated) {
          const current = await this.findByIdWithDb(transaction, membershipId);
          return this.concurrencyConflict(membershipId, expectedVersion, current?.version ?? 0);
        }

        const mapped = rowToMembership(updated as MembershipRow);
        if (!mapped.ok) return mapped;
        if (event) {
          await transaction.insert(applicationOutbox).values(this.buildMembershipOutboxInsert(event, mapped.value.version));
        }
        return mapped;
      });
    } catch (error) {
      return this.mapSaveError(error, String(membershipId));
    }
  }

  private async archiveTransaction(
    membershipId: MembershipId,
    expectedVersion: AggregateVersion,
    event?: OrganizationMemberRemovedEvent,
  ): Promise<MutationResult> {
    try {
      return await this.db.transaction(async (transaction: DrizzleDB) => {
        const existing = await this.findByIdWithDb(transaction, membershipId);
        if (!existing) return this.notFound(membershipId);
        if (existing.version !== expectedVersion) return this.concurrencyConflict(membershipId, expectedVersion, existing.version);

        if (normalizeSystemRole(existing.role) === "owner") {
          await this.lockOrganization(transaction, existing.organizationId);
          const activeOwners = await this.listActiveOwnersWithDb(transaction, existing.organizationId);
          if (activeOwners.length <= 1 && activeOwners.some((owner) => owner.id === membershipId)) {
            return {
              ok: false,
              error: {
                code: "invalid_persistence_state",
                message: "Cannot remove the sole remaining active owner of an organization.",
              },
            };
          }
        }

        const now = new Date();
        const [updated] = await transaction
          .update(memberships)
          .set({ status: "archived", version: expectedVersion + 1, updated_at: now, deleted_at: now })
          .where(and(eq(memberships.id, String(membershipId)), eq(memberships.version, expectedVersion)))
          .returning();

        if (!updated) {
          const current = await this.findByIdWithDb(transaction, membershipId);
          return this.concurrencyConflict(membershipId, expectedVersion, current?.version ?? 0);
        }
        if (event) {
          await transaction.insert(applicationOutbox).values(this.buildMembershipOutboxInsert(event, expectedVersion + 1));
        }
        return { ok: true, value: undefined };
      });
    } catch (error) {
      return this.mapSaveError(error, String(membershipId));
    }
  }

  private async createWithDb(
    database: DrizzleDB,
    candidate: MembershipDraft | Omit<Membership, "id" | "audit" | "version">,
  ): Promise<CreateResult<Membership>> {
    const normalizedRole = normalizeOrganizationRole(String(candidate.role));
    if (!normalizedRole) {
      return {
        ok: false,
        error: { code: "invalid_persistence_state", message: `Invalid organization membership role "${candidate.role}".` },
      };
    }
    const normalizedCandidate = { ...candidate, role: normalizedRole as RoleValue };
    const insertData = membershipDraftToInsertData(
      normalizedCandidate as MembershipDraft,
      1,
      "id" in normalizedCandidate && normalizedCandidate.id ? String(normalizedCandidate.id) : undefined,
    );
    const [inserted] = await database.insert(memberships).values(insertData).returning();
    if (!inserted) {
      return { ok: false, error: { code: "invalid_persistence_state", message: "Insert returned no row." } };
    }
    return rowToMembership(inserted as MembershipRow);
  }

  private async findByIdWithDb(database: DrizzleDB, id: MembershipId): Promise<Membership | null> {
    try {
      const rows = await database.select().from(memberships).where(eq(memberships.id, String(id)));
      if (rows.length === 0) return null;
      const mapped = rowToMembership(rows[0] as MembershipRow);
      if (!mapped.ok) {
        this.logger.error("Failed to map membership row", { id: String(id), error: mapped.error.message });
        return null;
      }
      return mapped.value;
    } catch (error) {
      this.logger.error("findById failed", { id: String(id), error: String(error) });
      return null;
    }
  }

  private async listActiveOwnersWithDb(database: DrizzleDB, organizationId: OrganizationId): Promise<Membership[]> {
    const rows = await database.select().from(memberships).where(
      and(
        eq(memberships.organization_id, String(organizationId)),
        eq(memberships.status, "active"),
        eq(memberships.role, "owner"),
      ),
    );
    return this.mapRows(rows as MembershipRow[]);
  }

  private async lockOrganization(database: DrizzleDB, organizationId: OrganizationId): Promise<void> {
    await database.execute(sql`
      SELECT ${organizations.id}
      FROM ${organizations}
      WHERE ${organizations.id} = ${String(organizationId)}
      FOR UPDATE
    `);
  }

  private buildMembershipOutboxInsert(
    event: OrganizationMemberAddedEvent | OrganizationMemberRoleChangedEvent | OrganizationMemberRemovedEvent,
    version: number,
  ) {
    const organizationId = String(event.eventScope.organizationId);
    const membershipId = String(event.membershipId);
    const base = {
      type: event.type,
      occurredAt: event.occurredAt,
      organizationId,
      membershipId,
      userId: String(event.userId),
    };
    const payload = event.type === "organization.member_added"
      ? { ...base, role: event.role, websiteScopeId: event.websiteScopeId ? String(event.websiteScopeId) : null }
      : event.type === "organization.member_role_changed"
        ? { ...base, previousRole: event.previousRole, newRole: event.newRole }
        : base;
    return buildOutboxInsert({
      id: randomUUID(),
      eventType: event.type,
      aggregateType: "membership",
      aggregateId: membershipId,
      organizationId,
      websiteId: event.type === "organization.member_added" && event.websiteScopeId
        ? String(event.websiteScopeId)
        : null,
      payload,
      occurredAt: new Date(event.occurredAt),
      idempotencyKey: `${event.type}:${membershipId}:${version}`,
      schemaVersion: this.schemaVersion,
    });
  }

  private mapRows(rows: MembershipRow[]): Membership[] {
    const result: Membership[] = [];
    for (const row of rows) {
      const mapped = rowToMembership(row);
      if (mapped.ok) result.push(mapped.value);
    }
    return result;
  }

  private notFound(membershipId: MembershipId): { ok: false; error: InvalidPersistenceStateError } {
    return {
      ok: false,
      error: { code: "invalid_persistence_state", message: `Membership "${membershipId}" not found.` },
    };
  }

  private concurrencyConflict(
    membershipId: MembershipId,
    expectedVersion: AggregateVersion,
    actualVersion: AggregateVersion | number,
  ): { ok: false; error: ConcurrencyConflict } {
    return { ok: false, error: { aggregateId: String(membershipId), expectedVersion, actualVersion } };
  }

  private mapCreateError(error: unknown, userId: string): { ok: false; error: CreateRepoError } {
    if (isDuplicateKeyError(error)) {
      return {
        ok: false,
        error: {
          code: "duplicate_key",
          message: `Active membership already exists for user "${userId}" in this scope.`,
          field: "userId",
          value: userId,
        },
      };
    }
    if (isConnectionError(error)) {
      return {
        ok: false,
        error: { code: "persistence_unavailable", message: "Database connection error during membership create." },
      };
    }
    this.logger.error("Unexpected membership create error", { error: String(error) });
    return {
      ok: false,
      error: { code: "invalid_persistence_state", message: `Membership create failed: ${String(error)}` },
    };
  }

  private mapSaveError(error: unknown, aggregateId: string): { ok: false; error: SaveRepoError } {
    if (isConnectionError(error)) {
      return {
        ok: false,
        error: { code: "persistence_unavailable", message: "Database connection error during membership save." },
      };
    }
    this.logger.error("Unexpected membership save error", { aggregateId, error: String(error) });
    return {
      ok: false,
      error: { code: "invalid_persistence_state", message: `Membership save failed: ${String(error)}` },
    };
  }
}
