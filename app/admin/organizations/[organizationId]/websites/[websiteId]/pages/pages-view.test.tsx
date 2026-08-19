import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Page } from "@livingsites/domain";
import { PageStatus } from "@livingsites/domain";
import { PagesView } from "./pages-view";

const action = async () => ({ status: "success" as const }); const mutation = async () => {};
describe("CMS Pages view", () => {
  it("renders the Create Page empty state", () => { const html = renderToStaticMarkup(<PagesView pages={[]} canCreate canUpdate canArchive createAction={action} updateAction={action} archiveAction={mutation} restoreAction={mutation} />); expect(html).toContain("Create your first Page"); expect(html).toContain("Create Page"); });
  it("renders list metadata and lifecycle actions", () => { const page = { id: "page_1", websiteId: "web_1", title: "About", slug: "about", isHomepage: false, status: PageStatus.Archived, publishedSnapshotId: null, sectionOrder: [], availableLocales: [], parentId: null, version: 2, audit: { createdAt: "2026-08-19T00:00:00.000Z", updatedAt: "2026-08-19T00:00:00.000Z" }, archivedAt: "2026-08-19T00:00:00.000Z" } as unknown as Page; const html = renderToStaticMarkup(<PagesView pages={[page]} canCreate canUpdate canArchive createAction={action} updateAction={action} archiveAction={mutation} restoreAction={mutation} />); expect(html).toContain("About"); expect(html).toContain("/about"); expect(html).toContain("archived"); expect(html).toContain("Restore"); });
});
