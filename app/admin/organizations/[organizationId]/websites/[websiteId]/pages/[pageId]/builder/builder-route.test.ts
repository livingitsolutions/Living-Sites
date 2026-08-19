import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../../../../lib/admin-context", () => ({ getOrganizationAdminContext: vi.fn(async () => ({ kind: "unauthorized" })) }));
vi.mock("@/app/lib/composition", () => ({ getComposition: vi.fn() }));

import BuilderPage from "./page";

describe("Page Builder route authorization", () => {
  it("does not render builder state without an authorized organization context", async () => { const output = await BuilderPage({ params: Promise.resolve({ organizationId: "org_1", websiteId: "web_1", pageId: "page_1" }) }); expect(output).toBeNull(); });
});
