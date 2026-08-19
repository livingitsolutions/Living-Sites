import type { OrganizationId, Result, UserId, Website } from "@livingsites/domain";
import type { AuthorizationService } from "../../../authorization/service.js";
import { WebsitePermissions } from "../../../authorization/permissions.js";
import type { WebsiteReader } from "../../../repositories/website.js";

export async function listOrganizationWebsites(
  input: { readonly organizationId: OrganizationId },
  deps: { readonly authenticatedUser: { readonly userId: UserId }; readonly authorizationService: AuthorizationService; readonly websiteReader: WebsiteReader },
): Promise<Result<readonly Website[], { readonly code: "unauthorized"; readonly message: string }>> {
  const decision = await deps.authorizationService.can({ userId: deps.authenticatedUser.userId, organizationId: input.organizationId, permission: WebsitePermissions.Read });
  if (!decision.allowed) return { ok: false, error: { code: "unauthorized", message: decision.reason } };
  return { ok: true, value: await deps.websiteReader.listForOrganization(input.organizationId) };
}
