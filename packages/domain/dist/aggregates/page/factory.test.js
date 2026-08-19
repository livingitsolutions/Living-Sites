import { describe, expect, it } from "vitest";
import { PageStatus } from "../../page/index.js";
import { createPageDraft, normalizePageSlug } from "./factory.js";
describe("Page draft factory", () => {
    it("normalizes a slug and creates a version-zero draft", () => {
        expect(normalizePageSlug(" /Services/Home Remodel/ ")).toBe("services/home-remodel");
        const page = createPageDraft({ id: "page_1", websiteId: "web_1", title: " About ", slug: "about", now: "2026-08-19T00:00:00.000Z", createdBy: "usr_1" });
        expect(page).toMatchObject({ title: "About", slug: "about", status: PageStatus.Draft, version: 0, archivedAt: null, sectionOrder: [] });
    });
    it("rejects invalid slugs", () => {
        expect(() => normalizePageSlug("bad//route")).toThrow(/slug/i);
    });
});
//# sourceMappingURL=factory.test.js.map