export class WebsiteCountPolicy {
    name = "WebsiteCountPolicy";
    evaluate(currentCount, maxWebsites) {
        return maxWebsites === null || currentCount < maxWebsites
            ? { outcome: "allow", policyName: this.name, severity: "hard", message: "Website limit permits creation.", code: "website.limit.available", data: { currentCount, maxWebsites } }
            : { outcome: "deny", policyName: this.name, severity: "hard", message: "The organization has reached its website limit.", code: "website.limit.exceeded", details: { currentCount, maxWebsites } };
    }
}
//# sourceMappingURL=website-count-policy.js.map