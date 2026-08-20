import { describe, expect, it } from "vitest";
import { createWebsiteDraft, normalizeHostname } from "./factory.js";
describe("createWebsiteDraft", () => {
    it("creates a normalized version-zero draft with injected identity and time", () => {
        const draft = createWebsiteDraft({
            id: "web_fixed",
            organizationId: "org_fixed",
            name: "  Field Notes  ",
            slug: "field-notes",
            customDomain: "WWW.Example.COM.",
            fallbackDomain: "web-fixed.preview.example.com",
            now: "2026-08-19T10:30:00.000Z",
            createdBy: "usr_fixed",
        });
        expect(draft.id).toBe("web_fixed");
        expect(draft.name).toBe("Field Notes");
        expect(draft.customDomain).toBe("www.example.com");
        expect(draft.fallbackDomain).toBe("web-fixed.preview.example.com");
        expect(draft.version).toBe(0);
        expect(draft.audit.createdAt).toBe("2026-08-19T10:30:00.000Z");
        expect(draft.settings.searchEngineIndexing).toBe(true);
    });
    it("rejects protocols and paths in hostnames", () => {
        expect(() => normalizeHostname("https://example.com/path")).toThrow();
    });
});
//# sourceMappingURL=factory.test.js.map