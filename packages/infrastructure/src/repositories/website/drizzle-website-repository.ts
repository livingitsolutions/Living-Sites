import { and, eq, or } from "drizzle-orm";
import type { OrganizationId, Website, WebsiteDraft, WebsiteId, WebsiteSettings } from "@livingsites/domain";
import { normalizeHostname, WebsiteStatus } from "@livingsites/domain";
import type { CreateResult, SaveResult, WebsiteRepository } from "@livingsites/application";
import type { Logger } from "@livingsites/platform";
import type { DrizzleDB } from "../../db/drizzle-instance";
import { websites, type WebsiteRow } from "../../db/schema";
import { rowToWebsite, websiteDraftToInsert } from "../../db/website-mapper";

function duplicate(error: unknown): boolean {
  return !!error && typeof error === "object" && ((error as { code?: string }).code === "23505" || /duplicate|unique/i.test(String((error as { message?: string }).message)));
}

export class DrizzleWebsiteRepository implements WebsiteRepository {
  constructor(private readonly config: { readonly db: DrizzleDB; readonly logger: Logger }) {}

  async findById(id: WebsiteId): Promise<Website | null> {
    const [row] = await this.config.db.select().from(websites).where(eq(websites.id, String(id))).limit(1);
    if (!row) return null;
    const mapped = rowToWebsite(row);
    if (!mapped.ok) this.config.logger.error(mapped.error.message, { websiteId: String(id) });
    return mapped.ok ? mapped.value : null;
  }

  async findByOrganizationAndSlug(organizationId: OrganizationId, slug: string): Promise<Website | null> {
    const [row] = await this.config.db.select().from(websites).where(and(eq(websites.organization_id, String(organizationId)), eq(websites.slug, slug.toLowerCase()))).limit(1);
    if (!row) return null;
    const mapped = rowToWebsite(row);
    return mapped.ok ? mapped.value : null;
  }

  async listForOrganization(organizationId: OrganizationId): Promise<readonly Website[]> {
    const rows = await this.config.db.select().from(websites).where(eq(websites.organization_id, String(organizationId))).orderBy(websites.created_at);
    return rows.flatMap((row: WebsiteRow) => { const mapped = rowToWebsite(row); return mapped.ok ? [mapped.value] : []; });
  }

  async findByDomain(domain: string): Promise<Website | null> {
    let hostname: string;
    try { hostname = normalizeHostname(domain); } catch { return null; }
    const [row] = await this.config.db.select().from(websites).where(or(eq(websites.custom_domain, hostname), eq(websites.fallback_domain, hostname))).limit(1);
    if (!row) return null;
    const mapped = rowToWebsite(row);
    return mapped.ok ? mapped.value : null;
  }

  async create(candidate: WebsiteDraft): Promise<CreateResult<Website>> {
    try {
      const [row] = await this.config.db.insert(websites).values(websiteDraftToInsert(candidate)).returning();
      if (!row) return { ok: false, error: { code: "invalid_persistence_state", message: "Website insert returned no row." } };
      return rowToWebsite(row);
    } catch (error) {
      if (duplicate(error)) return { ok: false, error: { code: "duplicate_key", message: "Website slug or domain already exists.", field: "slug", value: String(candidate.slug) } };
      this.config.logger.error("Website create failed", { error: String(error) });
      return { ok: false, error: { code: "persistence_unavailable", message: "Website could not be persisted." } };
    }
  }

  async updateSettings(id: WebsiteId, settings: WebsiteSettings, expectedVersion: number): Promise<SaveResult<Website>> {
    return this.update(id, expectedVersion, { settings, updated_at: new Date() });
  }

  async archive(id: WebsiteId, expectedVersion: number): Promise<SaveResult<Website>> {
    return this.update(id, expectedVersion, { status: WebsiteStatus.Archived, archived_at: new Date(), updated_at: new Date() });
  }

  async restore(id: WebsiteId, expectedVersion: number): Promise<SaveResult<Website>> {
    return this.update(id, expectedVersion, { status: WebsiteStatus.Unpublished, archived_at: null, updated_at: new Date() });
  }

  private async update(id: WebsiteId, expectedVersion: number, changes: Partial<typeof websites.$inferInsert>): Promise<SaveResult<Website>> {
    try {
      const [row] = await this.config.db.update(websites).set({ ...changes, version: expectedVersion + 1 }).where(and(eq(websites.id, String(id)), eq(websites.version, expectedVersion))).returning();
      if (!row) return { ok: false, error: { aggregateId: String(id), expectedVersion, actualVersion: expectedVersion } };
      return rowToWebsite(row);
    } catch (error) {
      return { ok: false, error: { code: "invalid_persistence_state", message: String(error) } };
    }
  }
}
