/**
 * Composition root — development wiring.
 *
 * Uses deterministic/in-memory adapters for local development. This is
 * explicitly named development and is NOT for production use.
 */
import { FakeClock, DeterministicIdGenerator, NoopLogger } from "@livingsites/platform";
import type { Logger } from "@livingsites/platform";
import {
  InMemoryOrganizationRepository,
  InMemoryPlanRepository,
  InMemoryUserRepository,
  InMemoryMembershipRepository,
  FakeAuthenticationAdapter,
  CapturingVerificationEmailAdapter,
  NoopEventPublisher,
} from "@livingsites/test-support";
import type {
  EventPublisher,
  EmailVerificationPort,
  CreateOrganizationDeps,
  RegisterUserDeps,
  AddOrganizationMemberDeps,
  ChangeOrganizationMemberRoleDeps,
  RemoveOrganizationMemberDeps,
  GetOrganizationMembersDeps,
} from "@livingsites/application";
import {
  createOrganization,
  registerUser,
  addOrganizationMember,
  changeOrganizationMemberRole,
  removeOrganizationMember,
  getOrganizationMembers,
  AuthorizationService,
} from "@livingsites/application";

export interface DevelopmentCompositionConfig {
  readonly initialClockMs?: number;
  readonly eventPublisher?: EventPublisher;
  readonly registrationMode?: "open" | "invite_only" | "disabled";
  readonly emailVerificationPort?: EmailVerificationPort;
}

export interface DevelopmentComposition {
  readonly clock: FakeClock;
  readonly idGenerator: DeterministicIdGenerator;
  readonly logger: Logger;
  readonly eventPublisher: EventPublisher;
  readonly organizationRepository: InMemoryOrganizationRepository;
  readonly planRepository: InMemoryPlanRepository;
  readonly userRepository: InMemoryUserRepository;
  readonly membershipRepository: InMemoryMembershipRepository;
  readonly authorizationService: AuthorizationService;
  readonly authenticationPort: FakeAuthenticationAdapter;
  readonly emailVerificationPort: EmailVerificationPort;
  readonly createOrganization: typeof createOrganization;
  readonly createOrganizationDeps: CreateOrganizationDeps;
  readonly registerUser: typeof registerUser;
  readonly registerUserDeps: RegisterUserDeps;
  readonly addOrganizationMember: typeof addOrganizationMember;
  readonly addOrganizationMemberDeps: AddOrganizationMemberDeps;
  readonly changeOrganizationMemberRole: typeof changeOrganizationMemberRole;
  readonly changeOrganizationMemberRoleDeps: ChangeOrganizationMemberRoleDeps;
  readonly removeOrganizationMember: typeof removeOrganizationMember;
  readonly removeOrganizationMemberDeps: RemoveOrganizationMemberDeps;
  readonly getOrganizationMembers: typeof getOrganizationMembers;
  readonly getOrganizationMembersDeps: GetOrganizationMembersDeps;
}

export function composeDevelopment(config: DevelopmentCompositionConfig = {}): DevelopmentComposition {
  const clock = new FakeClock(config.initialClockMs ?? 0);
  const idGenerator = new DeterministicIdGenerator();
  const logger = new NoopLogger();
  const eventPublisher = config.eventPublisher ?? new NoopEventPublisher();
  const organizationRepository = new InMemoryOrganizationRepository();
  const planRepository = new InMemoryPlanRepository();
  const userRepository = new InMemoryUserRepository();
  const membershipRepository = new InMemoryMembershipRepository();
  const authorizationService = new AuthorizationService({
    membershipReader: membershipRepository,
  });
  const authenticationPort = new FakeAuthenticationAdapter();
  const emailVerificationPort = config.emailVerificationPort ?? new CapturingVerificationEmailAdapter();

  const createOrganizationDeps: CreateOrganizationDeps = {
    organizationRepository,
    planRepository,
    eventPublisher,
    clock,
    idGenerator,
  };

  const registerUserDeps: RegisterUserDeps = {
    authenticationPort,
    userReader: userRepository,
    userCreator: userRepository,
    eventPublisher,
    clock,
    idGenerator,
    registrationMode: config.registrationMode ?? "open",
  };

  const addOrganizationMemberDeps: AddOrganizationMemberDeps = {
    membershipRepository,
    userReader: userRepository,
    authorizationService,
    eventPublisher,
    clock,
    idGenerator,
  };

  const changeOrganizationMemberRoleDeps: ChangeOrganizationMemberRoleDeps = {
    membershipRepository,
    authorizationService,
    eventPublisher,
    clock,
  };

  const removeOrganizationMemberDeps: RemoveOrganizationMemberDeps = {
    membershipRepository,
    authorizationService,
    eventPublisher,
    clock,
  };

  const getOrganizationMembersDeps: GetOrganizationMembersDeps = {
    membershipRepository,
    authorizationService,
  };

  return {
    clock,
    idGenerator,
    logger,
    eventPublisher,
    organizationRepository,
    planRepository,
    userRepository,
    membershipRepository,
    authorizationService,
    authenticationPort,
    emailVerificationPort,
    createOrganization,
    createOrganizationDeps,
    registerUser,
    registerUserDeps,
    addOrganizationMember,
    addOrganizationMemberDeps,
    changeOrganizationMemberRole,
    changeOrganizationMemberRoleDeps,
    removeOrganizationMember,
    removeOrganizationMemberDeps,
    getOrganizationMembers,
    getOrganizationMembersDeps,
  };
}
