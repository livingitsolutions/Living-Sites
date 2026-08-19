import type { OrganizationId, Result, UserId, Website, WebsiteId } from "@livingsites/domain";
import type { AuthorizationService } from "../../../authorization/service.js";
import { WebsitePermissions } from "../../../authorization/permissions.js";
import type { WebsiteReader } from "../../../repositories/website.js";

export type GetWebsiteError = { readonly code: "unauthorized" | "not_found"; readonly message: string };
export async function getWebsite(
  input: { readonly organizationId: OrganizationId; readonly websiteId: WebsiteId },
  deps: { readonly authenticatedUser: { readonly userId: UserId }; readonly authorizationService: AuthorizationService; readonly websiteReader: WebsiteReader },
): Promise<Result<Website, GetWebsiteError>> {
  const decision = await deps.authorizationService.can({ userId: deps.authenticatedUser.userId, organizationId: input.organizationId, websiteId: input.websiteId, permission: WebsitePermissions.Read });
  if (!decision.allowed) return { ok: false, error: { code: "unauthorized", message: decision.reason } };
  const website = await deps.websiteReader.findById(input.websiteId);
  if (!website || website.organizationId !== input.organizationId) return { ok: false, error: { code: "not_found", message: "Website was not found." } };
  return { ok: true, value: website };
}
