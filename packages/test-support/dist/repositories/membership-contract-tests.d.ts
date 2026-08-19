import type { MembershipRepository } from "@livingsites/application";
export interface MembershipRepositoryContractFixtures {
    createRepository(): Promise<MembershipRepository>;
    createOrganization(id: string): Promise<void>;
    createUser(id: string, email: string): Promise<void>;
    cleanup(): Promise<void>;
}
export declare function runMembershipRepositoryContractTests(name: string, fixtures: MembershipRepositoryContractFixtures): void;
//# sourceMappingURL=membership-contract-tests.d.ts.map