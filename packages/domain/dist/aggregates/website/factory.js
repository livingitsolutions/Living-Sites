import { WebsiteStatus } from "../../website";
import { WEBSITE_DRAFT_VERSION } from "./draft";
const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export function normalizeHostname(value) {
    const normalized = value.trim().toLowerCase().replace(/\.$/, "");
    if (normalized.includes("://") || normalized.includes("/") || normalized.includes(":")) {
        throw new Error("Hostname must not include a protocol, port, or path.");
    }
    if (!HOSTNAME_PATTERN.test(normalized)) {
        throw new Error("Hostname is not valid.");
    }
    return normalized;
}
export function createWebsiteDraft(input) {
    const defaultLocale = input.defaultLocale ?? "en-US";
    const enabledLocales = input.enabledLocales?.length ? input.enabledLocales : [defaultLocale];
    if (!enabledLocales.includes(defaultLocale)) {
        throw new Error("Default locale must be enabled.");
    }
    const settings = {
        passwordProtection: input.settings?.passwordProtection ?? null,
        searchEngineIndexing: input.settings?.searchEngineIndexing ?? true,
        socialDefaults: input.settings?.socialDefaults ?? {},
        headerScripts: input.settings?.headerScripts ?? [],
        footerScripts: input.settings?.footerScripts ?? [],
        ...(input.settings?.faviconMediaId ? { faviconMediaId: input.settings.faviconMediaId } : {}),
    };
    const fallbackLabel = String(input.id).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    return {
        id: input.id,
        organizationId: input.organizationId,
        name: input.name.trim(),
        slug: input.slug,
        customDomain: input.customDomain ? normalizeHostname(input.customDomain) : null,
        fallbackDomain: normalizeHostname(`${fallbackLabel}.livingsites.app`),
        status: WebsiteStatus.Draft,
        publishedVersion: null,
        themeId: input.themeId ?? null,
        defaultLocale,
        enabledLocales,
        settings,
        version: WEBSITE_DRAFT_VERSION,
        audit: {
            createdAt: input.now,
            updatedAt: input.now,
            createdBy: input.createdBy,
            updatedBy: input.createdBy,
        },
        archivedAt: null,
    };
}
//# sourceMappingURL=factory.js.map