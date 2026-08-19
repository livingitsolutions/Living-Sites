import type { AggregateVersion, OrganizationId, Page, PageId, Result, Section, SectionId, UserId, WebsiteId } from "@livingsites/domain";
import type { Clock, IdGenerator } from "@livingsites/platform";
import type { AuthorizationService } from "../../authorization/service";
import type { PageMutationPersistence, PageReader } from "../../repositories/page";
import type { WebsiteReader } from "../../repositories/website";
import { SECTION_TYPES } from "../../section-types";
export type BuilderErrorCode = "unauthorized" | "website_not_found" | "not_found" | "draft_only" | "invalid_section_type" | "invalid_props" | "cross_page_section" | "invalid_order" | "concurrency_conflict" | "persistence_error";
export type BuilderError = {
    readonly code: BuilderErrorCode;
    readonly message: string;
};
export interface PageBuilderState {
    readonly page: Page;
    readonly sections: readonly Section[];
    readonly sectionTypes: typeof SECTION_TYPES;
    readonly canEdit: boolean;
}
type Context = {
    readonly organizationId: OrganizationId;
    readonly websiteId: WebsiteId;
    readonly pageId: PageId;
};
type MutationContext = Context & {
    readonly expectedVersion: AggregateVersion;
};
export interface BuilderDeps {
    readonly authenticatedUser: {
        readonly userId: UserId;
    };
    readonly authorizationService: AuthorizationService;
    readonly websiteReader: WebsiteReader;
    readonly pageReader: PageReader;
    readonly pageMutationPersistence: PageMutationPersistence;
    readonly clock: Clock;
    readonly idGenerator: IdGenerator;
}
export declare function getPageBuilderState(input: Context, deps: BuilderDeps): Promise<Result<PageBuilderState, BuilderError>>;
export declare function addSection(input: MutationContext & {
    readonly sectionTypeKey: string;
    readonly props?: Readonly<Record<string, unknown>>;
}, deps: BuilderDeps): Promise<Result<PageBuilderState, BuilderError>>;
export declare function updateSection(input: MutationContext & {
    readonly sectionId: SectionId;
    readonly props: Readonly<Record<string, unknown>>;
}, deps: BuilderDeps): Promise<Result<PageBuilderState, BuilderError>>;
export declare function removeSection(input: MutationContext & {
    readonly sectionId: SectionId;
}, deps: BuilderDeps): Promise<Result<PageBuilderState, BuilderError>>;
export declare function duplicateSection(input: MutationContext & {
    readonly sectionId: SectionId;
}, deps: BuilderDeps): Promise<Result<PageBuilderState, BuilderError>>;
export declare function reorderSections(input: MutationContext & {
    readonly sectionIds: readonly SectionId[];
}, deps: BuilderDeps): Promise<Result<PageBuilderState, BuilderError>>;
export {};
//# sourceMappingURL=index.d.ts.map