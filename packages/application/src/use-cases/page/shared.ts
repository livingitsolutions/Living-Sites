import type { OrganizationId, Result, UserId, Website, WebsiteId } from "@livingsites/domain";
import type { PermissionKey } from "../../authorization/permissions";
import type { AuthorizationService } from "../../authorization/service";
import type { WebsiteReader } from "../../repositories/website";

export type PageAccessError = { readonly code: "unauthorized" | "website_not_found"; readonly message: string };
export async function proveWebsiteAccess(input: { organizationId: OrganizationId; websiteId: WebsiteId; userId: UserId; permission: PermissionKey }, deps: { authorizationService: AuthorizationService; websiteReader: WebsiteReader }): Promise<Result<Website, PageAccessError>> {
  const decision = await deps.authorizationService.can({ userId: input.userId, organizationId: input.organizationId, websiteId: input.websiteId, permission: input.permission });
  if (!decision.allowed) return { ok: false, error: { code: "unauthorized", message: decision.reason } };
  const website = await deps.websiteReader.findById(input.websiteId);
  if (!website || website.organizationId !== input.organizationId) return { ok: false, error: { code: "website_not_found", message: "Website was not found in this Organization." } };
  return { ok: true, value: website };
}
