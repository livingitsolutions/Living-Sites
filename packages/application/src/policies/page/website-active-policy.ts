import type { PolicyDecision } from "../shared";

export class PageWebsiteActivePolicy {
  readonly name = "PageWebsiteActivePolicy";
  evaluate(status: string): PolicyDecision {
    return status === "archived"
      ? { outcome: "deny", policyName: this.name, severity: "hard", message: "Pages cannot be created or changed for an archived Website.", code: "page.website.archived" }
      : { outcome: "allow", policyName: this.name, severity: "hard", message: "Website accepts Page changes.", code: "page.website.active" };
  }
}
