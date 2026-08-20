import { normalizeHostname } from "@livingsites/domain";
export const DEFAULT_FALLBACK_DOMAIN_SUFFIX = "livingsites.app";
export class ConfiguredFallbackDomainProvider {
    suffix;
    constructor(suffix) {
        this.suffix = normalizeHostname(suffix);
    }
    hostnameFor(websiteId) {
        const label = String(websiteId).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
        return normalizeHostname(`${label}.${this.suffix}`);
    }
}
//# sourceMappingURL=index.js.map