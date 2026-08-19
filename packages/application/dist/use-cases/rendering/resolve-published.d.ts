import type { Page, PageSnapshot, Result, Website } from "@livingsites/domain";
import type { PageReader, PageSnapshotReader } from "../../repositories/page.js";
import type { WebsiteReader } from "../../repositories/website.js";
export type PublicResolutionError = {
    readonly code: "not_found";
    readonly message: string;
};
export interface PublishedWebsiteResolution {
    readonly website: Website;
}
export interface PublishedPageResolution {
    readonly website: Website;
    readonly page: Page;
    readonly snapshot: PageSnapshot;
}
export declare function resolvePublishedWebsite(input: {
    readonly hostname: string;
}, deps: {
    readonly websiteReader: WebsiteReader;
}): Promise<Result<PublishedWebsiteResolution, PublicResolutionError>>;
export declare function resolvePublishedPage(input: {
    readonly hostname: string;
    readonly path: string;
}, deps: {
    readonly websiteReader: WebsiteReader;
    readonly pageReader: PageReader;
    readonly pageSnapshotReader: PageSnapshotReader;
}): Promise<Result<PublishedPageResolution, PublicResolutionError>>;
//# sourceMappingURL=resolve-published.d.ts.map