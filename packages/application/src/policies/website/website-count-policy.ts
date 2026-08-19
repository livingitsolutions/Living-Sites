import type { PolicyDecision } from "../shared";

export class WebsiteCountPolicy {
  readonly name = "WebsiteCountPolicy";
  evaluate(currentCount: number, maxWebsites: number | null): PolicyDecision {
    return maxWebsites === null || currentCount < maxWebsites
      ? { outcome: "allow", policyName: this.name, severity: "hard", message: "Website limit permits creation.", code: "website.limit.available", data: { currentCount, maxWebsites } }
      : { outcome: "deny", policyName: this.name, severity: "hard", message: "The organization has reached its website limit.", code: "website.limit.exceeded", details: { currentCount, maxWebsites } };
  }
}
