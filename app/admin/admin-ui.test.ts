import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createWebsiteDraft, type ISODateString, type OrganizationId, type Slug, type UserId, type WebsiteId } from "@livingsites/domain";
import { MediaPermissions, OrganizationPermissions, WebsitePermissions } from "@livingsites/application";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/organizations/org-alpha/websites" }));

import { AdminNavigation } from "./components/navigation";
import { buildOrganizationNavigation } from "./lib/navigation-config";
import { WebsitesView } from "./organizations/[organizationId]/websites/websites-view";

const organization = { id: "org-alpha", name: "Alpha Org", slug: "alpha-org" } as any;
const publicationAction = async () => {};

describe("admin shell UI", () => {
  it("renders desktop and keyboard-operable mobile navigation", () => {
    const html = renderToStaticMarkup(React.createElement(AdminNavigation, { organization, navigation: [{ label: "Websites", href: "/admin/organizations/org-alpha/websites" }] }));
    expect(html).toContain("admin-sidebar");
    expect(html).toContain("mobile-navigation");
    expect(html).toContain("<details");
    expect(html).toContain('aria-current="page"');
  });

  it("only includes navigation entries granted by read permissions", () => {
    const links = buildOrganizationNavigation("org-alpha", { [OrganizationPermissions.Read]: true, [WebsitePermissions.Read]: true, [MediaPermissions.Read]: false });
    expect(links.map((link) => link.label)).toEqual(["Dashboard", "Websites", "Analytics"]);
  });

  it("renders real Website fields", () => {
    const website = createWebsiteDraft({ id: "web-alpha" as WebsiteId, organizationId: "org-alpha" as OrganizationId, name: "Field Notes", slug: "field-notes" as Slug, fallbackDomain: "web-alpha.livingsites.app", now: "2026-08-19T10:00:00Z" as ISODateString, createdBy: "user-alpha" as UserId });
    const html = renderToStaticMarkup(React.createElement(WebsitesView, { organizationId: "org-alpha", websites: [website], canCreate: false, canPublish: false, publishAction: publicationAction, unpublishAction: publicationAction }));
    expect(html).toContain("Field Notes");
    expect(html).toContain("/field-notes");
    expect(html).toContain("web-alpha.livingsites.app");
    expect(html).toContain("draft");
  });

  it("renders the empty Website state without a create action for viewers", () => {
    const html = renderToStaticMarkup(React.createElement(WebsitesView, { organizationId: "org-alpha", websites: [], canCreate: false, canPublish: false, publishAction: publicationAction, unpublishAction: publicationAction }));
    expect(html).toContain("Create your first Website");
    expect(html).not.toContain("Create Website</summary>");
  });
});
