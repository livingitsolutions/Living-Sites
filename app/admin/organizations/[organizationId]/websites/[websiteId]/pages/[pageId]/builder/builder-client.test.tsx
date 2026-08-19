import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PageBuilderState } from "@livingsites/application";
import { SECTION_TYPES } from "@livingsites/application";
import { PageStatus } from "@livingsites/domain";
vi.mock("./actions", () => ({ addSectionAction: vi.fn(), updateSectionAction: vi.fn(), removeSectionAction: vi.fn(), duplicateSectionAction: vi.fn(), reorderSectionsAction: vi.fn() }));
import { BuilderClient } from "./builder-client";

const state = (canEdit: boolean): PageBuilderState => ({ canEdit, sectionTypes: SECTION_TYPES, page: { id: "page_1", websiteId: "web_1", title: "Home", slug: "home", isHomepage: false, status: PageStatus.Draft, publishedSnapshotId: null, sectionOrder: ["section_1"], sections: [], availableLocales: [], parentId: null, version: 3, audit: { createdAt: "2026-08-19T00:00:00Z", updatedAt: "2026-08-19T00:00:00Z" }, archivedAt: null } as never, sections: [{ id: "section_1", pageId: "page_1", websiteId: "web_1", sectionTypeId: "section-type:hero", props: SECTION_TYPES[0]!.defaultProps, sortOrder: 0, status: "active", audit: { createdAt: "2026-08-19T00:00:00Z", updatedAt: "2026-08-19T00:00:00Z" } } as never] });

describe("Page Builder interactions", () => {
  it("renders add, select, edit, duplicate, remove, and reorder controls", () => { const html = renderToStaticMarkup(<BuilderClient organizationId="org_1" websiteId="web_1" pageId="page_1" initialState={state(true)} />); expect(html).toContain("Add and arrange sections"); expect(html).toContain("Save section"); expect(html).toContain("Duplicate"); expect(html).toContain("Remove"); expect(html).toContain("Move Hero up"); expect(html).toContain("Move Hero down"); });
  it("disables mutation controls for Viewers", () => { const html = renderToStaticMarkup(<BuilderClient organizationId="org_1" websiteId="web_1" pageId="page_1" initialState={state(false)} />); expect(html).toContain("disabled"); expect(html).toContain("Live draft preview"); });
});
