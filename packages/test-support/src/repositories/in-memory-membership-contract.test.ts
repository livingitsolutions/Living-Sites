import { runMembershipRepositoryContractTests } from "./membership-contract-tests";
import { InMemoryMembershipRepository } from "./in-memory-membership-repository";

runMembershipRepositoryContractTests("InMemoryMembershipRepository", {
  async createRepository() {
    return new InMemoryMembershipRepository();
  },
  async createOrganization() {},
  async createUser() {},
  async cleanup() {},
});
