import type { OrganizationId, Page, PageId, Result, UserId, WebsiteId } from "@livingsites/domain";
import { PagePermissions } from "../../authorization/permissions";
import type { AuthorizationService } from "../../authorization/service";
import type { PageReader } from "../../repositories/page";
import type { WebsiteReader } from "../../repositories/website";
import { proveWebsiteAccess } from "./shared";

export async function getPage(input: { organizationId: OrganizationId; websiteId: WebsiteId; pageId: PageId }, deps: { authenticatedUser: { userId: UserId }; authorizationService: AuthorizationService; websiteReader: WebsiteReader; pageReader: PageReader }): Promise<Result<Page, { code: "unauthorized" | "website_not_found" | "not_found"; message: string }>> {
  const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission: PagePermissions.Read }, deps);
  if (!access.ok) return access;
  const page = await deps.pageReader.findById(input.pageId);
  return page && page.websiteId === input.websiteId ? { ok: true, value: page } : { ok: false, error: { code: "not_found", message: "Page was not found in this Website." } };
}
