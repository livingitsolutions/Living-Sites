import { WebsitePermissions } from "../../../authorization/permissions.js";
export async function listOrganizationWebsites(input, deps) {
    const decision = await deps.authorizationService.can({ userId: deps.authenticatedUser.userId, organizationId: input.organizationId, permission: WebsitePermissions.Read });
    if (!decision.allowed)
        return { ok: false, error: { code: "unauthorized", message: decision.reason } };
    return { ok: true, value: await deps.websiteReader.listForOrganization(input.organizationId) };
}
//# sourceMappingURL=index.js.map