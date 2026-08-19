import { describe, expect, it } from "vitest";
import { OrganizationActivePolicy } from "./organization-active-policy.js";
import { WebsiteCountPolicy } from "./website-count-policy.js";
import { WebsiteSlugPolicy } from "./slug-policy.js";

describe("Website creation policies", () => {
  it("allows active and denies inactive organizations", () => {
    expect(new OrganizationActivePolicy().evaluate("active").outcome).toBe("allow");
    expect(new OrganizationActivePolicy().evaluate("archived").outcome).toBe("deny");
  });

  it("allows within the plan limit and denies at the limit", () => {
    expect(new WebsiteCountPolicy().evaluate(1, 2).outcome).toBe("allow");
    expect(new WebsiteCountPolicy().evaluate(2, 2).outcome).toBe("deny");
  });

  it("denies duplicate and reserved slugs", () => {
    expect(new WebsiteSlugPolicy().evaluate("journal", true).code).toBe("website.slug.duplicate");
    expect(new WebsiteSlugPolicy().evaluate("admin", false).code).toBe("website.slug.reserved");
  });
});
