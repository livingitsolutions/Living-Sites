import type { OrganizationId, PageId, PageSnapshot, Result, UserId, VersionString, WebsiteId } from "@livingsites/domain";
import { PagePermissions } from "../../authorization/permissions.js";
import type { AuthorizationService } from "../../authorization/service.js";
import type { PageReader, PageSnapshotReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";

export interface PagePublicationHistoryItem {
  readonly snapshotId: string;
  readonly revisionNumber: number;
  readonly releaseVersion?: VersionString;
  readonly publishedAt: string;
  readonly publishedBy: string;
  readonly isCurrent: boolean;
}

export interface PublishedPageRevision {
  readonly snapshotId: string;
  readonly revisionNumber: number;
  readonly releaseVersion?: VersionString;
  readonly publishedAt: string;
  readonly publishedBy: string;
  readonly isCurrent: boolean;
  readonly page: PageSnapshot["page"];
  readonly sections: PageSnapshot["sections"];
  readonly seo?: PageSnapshot["seo"];
}

export type PagePublicationQueryError = { readonly code: "unauthorized" | "website_not_found" | "page_not_found" | "snapshot_not_found"; readonly message: string };

interface QueryInput { readonly organizationId: OrganizationId; readonly websiteId: WebsiteId; readonly pageId: PageId }
interface QueryDeps {
  readonly authenticatedUser: { readonly userId: UserId };
  readonly authorizationService: AuthorizationService;
  readonly websiteReader: WebsiteReader;
  readonly pageReader: PageReader;
  readonly pageSnapshotReader: PageSnapshotReader;
}

async function loadAuthorizedPage(input: QueryInput, deps: QueryDeps): Promise<Result<Awaited<ReturnType<PageReader["findById"]>> & {}, PagePublicationQueryError>> {
  const decision = await deps.authorizationService.can({ userId: deps.authenticatedUser.userId, organizationId: input.organizationId, websiteId: input.websiteId, permission: PagePermissions.Read });
  if (!decision.allowed) return { ok: false, error: { code: "unauthorized", message: decision.reason } };
  const website = await deps.websiteReader.findById(input.websiteId);
  if (!website || website.organizationId !== input.organizationId) return { ok: false, error: { code: "website_not_found", message: "Website was not found in this Organization." } };
  const page = await deps.pageReader.findById(input.pageId);
  if (!page || page.websiteId !== input.websiteId) return { ok: false, error: { code: "page_not_found", message: "Page was not found in this Website." } };
  return { ok: true, value: page };
}

export async function listPagePublicationHistory(input: QueryInput, deps: QueryDeps): Promise<Result<readonly PagePublicationHistoryItem[], PagePublicationQueryError>> {
  const pageResult = await loadAuthorizedPage(input, deps);
  if (!pageResult.ok) return pageResult;
  const snapshots = await deps.pageSnapshotReader.listForPage(input.pageId);
  return { ok: true, value: snapshots.map((snapshot) => ({ snapshotId: snapshot.id, revisionNumber: snapshot.revisionNumber, releaseVersion: snapshot.releaseVersion, publishedAt: snapshot.publishedAt, publishedBy: snapshot.publishedBy, isCurrent: snapshot.id === pageResult.value.publishedSnapshotId })) };
}

export async function inspectPagePublication(input: QueryInput & { readonly snapshotId: string }, deps: QueryDeps): Promise<Result<PublishedPageRevision, PagePublicationQueryError>> {
  const pageResult = await loadAuthorizedPage(input, deps);
  if (!pageResult.ok) return pageResult;
  const snapshot = await deps.pageSnapshotReader.findById(input.snapshotId);
  if (!snapshot || snapshot.organizationId !== input.organizationId || snapshot.websiteId !== input.websiteId || snapshot.pageId !== input.pageId) return { ok: false, error: { code: "snapshot_not_found", message: "Published revision was not found for this Page." } };
  return { ok: true, value: { snapshotId: snapshot.id, revisionNumber: snapshot.revisionNumber, releaseVersion: snapshot.releaseVersion, publishedAt: snapshot.publishedAt, publishedBy: snapshot.publishedBy, isCurrent: snapshot.id === pageResult.value.publishedSnapshotId, page: snapshot.page, sections: snapshot.sections, seo: snapshot.seo } };
}
