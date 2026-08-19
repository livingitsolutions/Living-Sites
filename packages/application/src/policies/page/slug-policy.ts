import type { PolicyDecision } from "../shared/index.js";

export class PageSlugPolicy {
  readonly name = "PageSlugPolicy";
  evaluate(slug: string, duplicate: boolean): PolicyDecision {
    if (!slug || slug.length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(slug)) return { outcome: "deny", policyName: this.name, severity: "hard", message: "Page slug is invalid.", code: "page.slug.invalid" };
    return duplicate
      ? { outcome: "deny", policyName: this.name, severity: "hard", message: `Page slug "${slug}" is already active in this Website.`, code: "page.slug.duplicate" }
      : { outcome: "allow", policyName: this.name, severity: "hard", message: "Page slug is available.", code: "page.slug.available" };
  }
}
