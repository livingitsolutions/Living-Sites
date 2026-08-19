import type {
  AggregateVersion,
  ISODateString,
  LocaleCode,
  OrganizationId,
  Slug,
  ThemeId,
  UserId,
  VersionString,
  Website,
  WebsiteDraft,
  WebsiteId,
  WebsiteSettings,
} from "@livingsites/domain";
import { WebsiteStatus } from "@livingsites/domain";
import type { InvalidPersistenceStateError } from "@livingsites/application";
import type { WebsiteRow } from "./schema";

type MapperResult = { ok: true; value: Website } | { ok: false; error: InvalidPersistenceStateError };
const invalid = (message: string): MapperResult => ({ ok: false, error: { code: "invalid_persistence_state", message } });

function validSettings(value: unknown): value is WebsiteSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Record<string, unknown>;
  return typeof settings.searchEngineIndexing === "boolean"
    && Array.isArray(settings.headerScripts)
    && Array.isArray(settings.footerScripts)
    && typeof settings.socialDefaults === "object";
}

export function rowToWebsite(row: WebsiteRow): MapperResult {
  if (!row.id || !row.organization_id || !row.slug) return invalid("Website row is missing required identity fields.");
  if (row.version < 1) return invalid(`Website row has invalid version: ${row.version}.`);
  if (!Object.values(WebsiteStatus).includes(row.status as WebsiteStatus)) return invalid(`Website row has invalid status: ${row.status}.`);
  if (!Array.isArray(row.enabled_locales) || !row.enabled_locales.every((locale) => typeof locale === "string")) return invalid("Website enabled locales are invalid.");
  if (!row.enabled_locales.includes(row.default_locale)) return invalid("Website default locale is not enabled.");
  if (!validSettings(row.settings)) return invalid("Website settings are invalid.");

  return { ok: true, value: {
    id: row.id as WebsiteId,
    organizationId: row.organization_id as OrganizationId,
    name: row.name,
    slug: row.slug as Slug,
    customDomain: row.custom_domain,
    fallbackDomain: row.fallback_domain,
    status: row.status as WebsiteStatus,
    publishedVersion: row.published_release_label as VersionString | null,
    themeId: row.theme_id as ThemeId | null,
    defaultLocale: row.default_locale as LocaleCode,
    enabledLocales: row.enabled_locales as LocaleCode[],
    settings: row.settings,
    version: row.version as AggregateVersion,
    audit: {
      createdAt: row.created_at.toISOString() as ISODateString,
      updatedAt: row.updated_at.toISOString() as ISODateString,
      ...(row.created_by ? { createdBy: row.created_by as UserId } : {}),
      ...(row.updated_by ? { updatedBy: row.updated_by as UserId } : {}),
    },
    archivedAt: row.archived_at ? row.archived_at.toISOString() as ISODateString : null,
  } };
}

export function websiteDraftToInsert(draft: WebsiteDraft, version = 1) {
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
