import { createWebsiteDraft } from "@livingsites/domain";
import { WebsitePermissions } from "../../../authorization/permissions.js";
import { OrganizationActivePolicy, WebsiteCountPolicy, WebsiteSlugPolicy } from "../../../policies/website/index.js";
import { validateCreateWebsiteInput } from "./validator.js";
export async function createWebsite(input, deps) {
    const validation = validateCreateWebsiteInput(input);
    if (!validation.ok)
        return validation;
    const organizationId = validation.value.organizationId;
    const authorization = await deps.authorizationService.can({ userId: deps.authenticatedUser.userId, organizationId, permission: WebsitePermissions.Create });
    if (!authorization.allowed)
        return { ok: false, error: { code: "unauthorized", message: authorization.reason } };
    const organization = await deps.organizationReader.findById(organizationId);
    if (!organization)
        return { ok: false, error: { code: "organization_not_found", message: "Organization was not found." } };
    const activeDecision = new OrganizationActivePolicy().evaluate(organization.status);
    if (activeDecision.outcome === "deny")
        return { ok: false, error: { code: "organization_inactive", message: activeDecision.message } };
    const websites = await deps.websiteReader.listForOrganization(organizationId);
    let maxWebsites = null;
    if (organization.planId) {
        const plan = await deps.planReader.findById(organization.planId);
        if (!plan || !plan.isActive)
            return { ok: false, error: { code: "plan_not_available", message: "The organization plan is not active." } };
        maxWebsites = plan.maxWebsites;
    }
    const countDecision = new WebsiteCountPolicy().evaluate(websites.length, maxWebsites);
    if (countDecision.outcome === "deny")
        return { ok: false, error: { code: "website_limit_exceeded", message: countDecision.message, limit: maxWebsites ?? websites.length } };
    const existing = await deps.websiteReader.findByOrganizationAndSlug(organizationId, validation.value.slug);
    const slugDecision = new WebsiteSlugPolicy().evaluate(validation.value.slug, existing !== null);
    if (slugDecision.outcome === "deny") {
        return { ok: false, error: slugDecision.code === "website.slug.reserved"
                ? { code: "reserved_slug", message: slugDecision.message, slug: validation.value.slug }
                : { code: "duplicate_slug", message: slugDecision.message, slug: validation.value.slug } };
    }
    const websiteId = deps.idGenerator.generatePrefixed("web");
    const now = deps.clock.nowIso();
    let draft;
    try {
        draft = createWebsiteDraft({
            id: websiteId,
            organizationId,
            name: validation.value.name,
            slug: validation.value.slug,
            now,
            createdBy: deps.authenticatedUser.userId,
            themeId: validation.value.themeId,
            customDomain: null,
            fallbackDomain: deps.fallbackDomainProvider.hostnameFor(websiteId),
            defaultLocale: validation.value.defaultLocale,
            enabledLocales: validation.value.enabledLocales,
            settings: validation.value.settings,
        });
    }
    catch (error) {
        return { ok: false, error: { code: "input_validation", message: error instanceof Error ? error.message : "Invalid website settings.", field: "settings" } };
    }
    const event = { type: "website.created", occurredAt: now, eventScope: { scope: "organization", organizationId }, websiteId, slug: String(draft.slug) };
    const persisted = await deps.websiteCreationPersistence.createWithEvent(draft, event);
    if (!persisted.ok) {
        if (persisted.error.code === "duplicate_key")
            return { ok: false, error: { code: "duplicate_slug", message: persisted.error.message, slug: validation.value.slug } };
        return { ok: false, error: persisted.error };
    }
    if (persisted.value.version !== 1)
        return { ok: false, error: { code: "invalid_persistence_state", message: "Persisted Website must start at version 1." } };
    return { ok: true, value: { website: persisted.value } };
}
//# sourceMappingURL=use-case.js.map