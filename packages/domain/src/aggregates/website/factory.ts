import type {
  ISODateString,
  LocaleCode,
  OrganizationId,
  Slug,
  ThemeId,
  UserId,
  WebsiteId,
} from "../../shared/index.js";
import { WebsiteStatus, type WebsiteSettings } from "../../website/index.js";
import type { WebsiteDraft } from "./draft.js";
import { WEBSITE_DRAFT_VERSION } from "./draft.js";

const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeHostname(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\.$/, "");
  if (normalized.includes("://") || normalized.includes("/") || normalized.includes(":")) {
    throw new Error("Hostname must not include a protocol, port, or path.");
  }
  if (!HOSTNAME_PATTERN.test(normalized)) {
    throw new Error("Hostname is not valid.");
  }
  return normalized;
}

export interface CreateWebsiteDraftInput {
  readonly id: WebsiteId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly slug: Slug;
  readonly now: ISODateString;
  readonly createdBy: UserId;
  readonly themeId?: ThemeId | null;
  readonly customDomain?: string | null;
  readonly defaultLocale?: LocaleCode;
  readonly enabledLocales?: readonly LocaleCode[];
  readonly settings?: Partial<WebsiteSettings>;
}

export function createWebsiteDraft(input: CreateWebsiteDraftInput): WebsiteDraft {
  const defaultLocale = input.defaultLocale ?? ("en-US" as LocaleCode);
  const enabledLocales = input.enabledLocales?.length ? input.enabledLocales : [defaultLocale];
  if (!enabledLocales.includes(defaultLocale)) {
    throw new Error("Default locale must be enabled.");
  }

  const settings: WebsiteSettings = {
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
