/**
 * Website bounded context — a single publishable site owned by an Organization.
 *
 * Invariant: a Website always belongs to exactly one Organization.
 * A Website owns Pages, Media, Forms, and its own Settings.
 *
 * Navigation and Theme were split into their own bounded contexts
 * (./navigation, ./theme) but remain re-exported here for compatibility.
 */
import type {
  WebsiteId,
  OrganizationId,
  ThemeId,
  Slug,
  LocaleCode,
  AuditTrail,
  VersionString,
  AggregateVersion,
} from "../shared";

/** A website within an organization. */
export interface Website {
  readonly id: WebsiteId;
  readonly organizationId: OrganizationId;
  readonly slug: Slug;
  /** Display name, e.g. "Tajon Construction — Marketing Site". */
  name: string;
  /** Primary public hostname, e.g. "tajonconstruction.com". */
  customDomain: string | null;
  /** Platform-provided fallback hostname, e.g. "tajon.livingsites.app". */
  fallbackDomain: string;
  status: WebsiteStatus;
  /** Current published version; null until first publish. */
  publishedVersion: VersionString | null;
  /** Active theme reference. */
  themeId: ThemeId | null;
  /** Default locale for content authoring and rendering. */
  defaultLocale: LocaleCode;
  /** All locales enabled on this website. */
  enabledLocales: readonly LocaleCode[];
  /** Settings are a child of the Website aggregate and share its lifecycle/version. */
  settings: WebsiteSettings;
  /** Optimistic concurrency version. Monotonically incremented on each save. */
  version: AggregateVersion;
  readonly audit: AuditTrail;
  /** Soft-delete timestamp; populated only for archived websites. */
  archivedAt: import("../shared").ISODateString | null;
}

/** Website-scoped configuration that is not content. */
export interface WebsiteSettings {
  /** Whether the site is protected by a shared password. */
  passwordProtection: { enabled: boolean; passwordHash?: string } | null;
  /** Whether indexing by search engines is allowed. */
  searchEngineIndexing: boolean;
  /** Open Graph / social share defaults. */
  socialDefaults: {
    defaultShareTitle?: string;
    defaultShareDescription?: string;
    defaultShareMediaId?: string;
  };
  /** Header/footer script injections (verified admin-only). */
  headerScripts: readonly string[];
  footerScripts: readonly string[];
  /** Favicon media reference. */
  faviconMediaId?: string;
}

export enum WebsiteStatus {
  Draft = "draft",
  Published = "published",
  Unpublished = "unpublished",
  Archived = "archived",
}
