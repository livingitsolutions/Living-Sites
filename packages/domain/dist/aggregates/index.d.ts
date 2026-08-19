/**
 * Aggregate catalog barrel — domain layer.
 *
 * Aggregate roots, child entities, invariants, value objects, and
 * consistency boundaries are domain concepts. Each bounded context has a
 * subfolder with a README.md describing its aggregates. No implementations —
 * documentation placeholders only.
 *
 * No generic AggregateRoot base class or framework is introduced here.
 * Aggregates are plain domain entities with documented boundaries.
 */
export * from "./organization/index.js";
export { createUserDraft, type UserDraft, type DraftVersion as UserDraftVersion, type CreateUserDraftInput, DRAFT_VERSION as USER_DRAFT_VERSION, createMembershipDraft, type MembershipDraft, type MembershipDraftVersion, type CreateMembershipDraftInput, MEMBERSHIP_DRAFT_VERSION, } from "./users/index.js";
export * from "./website/index.js";
export * from "./navigation/index.js";
export * from "./theme/index.js";
export * from "./page/index.js";
export * from "./section/index.js";
export * from "./media/index.js";
export * from "./seo/index.js";
export * from "./analytics/index.js";
export * from "./forms/index.js";
export * from "./export/index.js";
//# sourceMappingURL=index.d.ts.map