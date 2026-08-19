import type {
  AggregateVersion,
  AuditTrail,
  LocaleCode,
  OrganizationId,
  Slug,
  ThemeId,
  VersionString,
  WebsiteId,
} from "../../shared";
import { INITIAL_AGGREGATE_VERSION } from "../../shared";
import type { WebsiteSettings, WebsiteStatus } from "../../website";

export type WebsiteDraftVersion = AggregateVersion & { readonly __websiteDraft: true };

export interface WebsiteDraft {
  readonly id: WebsiteId;
  readonly organizationId: OrganizationId;
  readonly slug: Slug;
  name: string;
  customDomain: string | null;
  fallbackDomain: string;
  status: WebsiteStatus;
  publishedVersion: VersionString | null;
  themeId: ThemeId | null;
  defaultLocale: LocaleCode;
  enabledLocales: readonly LocaleCode[];
  settings: WebsiteSettings;
  readonly version: WebsiteDraftVersion;
  readonly audit: AuditTrail;
  archivedAt: null;
}

export const WEBSITE_DRAFT_VERSION = INITIAL_AGGREGATE_VERSION as WebsiteDraftVersion;
