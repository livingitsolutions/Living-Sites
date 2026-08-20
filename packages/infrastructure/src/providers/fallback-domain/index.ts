import { normalizeHostname } from "@livingsites/domain";
import type { WebsiteId } from "@livingsites/domain";
import type { FallbackDomainProvider } from "@livingsites/application";

export const DEFAULT_FALLBACK_DOMAIN_SUFFIX = "livingsites.app";

export class ConfiguredFallbackDomainProvider implements FallbackDomainProvider {
  private readonly suffix: string;

  constructor(suffix: string) {
    this.suffix = normalizeHostname(suffix);
  }

  hostnameFor(websiteId: WebsiteId): string {
    const label = String(websiteId).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    return normalizeHostname(`${label}.${this.suffix}`);
  }
}
