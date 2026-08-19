const RESERVED_WEBSITE_SLUGS = ["admin", "api", "app", "assets", "auth", "login", "register", "www"];
export class WebsiteSlugPolicy {
    name = "WebsiteSlugPolicy";
    evaluate(slug, duplicate) {
        if (RESERVED_WEBSITE_SLUGS.includes(slug)) {
            return { outcome: "deny", policyName: this.name, severity: "hard", message: `Website slug "${slug}" is reserved.`, code: "website.slug.reserved", details: { slug } };
        }
        return duplicate
            ? { outcome: "deny", policyName: this.name, severity: "hard", message: `Website slug "${slug}" is already used in this organization.`, code: "website.slug.duplicate", details: { slug } }
            : { outcome: "allow", policyName: this.name, severity: "hard", message: "Website slug is available.", code: "website.slug.available" };
    }
}
//# sourceMappingURL=slug-policy.js.map