export async function proveWebsiteAccess(input, deps) {
    const decision = await deps.authorizationService.can({ userId: input.userId, organizationId: input.organizationId, websiteId: input.websiteId, permission: input.permission });
    if (!decision.allowed)
        return { ok: false, error: { code: "unauthorized", message: decision.reason } };
    const website = await deps.websiteReader.findById(input.websiteId);
    if (!website || website.organizationId !== input.organizationId)
        return { ok: false, error: { code: "website_not_found", message: "Website was not found in this Organization." } };
    return { ok: true, value: website };
}
//# sourceMappingURL=shared.js.map