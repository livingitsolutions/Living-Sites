import { describe, expect, it } from "vitest";
import { PageStatus, WebsiteStatus } from "@livingsites/domain";
import { resolvePublishedPage } from "./resolve-published.js";

const website = { id: "web_1", organizationId: "org_1", fallbackDomain: "site.example.com", customDomain: null, status: WebsiteStatus.Draft, archivedAt: null } as never;
const home = { id: "page_home", websiteId: "web_1", slug: "home", isHomepage: true, status: PageStatus.Draft, publishedSnapshotId: "snapshot_2", archivedAt: null } as never;
const nested = { ...home, id: "page_nested", slug: "services/remodel", isHomepage: false, publishedSnapshotId: "snapshot_3" } as never;
const snapshot = (id: string, pageId: string) => ({ id, pageId, websiteId: "web_1", organizationId: "org_1", revisionNumber: 2, page: {}, sections: [], createdAt: "", publishedAt: "", publishedBy: "usr" }) as never;
const deps = (pages = [home, nested], host = website) => ({ websiteReader: { findByDomain: async () => host }, pageReader: { listForWebsite: async () => pages }, pageSnapshotReader: { findById: async (id: string) => id === "snapshot_2" ? snapshot(id, "page_home") : snapshot(id, "page_nested") } }) as never;

describe("public publication resolution", () => {
  it("resolves fallback hostname, homepage, nested paths, and the referenced latest snapshot", async () => { expect((await resolvePublishedPage({ hostname: "SITE.EXAMPLE.COM:443", path: "/" }, deps())).ok).toBe(true); const result = await resolvePublishedPage({ hostname: "site.example.com", path: "/services/remodel" }, deps()); expect(result.ok && result.value.snapshot.id).toBe("snapshot_3"); });
  it("returns not found for unknown hosts, pages, and draft-only Pages", async () => { expect((await resolvePublishedPage({ hostname: "missing.example.com", path: "/" }, deps([], null as never))).ok).toBe(false); expect((await resolvePublishedPage({ hostname: "site.example.com", path: "/missing" }, deps())).ok).toBe(false); expect((await resolvePublishedPage({ hostname: "site.example.com", path: "/" }, deps([{ ...home, publishedSnapshotId: null }]))).ok).toBe(false); });
  it("hides archived Websites and Pages", async () => { expect((await resolvePublishedPage({ hostname: "site.example.com", path: "/" }, deps([home], { ...website, status: WebsiteStatus.Archived } as never))).ok).toBe(false); expect((await resolvePublishedPage({ hostname: "site.example.com", path: "/" }, deps([{ ...home, status: PageStatus.Archived }]))).ok).toBe(false); });
});
