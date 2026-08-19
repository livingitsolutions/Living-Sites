/**
 * In-memory Membership repository for testing.
 *
 * Implements MembershipReader, MembershipCreator, MembershipMutator,
 * and MembershipRepository ports.
 */
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
  MembershipRepository,
  MembershipListParams,
} from "@livingsites/application";
import { normalizeSystemRole } from "@livingsites/application";

interface StoredMembership {
  id: MembershipId;
  organizationId: OrganizationId;
  userId: UserId;
  role: RoleValue;
  websiteScopeId?: string | null;
  status: "active" | "archived" | "deleted";
  version: AggregateVersion;
  audit: { createdAt: string; updatedAt: string; createdBy?: string; updatedBy?: string };
}

export class InMemoryMembershipRepository implements MembershipRepository {
  private store: Map<string, StoredMembership> = new Map();

  async findById(id: MembershipId): Promise<Membership | null> {
    const row = this.store.get(String(id));
    return row ? this.toDomain(row) : null;
  }

  async findForUserAndOrganization(organizationId: OrganizationId, userId: UserId): Promise<Membership | null> {
    for (const row of this.store.values()) {
      if (
        row.organizationId === organizationId &&
        row.userId === userId &&
        row.status === "active"
      ) {
        return this.toDomain(row);
      }
    }
    return null;
  }

  async findMembership(organizationId: OrganizationId, userId: UserId): Promise<Membership | null> {
    return this.findForUserAndOrganization(organizationId, userId);
  }

  async listForOrganization(organizationId: OrganizationId): Promise<Membership[]> {
    const results: Membership[] = [];
    for (const row of this.store.values()) {
      if (row.organizationId === organizationId && row.status === "active") {
        results.push(this.toDomain(row));
      }
    }
    return results;
  }

  async listActiveOwners(organizationId: OrganizationId): Promise<Membership[]> {
    const results: Membership[] = [];
    for (const row of this.store.values()) {
      if (
        row.organizationId === organizationId &&
        row.status === "active" &&
        normalizeSystemRole(row.role) === "owner"
      ) {
        results.push(this.toDomain(row));
      }
    }
    return results;
  }

  async listForUser(userId: UserId): Promise<Membership[]> {
    const results: Membership[] = [];
    for (const row of this.store.values()) {
      if (row.userId === userId && row.status === "active") {
        results.push(this.toDomain(row));
      }
    }
    return results;
  }

  async list(params: MembershipListParams): Promise<PaginatedResult<Membership>> {
    let items = Array.from(this.store.values()).filter((r) => r.status === "active");

    if (params.organizationId) {
      items = items.filter((r) => r.organizationId === params.organizationId);
    }
    if (params.userId) {
      items = items.filter((r) => r.userId === params.userId);
    }
    if (params.role) {
      items = items.filter((r) => normalizeSystemRole(r.role) === normalizeSystemRole(String(params.role)));
    }

    const total = items.length;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize).map((r) => this.toDomain(r));

    return {
      items: paged,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  }

  async create(candidate: MembershipDraft | Omit<Membership, "id" | "audit" | "version">): Promise<CreateResult<Membership>> {
    // Unique check
    for (const row of this.store.values()) {
      if (
        row.organizationId === candidate.organizationId &&
        row.userId === candidate.userId &&
        row.status === "active"
      ) {
        if (!candidate.websiteScopeId && !row.websiteScopeId) {
          return {
            ok: false,
            error: {
              code: "duplicate_key",
              message: `Active membership already exists for user "${candidate.userId}".`,
              field: "userId",
              value: String(candidate.userId),
            },
          };
        }
        if (candidate.websiteScopeId && row.websiteScopeId === candidate.websiteScopeId) {
          return {
            ok: false,
            error: {
              code: "duplicate_key",
              message: `Active membership already exists for user "${candidate.userId}" in website "${candidate.websiteScopeId}".`,
              field: "userId",
              value: String(candidate.userId),
            },
          };
        }
      }
    }

    const id = "id" in candidate && candidate.id ? candidate.id : (`mem_${this.store.size + 1}` as MembershipId);
    const now = new Date().toISOString();

    const row: StoredMembership = {
      id,
      organizationId: candidate.organizationId,
      userId: candidate.userId,
      role: candidate.role,
      websiteScopeId: candidate.websiteScopeId ?? null,
      status: "active",
      version: 1,
      audit: {
        createdAt: "audit" in candidate && candidate.audit?.createdAt ? candidate.audit.createdAt : now,
        updatedAt: "audit" in candidate && candidate.audit?.updatedAt ? candidate.audit.updatedAt : now,
        createdBy: "audit" in candidate && candidate.audit?.createdBy ? String(candidate.audit.createdBy) : undefined,
      },
    };

    this.store.set(String(id), row);
    return { ok: true, value: this.toDomain(row) };
  }

  async changeRole(
    membershipId: MembershipId,
    newRole: RoleValue,
    expectedVersion: AggregateVersion,
  ): Promise<SaveResult<Membership>> {
    const existing = this.store.get(String(membershipId));
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

    const isCurrentlyOwner = normalizeSystemRole(existing.role) === "owner";
    const willBeOwner = normalizeSystemRole(String(newRole)) === "owner";

    if (isCurrentlyOwner && !willBeOwner) {
      const activeOwners = await this.listActiveOwners(existing.organizationId);
      if (activeOwners.length <= 1 && activeOwners.some((m) => m.id === membershipId)) {
        return {
          ok: false,
          error: {
            code: "invalid_persistence_state",
            message: "Cannot demote the sole remaining active owner of an organization.",
          },
        };
      }
    }

    existing.role = newRole;
    existing.version = (existing.version + 1) as AggregateVersion;
    existing.audit.updatedAt = new Date().toISOString();

    return { ok: true, value: this.toDomain(existing) };
  }

  async archive(
    membershipId: MembershipId,
    expectedVersion: AggregateVersion,
  ): Promise<MutationResult> {
    const existing = this.store.get(String(membershipId));
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

    const isCurrentlyOwner = normalizeSystemRole(existing.role) === "owner";
    if (isCurrentlyOwner) {
      const activeOwners = await this.listActiveOwners(existing.organizationId);
      if (activeOwners.length <= 1 && activeOwners.some((m) => m.id === membershipId)) {
        return {
          ok: false,
          error: {
            code: "invalid_persistence_state",
            message: "Cannot remove the sole remaining active owner of an organization.",
          },
        };
      }
    }

    existing.status = "archived";
    existing.version = (existing.version + 1) as AggregateVersion;
    existing.audit.updatedAt = new Date().toISOString();

    return { ok: true, value: undefined };
  }

  async save(aggregate: Membership, expectedVersion: AggregateVersion): Promise<SaveResult<Membership>> {
    const existing = this.store.get(String(aggregate.id));
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

    existing.role = aggregate.role;
    existing.websiteScopeId = aggregate.websiteScopeId ?? null;
    existing.status = aggregate.status;
    existing.version = (expectedVersion + 1) as AggregateVersion;
    existing.audit.updatedAt = new Date().toISOString();

    return { ok: true, value: this.toDomain(existing) };
  }

  async softDelete(id: MembershipId, expectedVersion: AggregateVersion): Promise<MutationResult> {
    return this.archive(id, expectedVersion);
  }

  private toDomain(row: StoredMembership): Membership {
    return {
      id: row.id,
      organizationId: row.organizationId,
      userId: row.userId,
      role: row.role,
      websiteScopeId: row.websiteScopeId ?? null,
      status: row.status,
      version: row.version,
      audit: row.audit as import("@livingsites/domain").AuditTrail,
    };
  }

  clear(): void {
    this.store.clear();
  }
}
