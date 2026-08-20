import type { WebsiteId } from "@livingsites/domain";
import type { FallbackDomainProvider } from "@livingsites/application";
export declare const DEFAULT_FALLBACK_DOMAIN_SUFFIX = "livingsites.app";
export declare class ConfiguredFallbackDomainProvider implements FallbackDomainProvider {
    private readonly suffix;
    constructor(suffix: string);
    hostnameFor(websiteId: WebsiteId): string;
}
//# sourceMappingURL=index.d.ts.map