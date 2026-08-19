import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { Page, PageArchivedEvent, PageCreatedEvent, PageDraft, PageId, PageRestoredEvent, PageStatus, Section, WebsiteId } from "@livingsites/domain";
import { PageStatus as Status } from "@livingsites/domain";
import type { CreateResult, PageRepository, SaveResult } from "@livingsites/application";
import type { Logger } from "@livingsites/platform";
import type { DrizzleDB } from "../../db/drizzle-instance";
import { pageDraftToInsert, rowToPage } from "../../db/page-mapper";
import { applicationOutbox, pageSections, pages } from "../../db/schema";

export interface DrizzlePageRepositoryConfig { readonly db: DrizzleDB; readonly logger: Logger; readonly beforeOutboxInsert?: () => void }
const duplicate = (error: unknown) => /duplicate|unique|23505/i.test(String(error));

export class DrizzlePageRepository implements PageRepository {
  constructor(private readonly config: DrizzlePageRepositoryConfig) {}

  async findById(id: PageId): Promise<Page | null> {
    const [row] = await this.config.db.select().from(pages).where(eq(pages.id, String(id))).limit(1);
    if (!row) return null;
    const sectionRows = await this.config.db.select().from(pageSections).where(eq(pageSections.page_id, String(id))).orderBy(asc(pageSections.sort_order));
    const mapped = rowToPage(row, sectionRows);
    return mapped.ok ? mapped.value : null;
  }

  async findActiveBySlug(websiteId: WebsiteId, slug: string): Promise<Page | null> {
    const [row] = await this.config.db.select().from(pages).where(and(eq(pages.website_id, String(websiteId)), eq(pages.slug, slug), ne(pages.status, Status.Archived))).limit(1);
    if (!row) return null;
    const sectionRows = await this.config.db.select().from(pageSections).where(eq(pageSections.page_id, row.id)).orderBy(asc(pageSections.sort_order));
    const mapped = rowToPage(row, sectionRows);
    return mapped.ok ? mapped.value : null;
  }

  async listForWebsite(websiteId: WebsiteId, options?: { readonly status?: PageStatus }): Promise<readonly Page[]> {
    const rows = await this.config.db.select().from(pages).where(options?.status ? and(eq(pages.website_id, String(websiteId)), eq(pages.status, options.status)) : eq(pages.website_id, String(websiteId))).orderBy(pages.updated_at);
    if (!rows.length) return [];
    const sectionRows = await this.config.db.select().from(pageSections).where(inArray(pageSections.page_id, rows.map((row: typeof pages.$inferSelect) => row.id))).orderBy(asc(pageSections.sort_order));
    return rows.flatMap((row: typeof pages.$inferSelect) => { const mapped = rowToPage(row, sectionRows.filter((section: typeof pageSections.$inferSelect) => section.page_id === row.id)); return mapped.ok ? [mapped.value] : []; });
  }

  async createWithEvent(candidate: PageDraft, event: PageCreatedEvent): Promise<CreateResult<Page>> {
    try {
      return await this.config.db.transaction(async (tx: DrizzleDB) => {
        const [row] = await tx.insert(pages).values(pageDraftToInsert(candidate)).returning();
        if (!row) throw new Error("Page insert returned no row.");
        this.config.beforeOutboxInsert?.();
        await tx.insert(applicationOutbox).values(this.outbox(event));
        const mapped = rowToPage(row);
        if (!mapped.ok) throw new Error(mapped.error.message);
        return { ok: true, value: mapped.value } as CreateResult<Page>;
      });
    } catch (error) {
      if (duplicate(error)) return { ok: false, error: { code: "duplicate_key", message: "An active Page already uses this slug.", field: "slug", value: String(candidate.slug) } };
      this.config.logger.error("Atomic Page creation failed", { error: String(error) });
      return { ok: false, error: { code: "invalid_persistence_state", message: "Page and event were not persisted." } };
    }
  }

  async updateDetails(input: { pageId: PageId; title: string; slug: string; description?: string; expectedVersion: number; updatedAt: string; updatedBy: string }): Promise<SaveResult<Page>> {
    return this.update(input.pageId, input.expectedVersion, { title: input.title, slug: input.slug, description: input.description ?? null, updated_at: new Date(input.updatedAt), updated_by: input.updatedBy });
  }

  async saveBuilder(input: { pageId: PageId; sections: readonly Section[]; expectedVersion: number; updatedAt: string; updatedBy: string }): Promise<SaveResult<Page>> {
    try {
      return await this.config.db.transaction(async (tx: DrizzleDB) => {
        const [pageRow] = await tx.update(pages).set({ section_order: input.sections.map((section) => String(section.id)), version: input.expectedVersion + 1, updated_at: new Date(input.updatedAt), updated_by: input.updatedBy }).where(and(eq(pages.id, String(input.pageId)), eq(pages.version, input.expectedVersion))).returning();
        if (!pageRow) return { ok: false, error: { aggregateId: String(input.pageId), expectedVersion: input.expectedVersion, actualVersion: input.expectedVersion } };
        await tx.delete(pageSections).where(eq(pageSections.page_id, String(input.pageId)));
        if (input.sections.length) await tx.insert(pageSections).values(input.sections.map((section, index) => ({ id: String(section.id), page_id: String(input.pageId), website_id: String(section.websiteId), section_type_id: String(section.sectionTypeId), sort_order: index, props: section.props, status: section.status, created_at: new Date(section.audit.createdAt), updated_at: new Date(input.updatedAt), created_by: section.audit.createdBy ? String(section.audit.createdBy) : null, updated_by: input.updatedBy })));
        const persistedSections = await tx.select().from(pageSections).where(eq(pageSections.page_id, String(input.pageId))).orderBy(asc(pageSections.sort_order));
        return rowToPage(pageRow, persistedSections);
      });
    } catch (error) {
      this.config.logger.error("Atomic Page builder save failed", { error: String(error) });
      return { ok: false, error: { code: "invalid_persistence_state", message: "Page and Sections were not persisted." } };
    }
  }

  async archiveWithEvent(input: { pageId: PageId; expectedVersion: number; archivedAt: string; archivedBy: string }, event: PageArchivedEvent): Promise<SaveResult<Page>> {
    return this.atomicMutation(input.pageId, input.expectedVersion, { status: Status.Archived, archived_at: new Date(input.archivedAt), updated_at: new Date(input.archivedAt), updated_by: input.archivedBy }, event);
  }

  async restoreWithEvent(input: { pageId: PageId; expectedVersion: number; restoredAt: string; restoredBy: string }, event: PageRestoredEvent): Promise<SaveResult<Page>> {
    return this.atomicMutation(input.pageId, input.expectedVersion, { status: Status.Draft, archived_at: null, updated_at: new Date(input.restoredAt), updated_by: input.restoredBy }, event);
  }

  private outbox(event: PageCreatedEvent | PageArchivedEvent | PageRestoredEvent) {
    return { id: randomUUID(), event_type: event.type, aggregate_type: "page", aggregate_id: String(event.pageId), organization_id: String(event.eventScope.organizationId), website_id: String(event.eventScope.websiteId), payload: event, occurred_at: new Date(event.occurredAt), idempotency_key: `${event.type}:${String(event.pageId)}:${event.occurredAt}`, schema_version: "1.0.0" };
  }

  private async update(id: PageId, expectedVersion: number, changes: Partial<typeof pages.$inferInsert>): Promise<SaveResult<Page>> {
    try {
      const [row] = await this.config.db.update(pages).set({ ...changes, version: expectedVersion + 1 }).where(and(eq(pages.id, String(id)), eq(pages.version, expectedVersion))).returning();
      if (!row) return { ok: false, error: { aggregateId: String(id), expectedVersion, actualVersion: expectedVersion } };
      return rowToPage(row);
    } catch (error) {
      return { ok: false, error: { code: "invalid_persistence_state", message: duplicate(error) ? "An active Page already uses this slug." : String(error) } };
    }
  }

  private async atomicMutation(id: PageId, expectedVersion: number, changes: Partial<typeof pages.$inferInsert>, event: PageArchivedEvent | PageRestoredEvent): Promise<SaveResult<Page>> {
    try {
      return await this.config.db.transaction(async (tx: DrizzleDB) => {
        const [row] = await tx.update(pages).set({ ...changes, version: expectedVersion + 1 }).where(and(eq(pages.id, String(id)), eq(pages.version, expectedVersion))).returning();
        if (!row) return { ok: false, error: { aggregateId: String(id), expectedVersion, actualVersion: expectedVersion } };
        this.config.beforeOutboxInsert?.();
        await tx.insert(applicationOutbox).values(this.outbox(event));
        return rowToPage(row);
      });
    } catch (error) {
      this.config.logger.error("Atomic Page mutation failed", { error: String(error) });
      return { ok: false, error: { code: "invalid_persistence_state", message: "Page mutation and event were rolled back." } };
    }
  }
}
