import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { PageStatus as Status } from "@livingsites/domain";
import { pageDraftToInsert, rowToPage } from "../../db/page-mapper";
import { applicationOutbox, pages } from "../../db/schema";
const duplicate = (error) => /duplicate|unique|23505/i.test(String(error));
export class DrizzlePageRepository {
    config;
    constructor(config) {
        this.config = config;
    }
    async findById(id) {
        const [row] = await this.config.db.select().from(pages).where(eq(pages.id, String(id))).limit(1);
        if (!row)
            return null;
        const mapped = rowToPage(row);
        return mapped.ok ? mapped.value : null;
    }
    async findActiveBySlug(websiteId, slug) {
        const [row] = await this.config.db.select().from(pages).where(and(eq(pages.website_id, String(websiteId)), eq(pages.slug, slug), ne(pages.status, Status.Archived))).limit(1);
        if (!row)
            return null;
        const mapped = rowToPage(row);
        return mapped.ok ? mapped.value : null;
    }
    async listForWebsite(websiteId, options) {
        const rows = await this.config.db.select().from(pages).where(options?.status ? and(eq(pages.website_id, String(websiteId)), eq(pages.status, options.status)) : eq(pages.website_id, String(websiteId))).orderBy(pages.updated_at);
        return rows.flatMap((row) => { const mapped = rowToPage(row); return mapped.ok ? [mapped.value] : []; });
    }
    async createWithEvent(candidate, event) {
        try {
            return await this.config.db.transaction(async (tx) => {
                const [row] = await tx.insert(pages).values(pageDraftToInsert(candidate)).returning();
                if (!row)
                    throw new Error("Page insert returned no row.");
                this.config.beforeOutboxInsert?.();
                await tx.insert(applicationOutbox).values(this.outbox(event));
                const mapped = rowToPage(row);
                if (!mapped.ok)
                    throw new Error(mapped.error.message);
                return { ok: true, value: mapped.value };
            });
        }
        catch (error) {
            if (duplicate(error))
                return { ok: false, error: { code: "duplicate_key", message: "An active Page already uses this slug.", field: "slug", value: String(candidate.slug) } };
            this.config.logger.error("Atomic Page creation failed", { error: String(error) });
            return { ok: false, error: { code: "invalid_persistence_state", message: "Page and event were not persisted." } };
        }
    }
    async updateDetails(input) {
        return this.update(input.pageId, input.expectedVersion, { title: input.title, slug: input.slug, description: input.description ?? null, updated_at: new Date(input.updatedAt), updated_by: input.updatedBy });
    }
    async archiveWithEvent(input, event) {
        return this.atomicMutation(input.pageId, input.expectedVersion, { status: Status.Archived, archived_at: new Date(input.archivedAt), updated_at: new Date(input.archivedAt), updated_by: input.archivedBy }, event);
    }
    async restoreWithEvent(input, event) {
        return this.atomicMutation(input.pageId, input.expectedVersion, { status: Status.Draft, archived_at: null, updated_at: new Date(input.restoredAt), updated_by: input.restoredBy }, event);
    }
    outbox(event) {
        return { id: randomUUID(), event_type: event.type, aggregate_type: "page", aggregate_id: String(event.pageId), organization_id: String(event.eventScope.organizationId), website_id: String(event.eventScope.websiteId), payload: event, occurred_at: new Date(event.occurredAt), idempotency_key: `${event.type}:${String(event.pageId)}:${event.occurredAt}`, schema_version: "1.0.0" };
    }
    async update(id, expectedVersion, changes) {
        try {
            const [row] = await this.config.db.update(pages).set({ ...changes, version: expectedVersion + 1 }).where(and(eq(pages.id, String(id)), eq(pages.version, expectedVersion))).returning();
            if (!row)
                return { ok: false, error: { aggregateId: String(id), expectedVersion, actualVersion: expectedVersion } };
            return rowToPage(row);
        }
        catch (error) {
            return { ok: false, error: { code: "invalid_persistence_state", message: duplicate(error) ? "An active Page already uses this slug." : String(error) } };
        }
    }
    async atomicMutation(id, expectedVersion, changes, event) {
        try {
            return await this.config.db.transaction(async (tx) => {
                const [row] = await tx.update(pages).set({ ...changes, version: expectedVersion + 1 }).where(and(eq(pages.id, String(id)), eq(pages.version, expectedVersion))).returning();
                if (!row)
                    return { ok: false, error: { aggregateId: String(id), expectedVersion, actualVersion: expectedVersion } };
                this.config.beforeOutboxInsert?.();
                await tx.insert(applicationOutbox).values(this.outbox(event));
                return rowToPage(row);
            });
        }
        catch (error) {
            this.config.logger.error("Atomic Page mutation failed", { error: String(error) });
            return { ok: false, error: { code: "invalid_persistence_state", message: "Page mutation and event were rolled back." } };
        }
    }
}
//# sourceMappingURL=drizzle-page-repository.js.map