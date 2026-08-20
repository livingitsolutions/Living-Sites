import type { AggregateVersion, ISODateString, OrganizationId, Result, UserId, VersionString, Website, WebsiteId } from "@livingsites/domain";
import { PageStatus, WebsiteStatus } from "@livingsites/domain";
import type { Clock } from "@livingsites/platform";
import { WebsitePermissions } from "../../../authorization/permissions.js";
import type { AuthorizationService } from "../../../authorization/service.js";
import type { PageReader } from "../../../repositories/page.js";
import type { WebsitePublicationPersistence, WebsiteReader } from "../../../repositories/website.js";

export type PublishWebsiteError = {
  readonly code: "unauthorized" | "website_not_found" | "website_archived" | "not_ready" | "concurrency_conflict" | "persistence_error";
  readonly message: string;
};

export interface PublishWebsiteDeps {
  readonly authenticatedUser: { readonly userId: UserId };
  readonly authorizationService: AuthorizationService;
  readonly websiteReader: WebsiteReader;
  readonly pageReader: PageReader;
  readonly websitePublicationPersistence: WebsitePublicationPersistence;
  readonly clock: Clock;
}

export async function publishWebsite(
  input: { readonly organizationId: OrganizationId; readonly websiteId: WebsiteId; readonly expectedVersion: AggregateVersion },
  deps: PublishWebsiteDeps,
): Promise<Result<Website, PublishWebsiteError>> {
  const authorization = await deps.authorizationService.can({
    userId: deps.authenticatedUser.userId,
    organizationId: input.organizationId,
    websiteId: input.websiteId,
    permission: WebsitePermissions.Publish,
  });
  if (!authorization.allowed) return { ok: false, error: { code: "unauthorized", message: authorization.reason } };

  const website = await deps.websiteReader.findById(input.websiteId);
  if (!website || website.organizationId !== input.organizationId) return { ok: false, error: { code: "website_not_found", message: "Website was not found in this Organization." } };
  if (website.status === WebsiteStatus.Archived) return { ok: false, error: { code: "website_archived", message: "Archived Websites cannot be published." } };
  if (website.version !== input.expectedVersion) return { ok: false, error: { code: "concurrency_conflict", message: "This Website changed in another session. Reload before publishing." } };

  const pages = await deps.pageReader.listForWebsite(input.websiteId);
  if (!pages.some((page) => page.status === PageStatus.Published && page.publishedSnapshotId !== null && !page.archivedAt)) {
    return { ok: false, error: { code: "not_ready", message: "Publish at least one Page before publishing the Website." } };
  }

  const changedAt = deps.clock.nowIso() as ISODateString;
  const publishedVersion = `1.0.${website.version}` as VersionString;
  const result = await deps.websitePublicationPersistence.publishWithEvent({
    websiteId: website.id,
    expectedVersion: input.expectedVersion,
    publishedVersion,
    changedAt,
    changedBy: deps.authenticatedUser.userId,
    event: {
      type: "website.published",
      occurredAt: changedAt,
      eventScope: { scope: "website", organizationId: website.organizationId, websiteId: website.id },
      publishedVersion,
    },
  });
  return result.ok ? result : { ok: false, error: result.error };
}
