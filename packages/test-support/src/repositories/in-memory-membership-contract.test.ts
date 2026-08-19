import { runMembershipRepositoryContractTests } from "./membership-contract-tests.js";
import { InMemoryMembershipRepository } from "./in-memory-membership-repository.js";

runMembershipRepositoryContractTests("InMemoryMembershipRepository", {
  async createRepository() {
    return new InMemoryMembershipRepository();
  },
  async createOrganization() {},
  async createUser() {},
  async cleanup() {},
});
