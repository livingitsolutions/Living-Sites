import { WebsitePermissions } from "../../../authorization/permissions.js";
export async function getWebsite(input, deps) {
    const decision = await deps.authorizationService.can({ userId: deps.authenticatedUser.userId, organizationId: input.organizationId, websiteId: input.websiteId, permission: WebsitePermissions.Read });
    if (!decision.allowed)
        return { ok: false, error: { code: "unauthorized", message: decision.reason } };
    const website = await deps.websiteReader.findById(input.websiteId);
    if (!website || website.organizationId !== input.organizationId)
        return { ok: false, error: { code: "not_found", message: "Website was not found." } };
    return { ok: true, value: website };
}
//# sourceMappingURL=index.js.map