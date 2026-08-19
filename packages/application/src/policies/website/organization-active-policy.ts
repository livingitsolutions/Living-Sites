import type { PolicyDecision } from "../shared";

export class OrganizationActivePolicy {
  readonly name = "OrganizationActivePolicy";
  evaluate(status: string): PolicyDecision {
    return status === "active"
      ? { outcome: "allow", policyName: this.name, severity: "hard", message: "Organization is active.", code: "website.organization.active" }
      : { outcome: "deny", policyName: this.name, severity: "hard", message: "Websites can only be created for active organizations.", code: "website.organization.inactive", details: { status } };
  }
}
