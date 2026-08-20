import type { AggregateVersion, ISODateString, OrganizationId, Page, PageId, Result, UserId, WebsiteHomepageChangedEvent, WebsiteId } from "@livingsites/domain";
import type { Clock } from "@livingsites/platform";
import { PagePermissions } from "../../authorization/permissions.js";
import type { AuthorizationService } from "../../authorization/service.js";
import type { PageHomepagePersistence, PageReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";
import { proveWebsiteAccess } from "./shared.js";

export type SetWebsiteHomepageError = {
  readonly code: "unauthorized" | "website_not_found" | "not_found" | "archived_target" | "already_homepage" | "concurrency_conflict" | "persistence_error";
  readonly message: string;
};

export async function setWebsiteHomepage(
  input: { readonly organizationId: OrganizationId; readonly websiteId: WebsiteId; readonly pageId: PageId; readonly expectedVersion: AggregateVersion },
  deps: { readonly authenticatedUser: { readonly userId: UserId }; readonly authorizationService: AuthorizationService; readonly websiteReader: WebsiteReader; readonly pageReader: PageReader; readonly pageHomepagePersistence: PageHomepagePersistence; readonly clock: Clock },
): Promise<Result<Page, SetWebsiteHomepageError>> {
  const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission: PagePermissions.Update }, deps);
  if (!access.ok) return access;

  const page = await deps.pageReader.findById(input.pageId);
  if (!page || page.websiteId !== input.websiteId) return { ok: false, error: { code: "not_found", message: "Page was not found in this Website." } };
  if (page.status === "archived" || page.archivedAt) return { ok: false, error: { code: "archived_target", message: "An archived Page cannot be the Website homepage." } };
  if (page.isHomepage) return { ok: false, error: { code: "already_homepage", message: "This Page is already the Website homepage." } };

  const occurredAt = deps.clock.nowIso() as ISODateString;
  const event: Omit<WebsiteHomepageChangedEvent, "previousHomepagePageId" | "pageVersion"> = {
    type: "website.homepage_changed",
    occurredAt,
    eventScope: { scope: "website", organizationId: input.organizationId, websiteId: input.websiteId },
    pageId: input.pageId,
  };
  return deps.pageHomepagePersistence.setWebsiteHomepage({ websiteId: input.websiteId, pageId: input.pageId, expectedPageVersion: input.expectedVersion, changedAt: occurredAt, changedBy: deps.authenticatedUser.userId, event });
}
