import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { ISODateString, OrganizationId, PageId, PagePublishedEvent, PageSnapshot, VersionString, WebsiteId } from "@livingsites/domain";
import type { PagePublicationCandidate, PagePublicationError, PagePublisher, PageSnapshotReader } from "@livingsites/application";
import type { Result } from "@livingsites/domain";
import type { Logger } from "@livingsites/platform";
import type { DrizzleDB } from "../../db/drizzle-instance.js";
import { tenantDatabase } from "../../db/tenant-context.js";
import { applicationOutbox, pageSnapshots, pages } from "../../db/schema.js";

export interface DrizzlePagePublicationRepositoryConfig {
  readonly db: DrizzleDB;
  readonly logger: Logger;
  readonly beforeSnapshotInsert?: () => void;
  readonly beforeOutboxInsert?: () => void;
}

function rowToSnapshot(row: typeof pageSnapshots.$inferSelect): PageSnapshot {
  return {
    id: row.id, pageId: row.page_id as PageId, websiteId: row.website_id as WebsiteId, organizationId: row.organization_id as OrganizationId,
    revisionNumber: row.revision_number, releaseVersion: row.release_version ? row.release_version as VersionString : undefined,
    page: row.page_metadata as PageSnapshot["page"], sections: row.sections as PageSnapshot["sections"], seo: row.seo ? row.seo as PageSnapshot["seo"] : undefined,
    createdAt: row.created_at.toISOString() as ISODateString, publishedAt: row.published_at.toISOString() as ISODateString, publishedBy: row.published_by,
  };
}

export class DrizzlePagePublicationRepository implements PageSnapshotReader, PagePublisher {
  constructor(private readonly config: DrizzlePagePublicationRepositoryConfig) {}

  private get db(): DrizzleDB { return tenantDatabase(this.config.db); }

  async findById(id: string): Promise<PageSnapshot | null> {
    const [row] = await this.db.select().from(pageSnapshots).where(eq(pageSnapshots.id, id)).limit(1);
    return row ? rowToSnapshot(row) : null;
  }

  async findLatestForPage(pageId: PageId): Promise<PageSnapshot | null> {
    const [row] = await this.db.select().from(pageSnapshots).where(eq(pageSnapshots.page_id, String(pageId))).orderBy(desc(pageSnapshots.revision_number)).limit(1);
    return row ? rowToSnapshot(row) : null;
  }

  async findByRevision(pageId: PageId, revisionNumber: number): Promise<PageSnapshot | null> {
    const [row] = await this.db.select().from(pageSnapshots).where(and(eq(pageSnapshots.page_id, String(pageId)), eq(pageSnapshots.revision_number, revisionNumber))).limit(1);
    return row ? rowToSnapshot(row) : null;
  }

  async publish(input: { readonly candidate: PagePublicationCandidate; readonly expectedPageVersion: number; readonly event: Omit<PagePublishedEvent, "revisionNumber" | "pageVersion"> }): Promise<Result<PageSnapshot, PagePublicationError>> {
    try {
      return await this.db.transaction(async (tx: DrizzleDB) => {
        await tx.execute(sql`select id from ${pages} where ${pages.id} = ${String(input.candidate.pageId)} for update`);
        const [pageRow] = await tx.select().from(pages).where(and(eq(pages.id, String(input.candidate.pageId)), eq(pages.version, input.expectedPageVersion))).limit(1);
        if (!pageRow) return { ok: false, error: { code: "concurrency_conflict", message: "This Page changed in another session. Reload before publishing." } } as const;

        const [latest] = await tx.select({ revisionNumber: pageSnapshots.revision_number }).from(pageSnapshots).where(eq(pageSnapshots.page_id, String(input.candidate.pageId))).orderBy(desc(pageSnapshots.revision_number)).limit(1);
        const revisionNumber = (latest?.revisionNumber ?? 0) + 1;
        const publishedAt = new Date(input.candidate.publishedAt);
        this.config.beforeSnapshotInsert?.();
        const [snapshotRow] = await tx.insert(pageSnapshots).values({
          id: input.candidate.id, page_id: String(input.candidate.pageId), website_id: String(input.candidate.websiteId), organization_id: String(input.candidate.organizationId),
          revision_number: revisionNumber, release_version: input.candidate.releaseVersion ? String(input.candidate.releaseVersion) : null, page_metadata: input.candidate.page,
          sections: input.candidate.sections, seo: input.candidate.seo ?? null, created_at: publishedAt, published_at: publishedAt, published_by: String(input.candidate.publishedBy),
        }).returning();
        if (!snapshotRow) throw new Error("Snapshot insert returned no row.");

        const [updatedPage] = await tx.update(pages).set({ status: "published", published_snapshot_id: input.candidate.id, version: input.expectedPageVersion + 1, updated_at: publishedAt, updated_by: String(input.candidate.publishedBy) }).where(and(eq(pages.id, String(input.candidate.pageId)), eq(pages.version, input.expectedPageVersion))).returning();
        if (!updatedPage) throw new Error("Page changed during publication.");

        const event: PagePublishedEvent = { ...input.event, snapshotId: input.candidate.id, revisionNumber, pageVersion: updatedPage.version };
        this.config.beforeOutboxInsert?.();
        await tx.insert(applicationOutbox).values({ id: randomUUID(), event_type: event.type, aggregate_type: "page", aggregate_id: String(event.pageId), organization_id: String(event.eventScope.organizationId), website_id: String(event.eventScope.websiteId), payload: event, occurred_at: publishedAt, idempotency_key: `${event.type}:${String(event.pageId)}:${revisionNumber}`, schema_version: "1.0.0" });
        return { ok: true, value: rowToSnapshot(snapshotRow) } as const;
      });
    } catch (error) {
      this.config.logger.error("Atomic Page publication failed", { error: String(error) });
      return { ok: false, error: { code: "persistence_error", message: "Snapshot, Page state, and event were rolled back." } };
    }
  }
}
