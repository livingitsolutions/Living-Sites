import { normalizeOrganizationRole, normalizeSystemRole } from "@livingsites/application";
export class InMemoryMembershipRepository {
    store = new Map();
    publishedEvents = [];
    async findById(id) {
        const row = this.store.get(String(id));
        return row ? this.toDomain(row) : null;
    }
    async findForUserAndOrganization(organizationId, userId, websiteId = null) {
        const candidates = await this.listForUserAndOrganization(organizationId, userId);
        const organizationWide = candidates.find((membership) => !membership.websiteScopeId);
        if (organizationWide)
            return organizationWide;
        if (!websiteId)
            return null;
        return candidates.find((membership) => membership.websiteScopeId === websiteId) ?? null;
    }
    async listForUserAndOrganization(organizationId, userId) {
        return [...this.store.values()]
            .filter((row) => row.organizationId === organizationId && row.userId === userId && row.status === "active")
            .map((row) => this.toDomain(row));
    }
    async listForOrganization(organizationId) {
        return [...this.store.values()]
            .filter((row) => row.organizationId === organizationId && row.status === "active")
            .map((row) => this.toDomain(row));
    }
    async listActiveOwners(organizationId) {
        return (await this.listForOrganization(organizationId))
            .filter((membership) => normalizeSystemRole(membership.role) === "owner");
    }
    async listForUser(userId) {
        return [...this.store.values()]
            .filter((row) => row.userId === userId && row.status === "active")
            .map((row) => this.toDomain(row));
    }
    async list(params) {
        let rows = [...this.store.values()].filter((row) => row.status === "active");
        if (params.organizationId)
            rows = rows.filter((row) => row.organizationId === params.organizationId);
        if (params.userId)
            rows = rows.filter((row) => row.userId === params.userId);
        if (params.role)
            rows = rows.filter((row) => normalizeSystemRole(row.role) === normalizeSystemRole(String(params.role)));
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
    async create(candidate) {
        const role = normalizeOrganizationRole(String(candidate.role));
        if (!role) {
            return {
                ok: false,
                error: { code: "invalid_persistence_state", message: `Invalid organization membership role "${candidate.role}".` },
            };
        }
        const scope = candidate.websiteScopeId ?? null;
        const duplicate = [...this.store.values()].some((row) => row.organizationId === candidate.organizationId
            && row.userId === candidate.userId
            && row.status === "active"
            && (row.websiteScopeId ?? null) === scope);
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
        const id = ("id" in candidate && candidate.id ? candidate.id : randomUUID());
        const row = {
            id,
            organizationId: candidate.organizationId,
            userId: candidate.userId,
            role: role,
            websiteScopeId: scope,
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
    async createWithEvent(candidate, event) {
        const result = await this.create(candidate);
        if (result.ok)
            this.publishedEvents.push(event);
        return result;
    }
    async changeRole(membershipId, newRole, expectedVersion) {
        const role = normalizeOrganizationRole(String(newRole));
        if (!role) {
            return {
                ok: false,
                error: { code: "invalid_persistence_state", message: `Invalid organization membership role "${newRole}".` },
            };
        }
        const existing = this.store.get(String(membershipId));
        if (!existing)
            return this.notFound(membershipId);
        if (existing.version !== expectedVersion)
            return this.conflict(membershipId, expectedVersion, existing.version);
        if (normalizeSystemRole(existing.role) === "owner" && role !== "owner") {
            const activeOwners = await this.listActiveOwners(existing.organizationId);
            if (activeOwners.length <= 1 && activeOwners.some((owner) => owner.id === membershipId)) {
                return {
                    ok: false,
                    error: { code: "invalid_persistence_state", message: "Cannot demote the sole remaining active owner of an organization." },
                };
            }
        }
        existing.role = role;
        existing.version = (existing.version + 1);
        existing.audit.updatedAt = new Date().toISOString();
        return { ok: true, value: this.toDomain(existing) };
    }
    async changeRoleWithEvent(membershipId, newRole, expectedVersion, event) {
        const result = await this.changeRole(membershipId, newRole, expectedVersion);
        if (result.ok)
            this.publishedEvents.push(event);
        return result;
    }
    async archive(membershipId, expectedVersion) {
        const existing = this.store.get(String(membershipId));
        if (!existing)
            return this.notFound(membershipId);
        if (existing.version !== expectedVersion)
            return this.conflict(membershipId, expectedVersion, existing.version);
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
        existing.version = (existing.version + 1);
        existing.audit.updatedAt = new Date().toISOString();
        return { ok: true, value: undefined };
    }
    async archiveWithEvent(membershipId, expectedVersion, event) {
        const result = await this.archive(membershipId, expectedVersion);
        if (result.ok)
            this.publishedEvents.push(event);
        return result;
    }
    async softDelete(id, expectedVersion) {
        return this.archive(id, expectedVersion);
    }
    clear() {
        this.store.clear();
        this.publishedEvents.length = 0;
    }
    notFound(membershipId) {
        return {
            ok: false,
            error: { code: "invalid_persistence_state", message: `Membership "${membershipId}" not found.` },
        };
    }
    conflict(membershipId, expectedVersion, actualVersion) {
        return { ok: false, error: { aggregateId: String(membershipId), expectedVersion, actualVersion } };
    }
    toDomain(row) {
        return {
            id: row.id,
            organizationId: row.organizationId,
            userId: row.userId,
            role: row.role,
            websiteScopeId: row.websiteScopeId ?? null,
            status: row.status,
            version: row.version,
            audit: row.audit,
        };
    }
}
import { randomUUID } from "node:crypto";
//# sourceMappingURL=in-memory-membership-repository.js.map