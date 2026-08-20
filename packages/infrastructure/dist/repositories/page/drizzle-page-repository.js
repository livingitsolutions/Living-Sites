import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { PageStatus as Status } from "@livingsites/domain";
import { tenantDatabase } from "../../db/tenant-context.js";
import { pageDraftToInsert, rowToPage } from "../../db/page-mapper.js";
import { applicationOutbox, pageSections, pages } from "../../db/schema.js";
const duplicate = (error) => /duplicate|unique|23505/i.test(String(error));
export class DrizzlePageRepository {
    config;
    constructor(config) {
        this.config = config;
    }
    get db() { return tenantDatabase(this.config.db); }
    async findById(id) {
        const [row] = await this.db.select().from(pages).where(eq(pages.id, String(id))).limit(1);
        if (!row)
            return null;
        const sectionRows = await this.db.select().from(pageSections).where(eq(pageSections.page_id, String(id))).orderBy(asc(pageSections.sort_order));
        const mapped = rowToPage(row, sectionRows);
        return mapped.ok ? mapped.value : null;
    }
    async findActiveBySlug(websiteId, slug) {
        const [row] = await this.db.select().from(pages).where(and(eq(pages.website_id, String(websiteId)), eq(pages.slug, slug), ne(pages.status, Status.Archived))).limit(1);
        if (!row)
            return null;
        const sectionRows = await this.db.select().from(pageSections).where(eq(pageSections.page_id, row.id)).orderBy(asc(pageSections.sort_order));
        const mapped = rowToPage(row, sectionRows);
        return mapped.ok ? mapped.value : null;
    }
    async listForWebsite(websiteId, options) {
        const rows = await this.db.select().from(pages).where(options?.status ? and(eq(pages.website_id, String(websiteId)), eq(pages.status, options.status)) : eq(pages.website_id, String(websiteId))).orderBy(pages.updated_at);
        if (!rows.length)
            return [];
        const sectionRows = await this.db.select().from(pageSections).where(inArray(pageSections.page_id, rows.map((row) => row.id))).orderBy(asc(pageSections.sort_order));
        return rows.flatMap((row) => { const mapped = rowToPage(row, sectionRows.filter((section) => section.page_id === row.id)); return mapped.ok ? [mapped.value] : []; });
    }
    async createWithEvent(candidate, event) {
        try {
            return await this.db.transaction(async (tx) => {
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
    async saveBuilder(input) {
        try {
            return await this.db.transaction(async (tx) => {
                const [pageRow] = await tx.update(pages).set({ section_order: input.sections.map((section) => String(section.id)), status: Status.Draft, version: input.expectedVersion + 1, updated_at: new Date(input.updatedAt), updated_by: input.updatedBy }).where(and(eq(pages.id, String(input.pageId)), eq(pages.version, input.expectedVersion))).returning();
                if (!pageRow)
                    return { ok: false, error: { aggregateId: String(input.pageId), expectedVersion: input.expectedVersion, actualVersion: input.expectedVersion } };
                await tx.delete(pageSections).where(eq(pageSections.page_id, String(input.pageId)));
                if (input.sections.length)
                    await tx.insert(pageSections).values(input.sections.map((section, index) => ({ id: String(section.id), page_id: String(input.pageId), website_id: String(section.websiteId), section_type_id: String(section.sectionTypeId), sort_order: index, props: section.props, status: section.status, created_at: new Date(section.audit.createdAt), updated_at: new Date(input.updatedAt), created_by: section.audit.createdBy ? String(section.audit.createdBy) : null, updated_by: input.updatedBy })));
                const persistedSections = await tx.select().from(pageSections).where(eq(pageSections.page_id, String(input.pageId))).orderBy(asc(pageSections.sort_order));
                return rowToPage(pageRow, persistedSections);
            });
        }
        catch (error) {
            this.config.logger.error("Atomic Page builder save failed", { error: String(error) });
            return { ok: false, error: { code: "invalid_persistence_state", message: "Page and Sections were not persisted." } };
        }
    }
    async archiveWithEvent(input, event) {
        return this.atomicMutation(input.pageId, input.expectedVersion, { status: Status.Archived, is_homepage: false, archived_at: new Date(input.archivedAt), updated_at: new Date(input.archivedAt), updated_by: input.archivedBy }, event);
    }
    async restoreWithEvent(input, event) {
        return this.atomicMutation(input.pageId, input.expectedVersion, { status: Status.Draft, archived_at: null, updated_at: new Date(input.restoredAt), updated_by: input.restoredBy }, event);
    }
    async setWebsiteHomepage(input) {
        try {
            return await this.db.transaction(async (tx) => {
                await tx.execute(sql `select id from ${pages} where ${pages.website_id} = ${String(input.websiteId)} for update`);
                const [target] = await tx.select().from(pages).where(and(eq(pages.id, String(input.pageId)), eq(pages.website_id, String(input.websiteId)))).limit(1);
                if (!target)
                    return { ok: false, error: { code: "not_found", message: "Page was not found in this Website." } };
                if (target.status === Status.Archived || target.archived_at)
                    return { ok: false, error: { code: "archived_target", message: "An archived Page cannot be the Website homepage." } };
                if (target.version !== input.expectedPageVersion)
                    return { ok: false, error: { code: "concurrency_conflict", message: "Page changed since it was loaded." } };
                if (target.is_homepage)
                    return { ok: false, error: { code: "already_homepage", message: "This Page is already the Website homepage." } };
                const previousHomepages = await tx.select({ id: pages.id }).from(pages).where(and(eq(pages.website_id, String(input.websiteId)), eq(pages.is_homepage, true), ne(pages.status, Status.Archived)));
                const changedAt = new Date(input.changedAt);
                if (previousHomepages.length) {
                    await tx.update(pages).set({ is_homepage: false, version: sql `${pages.version} + 1`, updated_at: changedAt, updated_by: input.changedBy }).where(inArray(pages.id, previousHomepages.map((page) => page.id)));
                }
                const [updatedTarget] = await tx.update(pages).set({ is_homepage: true, version: input.expectedPageVersion + 1, updated_at: changedAt, updated_by: input.changedBy }).where(and(eq(pages.id, String(input.pageId)), eq(pages.website_id, String(input.websiteId)), eq(pages.version, input.expectedPageVersion))).returning();
                if (!updatedTarget)
                    return { ok: false, error: { code: "concurrency_conflict", message: "Page changed since it was loaded." } };
                const event = { ...input.event, previousHomepagePageId: previousHomepages[0]?.id ?? null, pageVersion: updatedTarget.version };
                this.config.beforeOutboxInsert?.();
                await tx.insert(applicationOutbox).values({
                    id: randomUUID(), event_type: event.type, aggregate_type: "website", aggregate_id: String(input.websiteId), organization_id: String(event.eventScope.organizationId), website_id: String(input.websiteId), payload: event, occurred_at: changedAt, idempotency_key: `${event.type}:${String(input.websiteId)}:${String(input.pageId)}:${updatedTarget.version}`, schema_version: "1.0.0",
                });
                const mapped = rowToPage(updatedTarget);
                if (!mapped.ok)
                    throw new Error(mapped.error.message);
                return { ok: true, value: mapped.value };
            });
        }
        catch (error) {
            this.config.logger.error("Atomic Website homepage change failed", { websiteId: String(input.websiteId), pageId: String(input.pageId), error: String(error) });
            return { ok: false, error: { code: "persistence_error", message: "Homepage change and event were rolled back." } };
        }
    }
    outbox(event) {
        return { id: randomUUID(), event_type: event.type, aggregate_type: "page", aggregate_id: String(event.pageId), organization_id: String(event.eventScope.organizationId), website_id: String(event.eventScope.websiteId), payload: event, occurred_at: new Date(event.occurredAt), idempotency_key: `${event.type}:${String(event.pageId)}:${event.occurredAt}`, schema_version: "1.0.0" };
    }
    async update(id, expectedVersion, changes) {
        try {
            const [row] = await this.db.update(pages).set({ ...changes, version: expectedVersion + 1 }).where(and(eq(pages.id, String(id)), eq(pages.version, expectedVersion))).returning();
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
            return await this.db.transaction(async (tx) => {
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