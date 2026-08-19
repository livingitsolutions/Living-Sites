export class PageWebsiteActivePolicy {
    name = "PageWebsiteActivePolicy";
    evaluate(status) {
        return status === "archived"
            ? { outcome: "deny", policyName: this.name, severity: "hard", message: "Pages cannot be created or changed for an archived Website.", code: "page.website.archived" }
            : { outcome: "allow", policyName: this.name, severity: "hard", message: "Website accepts Page changes.", code: "page.website.active" };
    }
}
//# sourceMappingURL=website-active-policy.js.map