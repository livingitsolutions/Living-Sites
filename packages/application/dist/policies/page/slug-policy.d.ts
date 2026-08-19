import type { PolicyDecision } from "../shared/index.js";
export declare class PageSlugPolicy {
    readonly name = "PageSlugPolicy";
    evaluate(slug: string, duplicate: boolean): PolicyDecision;
}
//# sourceMappingURL=slug-policy.d.ts.map