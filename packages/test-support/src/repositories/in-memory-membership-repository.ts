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
  CreateResult,
  MembershipListParams,
  MembershipMutationPersistence,
  MembershipRepository,
  MutationResult,
  SaveResult,
} from "@livingsites/application";
import { normalizeOrganizationRole, normalizeSystemRole } from "@livingsites/application";

type MembershipEvent = OrganizationMemberAddedEvent | OrganizationMemberRoleChangedEvent | OrganizationMemberRemovedEvent;

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

export class InMemoryMembershipRepository implements MembershipRepository, MembershipMutationPersistence {
  private store = new Map<string, StoredMembership>();
  readonly publishedEvents: MembershipEvent[] = [];

  async findById(id: MembershipId): Promise<Membership | null> {
    const row = this.store.get(String(id));
    return row ? this.toDomain(row) : null;
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

  async listForUserAndOrganization(organizationId: OrganizationId, userId: UserId): Promise<Membership[]> {
    return [...this.store.values()]
      .filter((row) => row.organizationId === organizationId && row.userId === userId && row.status === "active")
      .map((row) => this.toDomain(row));
  }

  async listForOrganization(organizationId: OrganizationId): Promise<Membership[]> {
    return [...this.store.values()]
      .filter((row) => row.organizationId === organizationId && row.status === "active")
      .map((row) => this.toDomain(row));
  }

  async listActiveOwners(organizationId: OrganizationId): Promise<Membership[]> {
    return (await this.listForOrganization(organizationId))
      .filter((membership) => normalizeSystemRole(membership.role) === "owner");
  }

  async listForUser(userId: UserId): Promise<Membership[]> {
    return [...this.store.values()]
      .filter((row) => row.userId === userId && row.status === "active")
      .map((row) => this.toDomain(row));
  }

  async list(params: MembershipListParams): Promise<PaginatedResult<Membership>> {
    let rows = [...this.store.values()].filter((row) => row.status === "active");
    if (params.organizationId) rows = rows.filter((row) => row.organizationId === params.organizationId);
    if (params.userId) rows = rows.filter((row) => row.userId === params.userId);
    if (params.role) rows = rows.filter((row) => normalizeSystemRole(row.role) === normalizeSystemRole(String(params.role)));
    const total = rows.length;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const start = (page - 1) * pageSize;
    return {
      items: rows.slice(start, start + pageSize).map((row) => this.toDomain(row)),
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  }

  async create(
    candidate: MembershipDraft | Omit<Membership, "id" | "audit" | "version">,
  ): Promise<CreateResult<Membership>> {
    const role = normalizeOrganizationRole(String(candidate.role));
    if (!role) {
      return {
        ok: false,
        error: { code: "invalid_persistence_state", message: `Invalid organization membership role "${candidate.role}".` },
      };
    }
    const scope = candidate.websiteScopeId ?? null;
    const duplicate = [...this.store.values()].some((row) =>
      row.organizationId === candidate.organizationId
      && row.userId === candidate.userId
      && row.status === "active"
      && (row.websiteScopeId ?? null) === scope,
    );
    if (duplicate) {
      return {
        ok: false,
        error: {
          code: "duplicate_key",
          message: "Active membership already exists for this organization scope.",
          field: "userId",
          value: String(candidate.userId),
        },
      };
    }
    const now = new Date().toISOString();
    const id = ("id" in candidate && candidate.id ? candidate.id : randomUUID()) as MembershipId;
    const row: StoredMembership = {
      id,
      organizationId: candidate.organizationId,
      userId: candidate.userId,
      role: role as RoleValue,
      websiteScopeId: scope,
      status: "active",
      version: 1 as AggregateVersion,
      audit: {
        createdAt: "audit" in candidate && candidate.audit?.createdAt ? candidate.audit.createdAt : now,
        updatedAt: "audit" in candidate && candidate.audit?.updatedAt ? candidate.audit.updatedAt : now,
        createdBy: "audit" in candidate && candidate.audit?.createdBy ? String(candidate.audit.createdBy) : undefined,
      },
    };
    this.store.set(String(id), row);
    return { ok: true, value: this.toDomain(row) };
  }

  async createWithEvent(
    candidate: MembershipDraft | Omit<Membership, "id" | "audit" | "version">,
    event: OrganizationMemberAddedEvent,
  ): Promise<CreateResult<Membership>> {
    const result = await this.create(candidate);
    if (result.ok) this.publishedEvents.push(event);
    return result;
  }

  async changeRole(
    membershipId: MembershipId,
    newRole: RoleValue,
    expectedVersion: AggregateVersion,
  ): Promise<SaveResult<Membership>> {
    const role = normalizeOrganizationRole(String(newRole));
    if (!role) {
      return {
        ok: false,
        error: { code: "invalid_persistence_state", message: `Invalid organization membership role "${newRole}".` },
      };
    }
    const existing = this.store.get(String(membershipId));
    if (!existing) return this.notFound(membershipId);
    if (existing.version !== expectedVersion) return this.conflict(membershipId, expectedVersion, existing.version);
    if (normalizeSystemRole(existing.role) === "owner" && role !== "owner") {
      const activeOwners = await this.listActiveOwners(existing.organizationId);
      if (activeOwners.length <= 1 && activeOwners.some((owner) => owner.id === membershipId)) {
        return {
          ok: false,
          error: { code: "invalid_persistence_state", message: "Cannot demote the sole remaining active owner of an organization." },
        };
      }
    }
    existing.role = role as RoleValue;
    existing.version = (existing.version + 1) as AggregateVersion;
    existing.audit.updatedAt = new Date().toISOString();
    return { ok: true, value: this.toDomain(existing) };
  }

  async changeRoleWithEvent(
    membershipId: MembershipId,
    newRole: RoleValue,
    expectedVersion: AggregateVersion,
    event: OrganizationMemberRoleChangedEvent,
  ): Promise<SaveResult<Membership>> {
    const result = await this.changeRole(membershipId, newRole, expectedVersion);
    if (result.ok) this.publishedEvents.push(event);
    return result;
  }

  async archive(membershipId: MembershipId, expectedVersion: AggregateVersion): Promise<MutationResult> {
    const existing = this.store.get(String(membershipId));
    if (!existing) return this.notFound(membershipId);
    if (existing.version !== expectedVersion) return this.conflict(membershipId, expectedVersion, existing.version);
    if (normalizeSystemRole(existing.role) === "owner") {
      const activeOwners = await this.listActiveOwners(existing.organizationId);
      if (activeOwners.length <= 1 && activeOwners.some((owner) => owner.id === membershipId)) {
        return {
          ok: false,
          error: { code: "invalid_persistence_state", message: "Cannot remove the sole remaining active owner of an organization." },
        };
      }
    }
    existing.status = "archived";
    existing.version = (existing.version + 1) as AggregateVersion;
    existing.audit.updatedAt = new Date().toISOString();
    return { ok: true, value: undefined };
  }

  async archiveWithEvent(
    membershipId: MembershipId,
    expectedVersion: AggregateVersion,
    event: OrganizationMemberRemovedEvent,
  ): Promise<MutationResult> {
    const result = await this.archive(membershipId, expectedVersion);
    if (result.ok) this.publishedEvents.push(event);
    return result;
  }

  async softDelete(id: MembershipId, expectedVersion: AggregateVersion): Promise<MutationResult> {
    return this.archive(id, expectedVersion);
  }

  clear(): void {
    this.store.clear();
    this.publishedEvents.length = 0;
  }

  private notFound(membershipId: MembershipId) {
    return {
      ok: false as const,
      error: { code: "invalid_persistence_state" as const, message: `Membership "${membershipId}" not found.` },
    };
  }

  private conflict(membershipId: MembershipId, expectedVersion: AggregateVersion, actualVersion: AggregateVersion) {
    return { ok: false as const, error: { aggregateId: String(membershipId), expectedVersion, actualVersion } };
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
}
import { randomUUID } from "node:crypto";
