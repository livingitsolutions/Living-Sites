import type { AggregateVersion, Page, PageArchivedEvent, PageCreatedEvent, PageDraft, PageId, PageRestoredEvent, PageStatus, WebsiteId } from "@livingsites/domain";
import type { CreateResult, SaveResult } from "../contracts";

export interface PageReader {
  findById(id: PageId): Promise<Page | null>;
  findActiveBySlug(websiteId: WebsiteId, slug: string): Promise<Page | null>;
  listForWebsite(websiteId: WebsiteId, options?: { readonly status?: PageStatus }): Promise<readonly Page[]>;
}
export interface PageCreationPersistence { createWithEvent(candidate: PageDraft, event: PageCreatedEvent): Promise<CreateResult<Page>>; }
export interface PageMutationPersistence {
  updateDetails(input: { readonly pageId: PageId; readonly title: string; readonly slug: string; readonly description?: string; readonly expectedVersion: AggregateVersion; readonly updatedAt: string; readonly updatedBy: string }): Promise<SaveResult<Page>>;
  archiveWithEvent(input: { readonly pageId: PageId; readonly expectedVersion: AggregateVersion; readonly archivedAt: string; readonly archivedBy: string }, event: PageArchivedEvent): Promise<SaveResult<Page>>;
  restoreWithEvent(input: { readonly pageId: PageId; readonly expectedVersion: AggregateVersion; readonly restoredAt: string; readonly restoredBy: string }, event: PageRestoredEvent): Promise<SaveResult<Page>>;
}
export interface PageRepository extends PageReader, PageCreationPersistence, PageMutationPersistence {}
