import type { AggregateVersion, ISODateString, OrganizationId, Page, PageId, PageRestoredEvent, Result, UserId, WebsiteId } from "@livingsites/domain";
import type { Clock } from "@livingsites/platform";
import { PagePermissions } from "../../authorization/permissions.js";
import type { AuthorizationService } from "../../authorization/service.js";
import type { PageMutationPersistence, PageReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";
import { proveWebsiteAccess } from "./shared.js";

export async function restorePage(input: { organizationId: OrganizationId; websiteId: WebsiteId; pageId: PageId; expectedVersion: AggregateVersion }, deps: { authenticatedUser: { userId: UserId }; authorizationService: AuthorizationService; websiteReader: WebsiteReader; pageReader: PageReader; pageMutationPersistence: PageMutationPersistence; clock: Clock }): Promise<Result<Page, { code: "unauthorized" | "website_not_found" | "not_found" | "invalid_lifecycle" | "duplicate_slug" | "concurrency_conflict" | "persistence_error"; message: string }>> {
  const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission: PagePermissions.Archive }, deps); if (!access.ok) return access;
  const page = await deps.pageReader.findById(input.pageId); if (!page || page.websiteId !== input.websiteId) return { ok: false, error: { code: "not_found", message: "Page was not found in this Website." } };
  if (page.status !== "archived") return { ok: false, error: { code: "invalid_lifecycle", message: "Only archived Pages can be restored." } };
  if (await deps.pageReader.findActiveBySlug(input.websiteId, page.slug)) return { ok: false, error: { code: "duplicate_slug", message: "Another active Page now uses this slug." } };
  const now = deps.clock.nowIso() as ISODateString; const event: PageRestoredEvent = { type: "page.restored", occurredAt: now, eventScope: { scope: "website", organizationId: input.organizationId, websiteId: input.websiteId }, pageId: input.pageId };
  const saved = await deps.pageMutationPersistence.restoreWithEvent({ pageId: input.pageId, expectedVersion: input.expectedVersion, restoredAt: now, restoredBy: String(deps.authenticatedUser.userId) }, event);
  if (!saved.ok) return { ok: false, error: { code: "expectedVersion" in saved.error ? "concurrency_conflict" : "persistence_error", message: "expectedVersion" in saved.error ? "Page changed since it was loaded." : saved.error.message } }; return saved;
}
