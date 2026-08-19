import type { PolicyDecision } from "../shared/index.js";
export declare class WebsiteCountPolicy {
    readonly name = "WebsiteCountPolicy";
    evaluate(currentCount: number, maxWebsites: number | null): PolicyDecision;
}
//# sourceMappingURL=website-count-policy.d.ts.map