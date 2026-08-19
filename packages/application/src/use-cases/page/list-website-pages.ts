import type { OrganizationId, Page, PageStatus, Result, UserId, WebsiteId } from "@livingsites/domain";
import { PagePermissions } from "../../authorization/permissions.js";
import type { AuthorizationService } from "../../authorization/service.js";
import type { PageReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";
import { proveWebsiteAccess } from "./shared.js";

export async function listWebsitePages(input: { organizationId: OrganizationId; websiteId: WebsiteId; status?: PageStatus }, deps: { authenticatedUser: { userId: UserId }; authorizationService: AuthorizationService; websiteReader: WebsiteReader; pageReader: PageReader }): Promise<Result<readonly Page[], { code: "unauthorized" | "website_not_found"; message: string }>> {
  const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission: PagePermissions.Read }, deps);
  if (!access.ok) return access;
  return { ok: true, value: await deps.pageReader.listForWebsite(input.websiteId, input.status ? { status: input.status } : undefined) };
}
