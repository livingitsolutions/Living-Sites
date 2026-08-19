import type {
  User,
  Role,
  UserId,
  OrganizationId,
  PaginatedResult,
  PaginationParams,
  AggregateVersion,
} from "@livingsites/domain";
import type {
  CreateResult,
  SaveResult,
  MutationResult,
} from "../contracts.js";

export interface UserListParams extends PaginationParams {
  search?: string;
  status?: "active" | "archived" | "deleted";
}

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(params: UserListParams): Promise<PaginatedResult<User>>;
  create(candidate: Omit<User, "id" | "audit" | "version">): Promise<CreateResult<User>>;
  save(aggregate: User, expectedVersion: AggregateVersion): Promise<SaveResult<User>>;
  softDelete(id: UserId, expectedVersion: AggregateVersion): Promise<MutationResult>;
}

export interface RoleRepository {
  findByKey(key: string): Promise<Role | null>;
  listSystemRoles(): Promise<Role[]>;
  listForOrganization(organizationId: OrganizationId): Promise<Role[]>;
  create(candidate: Omit<Role, "key" | "version">): Promise<CreateResult<Role>>;
  save(aggregate: Role, expectedVersion: AggregateVersion): Promise<SaveResult<Role>>;
}
