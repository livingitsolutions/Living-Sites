import { describe, expect, it } from "vitest";
import type { ISODateString, OrganizationId, Slug, UserId, WebsiteId } from "../../shared/index.js";
import { createWebsiteDraft, normalizeHostname } from "./factory.js";

describe("createWebsiteDraft", () => {
  it("creates a normalized version-zero draft with injected identity and time", () => {
    const draft = createWebsiteDraft({
      id: "web_fixed" as WebsiteId,
      organizationId: "org_fixed" as OrganizationId,
      name: "  Field Notes  ",
      slug: "field-notes" as Slug,
      customDomain: "WWW.Example.COM.",
      now: "2026-08-19T10:30:00.000Z" as ISODateString,
      createdBy: "usr_fixed" as UserId,
    });
    expect(draft.id).toBe("web_fixed");
    expect(draft.name).toBe("Field Notes");
    expect(draft.customDomain).toBe("www.example.com");
    expect(draft.fallbackDomain).toBe("web-fixed.livingsites.app");
    expect(draft.version).toBe(0);
    expect(draft.audit.createdAt).toBe("2026-08-19T10:30:00.000Z");
    expect(draft.settings.searchEngineIndexing).toBe(true);
  });

  it("rejects protocols and paths in hostnames", () => {
    expect(() => normalizeHostname("https://example.com/path")).toThrow();
  });
});
