import { describe, expect, it } from "vitest";
import type { ISODateString, PageId, Slug, UserId, WebsiteId } from "../../shared";
import { PageStatus } from "../../page";
import { createPageDraft, normalizePageSlug } from "./factory";

describe("Page draft factory", () => {
  it("normalizes a slug and creates a version-zero draft", () => {
    expect(normalizePageSlug(" /Services/Home Remodel/ ")).toBe("services/home-remodel");
    const page = createPageDraft({ id: "page_1" as PageId, websiteId: "web_1" as WebsiteId, title: " About ", slug: "about" as Slug, now: "2026-08-19T00:00:00.000Z" as ISODateString, createdBy: "usr_1" as UserId });
    expect(page).toMatchObject({ title: "About", slug: "about", status: PageStatus.Draft, version: 0, archivedAt: null, sectionOrder: [] });
  });

  it("rejects invalid slugs", () => {
    expect(() => normalizePageSlug("bad//route")).toThrow(/slug/i);
  });
});
