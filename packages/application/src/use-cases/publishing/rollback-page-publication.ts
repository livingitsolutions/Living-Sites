import type { AggregateVersion, ISODateString, OrganizationId, PageId, PageSnapshot, Result, UserId, WebsiteId } from "@livingsites/domain";
import { WebsiteStatus } from "@livingsites/domain";
import type { Clock, IdGenerator } from "@livingsites/platform";
import { PagePermissions } from "../../authorization/permissions.js";
import type { AuthorizationService } from "../../authorization/service.js";
import type { PageReader, PageRollbackPersistence, PageSnapshotReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";

export type RollbackPagePublicationError = { readonly code: "unauthorized" | "website_not_found" | "page_not_found" | "website_inactive" | "snapshot_not_found" | "concurrency_conflict" | "persistence_error"; readonly message: string };

export interface RollbackPagePublicationDeps {
  readonly authenticatedUser: { readonly userId: UserId };
  readonly authorizationService: AuthorizationService;
  readonly websiteReader: WebsiteReader;
  readonly pageReader: PageReader;
  readonly pageSnapshotReader: PageSnapshotReader;
  readonly pageRollbackPersistence: PageRollbackPersistence;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
}

export async function rollbackPagePublication(input: { readonly organizationId: OrganizationId; readonly websiteId: WebsiteId; readonly pageId: PageId; readonly targetRevisionNumber: number; readonly expectedVersion: AggregateVersion }, deps: RollbackPagePublicationDeps): Promise<Result<PageSnapshot, RollbackPagePublicationError>> {
  const decision = await deps.authorizationService.can({ userId: deps.authenticatedUser.userId, organizationId: input.organizationId, websiteId: input.websiteId, permission: PagePermissions.Publish });
  if (!decision.allowed) return { ok: false, error: { code: "unauthorized", message: decision.reason } };
  const website = await deps.websiteReader.findById(input.websiteId);
  if (!website || website.organizationId !== input.organizationId) return { ok: false, error: { code: "website_not_found", message: "Website was not found in this Organization." } };
  if (website.status === WebsiteStatus.Archived) return { ok: false, error: { code: "website_inactive", message: "Archived Websites cannot rollback Page publications." } };
  const page = await deps.pageReader.findById(input.pageId);
  if (!page || page.websiteId !== input.websiteId) return { ok: false, error: { code: "page_not_found", message: "Page was not found in this Website." } };
  if (page.version !== input.expectedVersion) return { ok: false, error: { code: "concurrency_conflict", message: "This Page changed in another session. Reload before rolling back." } };
  const target = await deps.pageSnapshotReader.findByRevision(input.pageId, input.targetRevisionNumber);
  if (!target || target.organizationId !== input.organizationId || target.websiteId !== input.websiteId) return { ok: false, error: { code: "snapshot_not_found", message: "Published revision was not found for this Page." } };
  const rolledBackAt = deps.clock.nowIso() as ISODateString;
  const newSnapshotId = deps.idGenerator.generatePrefixed("snapshot");
  const result = await deps.pageRollbackPersistence.rollback({
    pageId: input.pageId, websiteId: input.websiteId, organizationId: input.organizationId, targetRevisionNumber: input.targetRevisionNumber,
    newSnapshotId, expectedPageVersion: input.expectedVersion, rolledBackAt, rolledBackBy: deps.authenticatedUser.userId,
    event: { type: "page.publication_rolled_back", occurredAt: rolledBackAt, eventScope: { scope: "website", organizationId: input.organizationId, websiteId: input.websiteId }, pageId: input.pageId, targetRevisionNumber: input.targetRevisionNumber, newSnapshotId },
  });
  if (!result.ok) return { ok: false, error: result.error };
  return result;
}
