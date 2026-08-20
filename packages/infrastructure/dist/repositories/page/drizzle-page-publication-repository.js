import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { tenantDatabase } from "../../db/tenant-context.js";
import { applicationOutbox, pageSnapshots, pages } from "../../db/schema.js";
function rowToSnapshot(row) {
    return {
        id: row.id, pageId: row.page_id, websiteId: row.website_id, organizationId: row.organization_id,
        revisionNumber: row.revision_number, releaseVersion: row.release_version ? row.release_version : undefined,
        page: row.page_metadata, sections: row.sections, seo: row.seo ? row.seo : undefined,
        createdAt: row.created_at.toISOString(), publishedAt: row.published_at.toISOString(), publishedBy: row.published_by,
    };
}
export class DrizzlePagePublicationRepository {
    config;
    constructor(config) {
        this.config = config;
    }
    get db() { return tenantDatabase(this.config.db); }
    async findById(id) {
        const [row] = await this.db.select().from(pageSnapshots).where(eq(pageSnapshots.id, id)).limit(1);
        return row ? rowToSnapshot(row) : null;
    }
    async findLatestForPage(pageId) {
        const [row] = await this.db.select().from(pageSnapshots).where(eq(pageSnapshots.page_id, String(pageId))).orderBy(desc(pageSnapshots.revision_number)).limit(1);
        return row ? rowToSnapshot(row) : null;
    }
    async findByRevision(pageId, revisionNumber) {
        const [row] = await this.db.select().from(pageSnapshots).where(and(eq(pageSnapshots.page_id, String(pageId)), eq(pageSnapshots.revision_number, revisionNumber))).limit(1);
        return row ? rowToSnapshot(row) : null;
    }
    async listForPage(pageId) {
        const rows = await this.db.select().from(pageSnapshots).where(eq(pageSnapshots.page_id, String(pageId))).orderBy(desc(pageSnapshots.revision_number));
        return rows.map(rowToSnapshot);
    }
    async publish(input) {
        try {
            return await this.db.transaction(async (tx) => {
                await tx.execute(sql `select id from ${pages} where ${pages.id} = ${String(input.candidate.pageId)} for update`);
                const [pageRow] = await tx.select().from(pages).where(and(eq(pages.id, String(input.candidate.pageId)), eq(pages.version, input.expectedPageVersion))).limit(1);
                if (!pageRow)
                    return { ok: false, error: { code: "concurrency_conflict", message: "This Page changed in another session. Reload before publishing." } };
                const [latest] = await tx.select({ revisionNumber: pageSnapshots.revision_number }).from(pageSnapshots).where(eq(pageSnapshots.page_id, String(input.candidate.pageId))).orderBy(desc(pageSnapshots.revision_number)).limit(1);
                const revisionNumber = (latest?.revisionNumber ?? 0) + 1;
                const publishedAt = new Date(input.candidate.publishedAt);
                this.config.beforeSnapshotInsert?.();
                const [snapshotRow] = await tx.insert(pageSnapshots).values({
                    id: input.candidate.id, page_id: String(input.candidate.pageId), website_id: String(input.candidate.websiteId), organization_id: String(input.candidate.organizationId),
                    revision_number: revisionNumber, release_version: input.candidate.releaseVersion ? String(input.candidate.releaseVersion) : null, page_metadata: input.candidate.page,
                    sections: input.candidate.sections, seo: input.candidate.seo ?? null, created_at: publishedAt, published_at: publishedAt, published_by: String(input.candidate.publishedBy),
                }).returning();
                if (!snapshotRow)
                    throw new Error("Snapshot insert returned no row.");
                const [updatedPage] = await tx.update(pages).set({ status: "published", published_snapshot_id: input.candidate.id, version: input.expectedPageVersion + 1, updated_at: publishedAt, updated_by: String(input.candidate.publishedBy) }).where(and(eq(pages.id, String(input.candidate.pageId)), eq(pages.version, input.expectedPageVersion))).returning();
                if (!updatedPage)
                    throw new Error("Page changed during publication.");
                const event = { ...input.event, snapshotId: input.candidate.id, revisionNumber, pageVersion: updatedPage.version };
                this.config.beforeOutboxInsert?.();
                await tx.insert(applicationOutbox).values({ id: randomUUID(), event_type: event.type, aggregate_type: "page", aggregate_id: String(event.pageId), organization_id: String(event.eventScope.organizationId), website_id: String(event.eventScope.websiteId), payload: event, occurred_at: publishedAt, idempotency_key: `${event.type}:${String(event.pageId)}:${revisionNumber}`, schema_version: "1.0.0" });
                return { ok: true, value: rowToSnapshot(snapshotRow) };
            });
        }
        catch (error) {
            this.config.logger.error("Atomic Page publication failed", { error: String(error) });
            return { ok: false, error: { code: "persistence_error", message: "Snapshot, Page state, and event were rolled back." } };
        }
    }
    async rollback(input) {
        try {
            return await this.db.transaction(async (tx) => {
                await tx.execute(sql `select id from ${pages} where ${pages.id} = ${String(input.pageId)} for update`);
                const [pageRow] = await tx.select().from(pages).where(and(eq(pages.id, String(input.pageId)), eq(pages.website_id, String(input.websiteId)), eq(pages.version, input.expectedPageVersion))).limit(1);
                if (!pageRow)
                    return { ok: false, error: { code: "concurrency_conflict", message: "This Page changed in another session. Reload before rolling back." } };
                const [target] = await tx.select().from(pageSnapshots).where(and(eq(pageSnapshots.page_id, String(input.pageId)), eq(pageSnapshots.website_id, String(input.websiteId)), eq(pageSnapshots.organization_id, String(input.organizationId)), eq(pageSnapshots.revision_number, input.targetRevisionNumber))).limit(1);
                if (!target)
                    throw new Error("Rollback target snapshot was not found.");
                const [latest] = await tx.select({ revisionNumber: pageSnapshots.revision_number }).from(pageSnapshots).where(eq(pageSnapshots.page_id, String(input.pageId))).orderBy(desc(pageSnapshots.revision_number)).limit(1);
                const newRevisionNumber = (latest?.revisionNumber ?? 0) + 1;
                const rolledBackAt = new Date(input.rolledBackAt);
                this.config.beforeSnapshotInsert?.();
                const [snapshotRow] = await tx.insert(pageSnapshots).values({
                    id: input.newSnapshotId,
                    page_id: target.page_id,
                    website_id: target.website_id,
                    organization_id: target.organization_id,
                    revision_number: newRevisionNumber,
                    release_version: target.release_version,
                    page_metadata: target.page_metadata,
                    sections: target.sections,
                    seo: target.seo,
                    created_at: rolledBackAt,
                    published_at: rolledBackAt,
                    published_by: String(input.rolledBackBy),
                }).returning();
                if (!snapshotRow)
                    throw new Error("Rollback snapshot insert returned no row.");
                const [updatedPage] = await tx.update(pages).set({ status: "published", published_snapshot_id: input.newSnapshotId, version: input.expectedPageVersion + 1, updated_at: rolledBackAt, updated_by: String(input.rolledBackBy) }).where(and(eq(pages.id, String(input.pageId)), eq(pages.version, input.expectedPageVersion))).returning();
                if (!updatedPage)
                    throw new Error("Page changed during rollback.");
                const event = { ...input.event, targetSnapshotId: target.id, newRevisionNumber, pageVersion: updatedPage.version };
                this.config.beforeOutboxInsert?.();
                await tx.insert(applicationOutbox).values({
                    id: randomUUID(), event_type: event.type, aggregate_type: "page", aggregate_id: String(input.pageId), organization_id: String(input.organizationId), website_id: String(input.websiteId),
                    payload: event, occurred_at: rolledBackAt, idempotency_key: `${event.type}:${input.newSnapshotId}`, schema_version: "1.0.0",
                });
                return { ok: true, value: rowToSnapshot(snapshotRow) };
            });
        }
        catch (error) {
            this.config.logger.error("Atomic Page publication rollback failed", { error: String(error) });
            return { ok: false, error: { code: "persistence_error", message: "Page publication rollback could not be persisted." } };
        }
    }
}
//# sourceMappingURL=drizzle-page-publication-repository.js.map