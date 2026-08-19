import { and, eq, or } from "drizzle-orm";
import { normalizeHostname, WebsiteStatus } from "@livingsites/domain";
import { websites } from "../../db/schema";
import { rowToWebsite, websiteDraftToInsert } from "../../db/website-mapper";
function duplicate(error) {
    return !!error && typeof error === "object" && (error.code === "23505" || /duplicate|unique/i.test(String(error.message)));
}
export class DrizzleWebsiteRepository {
    config;
    constructor(config) {
        this.config = config;
    }
    async findById(id) {
        const [row] = await this.config.db.select().from(websites).where(eq(websites.id, String(id))).limit(1);
        if (!row)
            return null;
        const mapped = rowToWebsite(row);
        if (!mapped.ok)
            this.config.logger.error(mapped.error.message, { websiteId: String(id) });
        return mapped.ok ? mapped.value : null;
    }
    async findByOrganizationAndSlug(organizationId, slug) {
        const [row] = await this.config.db.select().from(websites).where(and(eq(websites.organization_id, String(organizationId)), eq(websites.slug, slug.toLowerCase()))).limit(1);
        if (!row)
            return null;
        const mapped = rowToWebsite(row);
        return mapped.ok ? mapped.value : null;
    }
    async listForOrganization(organizationId) {
        const rows = await this.config.db.select().from(websites).where(eq(websites.organization_id, String(organizationId))).orderBy(websites.created_at);
        return rows.flatMap((row) => { const mapped = rowToWebsite(row); return mapped.ok ? [mapped.value] : []; });
    }
    async findByDomain(domain) {
        let hostname;
        try {
            hostname = normalizeHostname(domain);
        }
        catch {
            return null;
        }
        const [row] = await this.config.db.select().from(websites).where(or(eq(websites.custom_domain, hostname), eq(websites.fallback_domain, hostname))).limit(1);
        if (!row)
            return null;
        const mapped = rowToWebsite(row);
        return mapped.ok ? mapped.value : null;
    }
    async create(candidate) {
        try {
            const [row] = await this.config.db.insert(websites).values(websiteDraftToInsert(candidate)).returning();
            if (!row)
                return { ok: false, error: { code: "invalid_persistence_state", message: "Website insert returned no row." } };
            return rowToWebsite(row);
        }
        catch (error) {
            if (duplicate(error))
                return { ok: false, error: { code: "duplicate_key", message: "Website slug or domain already exists.", field: "slug", value: String(candidate.slug) } };
            this.config.logger.error("Website create failed", { error: String(error) });
            return { ok: false, error: { code: "persistence_unavailable", message: "Website could not be persisted." } };
        }
    }
    async updateSettings(id, settings, expectedVersion) {
        return this.update(id, expectedVersion, { settings, updated_at: new Date() });
    }
    async archive(id, expectedVersion) {
        return this.update(id, expectedVersion, { status: WebsiteStatus.Archived, archived_at: new Date(), updated_at: new Date() });
    }
    async restore(id, expectedVersion) {
        return this.update(id, expectedVersion, { status: WebsiteStatus.Unpublished, archived_at: null, updated_at: new Date() });
    }
    async update(id, expectedVersion, changes) {
        try {
            const [row] = await this.config.db.update(websites).set({ ...changes, version: expectedVersion + 1 }).where(and(eq(websites.id, String(id)), eq(websites.version, expectedVersion))).returning();
            if (!row)
                return { ok: false, error: { aggregateId: String(id), expectedVersion, actualVersion: expectedVersion } };
            return rowToWebsite(row);
        }
        catch (error) {
            return { ok: false, error: { code: "invalid_persistence_state", message: String(error) } };
        }
    }
}
//# sourceMappingURL=drizzle-website-repository.js.map