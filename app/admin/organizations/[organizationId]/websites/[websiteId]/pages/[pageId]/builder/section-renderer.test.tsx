import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Section } from "@livingsites/domain";
import { SECTION_TYPES } from "@livingsites/application";
import { RegisteredSectionRenderer } from "./section-renderer";

describe("registered section preview renderer", () => {
  it.each(SECTION_TYPES.map((type) => [type.name, type]))("renders trusted %s output", (_, type) => { const section = { id: "section_test", pageId: "page_test", websiteId: "web_test", sectionTypeId: type.id, props: type.defaultProps, sortOrder: 0, status: "active", audit: { createdAt: "2026-08-19T00:00:00Z", updatedAt: "2026-08-19T00:00:00Z" } } as unknown as Section; const html = renderToStaticMarkup(<RegisteredSectionRenderer section={section} />); expect(html).not.toContain("Unsupported section type"); expect(html).not.toContain("dangerouslySetInnerHTML"); });
  it("escapes user-controlled rich text", () => { const section = { id: "section_test", pageId: "page_test", websiteId: "web_test", sectionTypeId: "section-type:rich-text", props: { heading: "Safe", body: "<script>alert(1)</script>" }, sortOrder: 0, status: "active", audit: { createdAt: "", updatedAt: "" } } as unknown as Section; const html = renderToStaticMarkup(<RegisteredSectionRenderer section={section} />); expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>"); });
  it("safely renders immutable snapshot-shaped section content", () => { const snapshotSection = { sectionTypeId: "section-type:rich-text", props: { heading: "Historical", body: "<img src=x onerror=alert(1)>" } }; const html = renderToStaticMarkup(<RegisteredSectionRenderer section={snapshotSection as unknown as Section} />); expect(html).toContain("Historical"); expect(html).toContain("&lt;img"); expect(html).not.toContain("<img src=x"); });
});
