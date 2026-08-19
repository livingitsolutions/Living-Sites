import { WebsiteStatus } from "@livingsites/domain";
const invalid = (message) => ({ ok: false, error: { code: "invalid_persistence_state", message } });
function validSettings(value) {
    if (!value || typeof value !== "object")
        return false;
    const settings = value;
    return typeof settings.searchEngineIndexing === "boolean"
        && Array.isArray(settings.headerScripts)
        && Array.isArray(settings.footerScripts)
        && typeof settings.socialDefaults === "object";
}
export function rowToWebsite(row) {
    if (!row.id || !row.organization_id || !row.slug)
        return invalid("Website row is missing required identity fields.");
    if (row.version < 1)
        return invalid(`Website row has invalid version: ${row.version}.`);
    if (!Object.values(WebsiteStatus).includes(row.status))
        return invalid(`Website row has invalid status: ${row.status}.`);
    if (!Array.isArray(row.enabled_locales) || !row.enabled_locales.every((locale) => typeof locale === "string"))
        return invalid("Website enabled locales are invalid.");
    if (!row.enabled_locales.includes(row.default_locale))
        return invalid("Website default locale is not enabled.");
    if (!validSettings(row.settings))
        return invalid("Website settings are invalid.");
    return { ok: true, value: {
            id: row.id,
            organizationId: row.organization_id,
            name: row.name,
            slug: row.slug,
            customDomain: row.custom_domain,
            fallbackDomain: row.fallback_domain,
            status: row.status,
            publishedVersion: row.published_release_label,
            themeId: row.theme_id,
            defaultLocale: row.default_locale,
            enabledLocales: row.enabled_locales,
            settings: row.settings,
            version: row.version,
            audit: {
                createdAt: row.created_at.toISOString(),
                updatedAt: row.updated_at.toISOString(),
                ...(row.created_by ? { createdBy: row.created_by } : {}),
                ...(row.updated_by ? { updatedBy: row.updated_by } : {}),
            },
            archivedAt: row.archived_at ? row.archived_at.toISOString() : null,
        } };
}
export function websiteDraftToInsert(draft, version = 1) {
    return {
        id: String(draft.id),
        organization_id: String(draft.organizationId),
        name: draft.name,
        slug: String(draft.slug),
        custom_domain: draft.customDomain,
        fallback_domain: draft.fallbackDomain,
        status: draft.status,
        theme_id: draft.themeId ? String(draft.themeId) : null,
        published_release_label: draft.publishedVersion ? String(draft.publishedVersion) : null,
        default_locale: String(draft.defaultLocale),
        enabled_locales: [...draft.enabledLocales],
        settings: draft.settings,
        version,
        created_at: new Date(draft.audit.createdAt),
        updated_at: new Date(draft.audit.updatedAt),
        created_by: draft.audit.createdBy ? String(draft.audit.createdBy) : null,
        updated_by: draft.audit.updatedBy ? String(draft.audit.updatedBy) : null,
        archived_at: null,
    };
}
//# sourceMappingURL=website-mapper.js.map