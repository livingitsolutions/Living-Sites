import type { AggregateVersion, ISODateString, OrganizationId, Page, PageArchivedEvent, PageId, Result, UserId, WebsiteId } from "@livingsites/domain";
import type { Clock } from "@livingsites/platform";
import { PagePermissions } from "../../authorization/permissions.js";
import type { AuthorizationService } from "../../authorization/service.js";
import type { PageMutationPersistence, PageReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";
import { proveWebsiteAccess } from "./shared.js";

export async function archivePage(input: { organizationId: OrganizationId; websiteId: WebsiteId; pageId: PageId; expectedVersion: AggregateVersion }, deps: { authenticatedUser: { userId: UserId }; authorizationService: AuthorizationService; websiteReader: WebsiteReader; pageReader: PageReader; pageMutationPersistence: PageMutationPersistence; clock: Clock }): Promise<Result<Page, { code: "unauthorized" | "website_not_found" | "not_found" | "invalid_lifecycle" | "concurrency_conflict" | "persistence_error"; message: string }>> {
  const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission: PagePermissions.Archive }, deps); if (!access.ok) return access;
  const page = await deps.pageReader.findById(input.pageId); if (!page || page.websiteId !== input.websiteId) return { ok: false, error: { code: "not_found", message: "Page was not found in this Website." } };
  if (page.status === "archived") return { ok: false, error: { code: "invalid_lifecycle", message: "Page is already archived." } };
  const now = deps.clock.nowIso() as ISODateString; const event: PageArchivedEvent = { type: "page.archived", occurredAt: now, eventScope: { scope: "website", organizationId: input.organizationId, websiteId: input.websiteId }, pageId: input.pageId };
  const saved = await deps.pageMutationPersistence.archiveWithEvent({ pageId: input.pageId, expectedVersion: input.expectedVersion, archivedAt: now, archivedBy: String(deps.authenticatedUser.userId) }, event);
  if (!saved.ok) return { ok: false, error: { code: "expectedVersion" in saved.error ? "concurrency_conflict" : "persistence_error", message: "expectedVersion" in saved.error ? "Page changed since it was loaded." : saved.error.message } }; return saved;
}
