/**
 * Composition root — production wiring for Netlify Database + Better Auth.
 *
 * Uses the Netlify Database provider which automatically resolves the
 * connection in the Netlify runtime. Better Auth is configured with
 * the Drizzle adapter backed by the same database.
 *
 * Fails fast on missing BETTER_AUTH_SECRET.
 * Fails fast on invalid BETTER_AUTH_URL or trusted origins.
 * Fails fast when email delivery is enabled but no EmailAdapter is configured.
 * Does NOT import test-support.
 * Does NOT contain in-memory authentication storage.
 */
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { SystemClock, CryptoIdGenerator, ConsoleLogger } from "@livingsites/platform";
import type { Clock, IdGenerator, Logger } from "@livingsites/platform";
import {
  createNetlifyDatabase,
  DrizzleOrganizationRepository,
  DrizzlePlanReader,
  DrizzleFeatureReader,
  DrizzleUserRepository,
  BetterAuthAdapter,
  asBetterAuthInstance,
  createBetterAuthDatabaseAdapter,
  OutboxEventPublisher,
  DrizzleOrganizationCreationPersistence,
  DrizzleOutboxProcessor,
  LinkageReconciler,
  DrizzleOrphanIdentityDisabler,
  DrizzleIdentityLinkageStore,
  DrizzleMembershipRepository,
  DrizzleSuperAdminStore,
  DrizzleWebsiteRepository,
  DrizzleWebsiteCreationPersistence,
  DrizzlePageRepository,
  DrizzlePagePublicationRepository,
  MissingNetlifyDatabaseError,
} from "@livingsites/infrastructure";
import type { BetterAuthInstance } from "@livingsites/infrastructure";
import type {
  OrganizationReader,
  OrganizationCreator,
  PlanReader,
  FeatureReader,
  UserReader,
  UserCreator,
  MembershipRepository,
  EventPublisher,
  OrganizationCreationPersistence,
  OutboxProcessor,
  AuthenticationPort,
  EmailVerificationPort,
  PasswordResetEmailPort,
  RegistrationMode,
  WebsiteReader,
  WebsiteCreationPersistence,
  PageRepository,
  PagePublisher,
  PageSnapshotReader,
} from "@livingsites/application";
import {
  createOrganization,
  registerUser,
  addOrganizationMember,
  changeOrganizationMemberRole,
  removeOrganizationMember,
  getOrganizationMembers,
  createWebsite,
  getWebsite,
  listOrganizationWebsites,
  createPage,
  getPage,
  listWebsitePages,
  updatePageDetails,
  archivePage,
  restorePage,
  addSection,
  updateSection,
  removeSection,
  duplicateSection,
  reorderSections,
  getPageBuilderState,
  publishPage,
  resolvePublishedPage,
  resolvePublishedWebsite,
  AuthorizationService,
  parseRegistrationMode,
  DEFAULT_PRODUCTION_REGISTRATION_MODE,
} from "@livingsites/application";
import type {
  CreateOrganizationDeps,
  RegisterUserDeps,
  AddOrganizationMemberDeps,
  ChangeOrganizationMemberRoleDeps,
  RemoveOrganizationMemberDeps,
  GetOrganizationMembersDeps,
} from "@livingsites/application";

export interface ProductionCompositionConfig {
  readonly connectionString?: string;
  readonly logLevel?: "trace" | "debug" | "info" | "warn" | "error" | "silent";
  readonly outboxMaxAttempts?: number;
  readonly outboxBaseBackoffMs?: number;
  readonly outboxMaxBackoffMs?: number;
  readonly betterAuthSecret: string;
  readonly betterAuthUrl: string;
  readonly trustedOrigins: readonly string[];
  readonly registrationMode?: string;
  readonly emailVerificationEnabled?: boolean;
  readonly emailAdapter?: EmailVerificationPort;
  readonly passwordResetEmailAdapter?: PasswordResetEmailPort;
  readonly linkageBatchSize?: number;
  readonly linkageGracePeriodMs?: number;
}

export interface ProductionComposition {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly logger: Logger;
  readonly eventPublisher: EventPublisher;
  readonly organizationRepository: OrganizationReader & OrganizationCreator;
  readonly planReader: PlanReader;
  readonly featureReader: FeatureReader;
  readonly userReader: UserReader;
  readonly userCreator: UserCreator;
  readonly membershipRepository: MembershipRepository;
  readonly websiteRepository: WebsiteReader;
  readonly websiteCreationPersistence: WebsiteCreationPersistence;
  readonly pageRepository: PageRepository;
  readonly pagePublisher: PagePublisher;
  readonly pageSnapshotReader: PageSnapshotReader;
  readonly superAdminStore: DrizzleSuperAdminStore;
  readonly authorizationService: AuthorizationService;
  readonly authenticationPort: AuthenticationPort;
  readonly authInstance: BetterAuthInstance;
  readonly emailVerificationPort: EmailVerificationPort | null;
  readonly passwordResetEmailPort: PasswordResetEmailPort | null;
  readonly organizationCreationPersistence: OrganizationCreationPersistence;
  readonly outboxProcessor: OutboxProcessor;
  readonly linkageReconciler: LinkageReconciler;
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
  readonly createWebsite: typeof createWebsite;
  readonly getWebsite: typeof getWebsite;
  readonly listOrganizationWebsites: typeof listOrganizationWebsites;
  readonly createPage: typeof createPage;
  readonly getPage: typeof getPage;
  readonly listWebsitePages: typeof listWebsitePages;
  readonly updatePageDetails: typeof updatePageDetails;
  readonly archivePage: typeof archivePage;
  readonly restorePage: typeof restorePage;
  readonly addSection: typeof addSection;
  readonly updateSection: typeof updateSection;
  readonly removeSection: typeof removeSection;
  readonly duplicateSection: typeof duplicateSection;
  readonly reorderSections: typeof reorderSections;
  readonly getPageBuilderState: typeof getPageBuilderState;
  readonly publishPage: typeof publishPage;
  readonly resolvePublishedPage: typeof resolvePublishedPage;
  readonly resolvePublishedWebsite: typeof resolvePublishedWebsite;
  readonly registrationMode: RegistrationMode;
  readonly healthCheck: () => Promise<{ healthy: boolean; details: Record<string, boolean> }>;
  readonly close: () => Promise<void>;
}

function validateConfig(config: ProductionCompositionConfig): void {
  if (!config.betterAuthSecret || config.betterAuthSecret.length < 32) {
    throw new Error(
      "BETTER_AUTH_SECRET is missing or too short (minimum 32 characters). " +
        "Set it in your environment configuration.",
    );
  }
  if (!config.betterAuthUrl) {
    throw new Error("BETTER_AUTH_URL is missing. Set it to your application's base URL.");
  }
  try {
    new URL(config.betterAuthUrl);
  } catch {
    throw new Error(`BETTER_AUTH_URL is not a valid URL: ${config.betterAuthUrl}`);
  }
  if (!config.trustedOrigins || config.trustedOrigins.length === 0) {
    throw new Error("At least one trusted origin must be configured.");
  }
  for (const origin of config.trustedOrigins) {
    try {
      new URL(origin);
    } catch {
      throw new Error(`Trusted origin is not a valid URL: ${origin}`);
    }
  }
  if (config.emailVerificationEnabled && !config.emailAdapter) {
    throw new Error(
      "Email verification is enabled but no EmailAdapter is configured. " +
        "Production cannot silently discard verification emails. " +
        "Provide an EmailAdapter or disable email verification.",
    );
  }
}

export function composeProduction(
  config: ProductionCompositionConfig,
): ProductionComposition {
  validateConfig(config);

  const logger = new ConsoleLogger("app", config.logLevel ?? "info");
  const clock = new SystemClock();
  const idGenerator = new CryptoIdGenerator();
  const registrationMode = parseRegistrationMode(config.registrationMode) ?? DEFAULT_PRODUCTION_REGISTRATION_MODE;

  let connection;
  try {
    connection = createNetlifyDatabase({
      ...(config.connectionString ? { connectionString: config.connectionString } : {}),
    });
  } catch (err) {
    if (err instanceof MissingNetlifyDatabaseError) {
      throw err;
    }
    throw new MissingNetlifyDatabaseError(
      `Failed to initialize Netlify Database: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const db = connection.db;
  const identityDisabler = new DrizzleOrphanIdentityDisabler(db);
  const identityLinkageStore = new DrizzleIdentityLinkageStore(db);

  const rawAuth = betterAuth({
    secret: config.betterAuthSecret,
    baseURL: config.betterAuthUrl,
    trustedOrigins: [...config.trustedOrigins],
    database: createBetterAuthDatabaseAdapter(db),
    user: {
      additionalFields: {
        disabled: { type: "boolean", required: false, input: false, defaultValue: false },
        disabledAt: { type: "date", required: false, input: false, fieldName: "disabled_at" },
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const createdAt = new Date(clock.nowIso());
            await identityLinkageStore.recordPending({
              id: idGenerator.generatePrefixed("linkage"),
              authSubjectId: user.id,
              email: user.email,
              displayName: user.name,
              createdAt,
            });
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            return (await identityDisabler.isDisabled(session.userId)) ? false : undefined;
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: registrationMode !== "open",
      requireEmailVerification: config.emailVerificationEnabled ?? false,
      minPasswordLength: 12,
      maxPasswordLength: 256,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        if (!config.passwordResetEmailAdapter) return;
        await config.passwordResetEmailAdapter.sendPasswordResetEmail({
          email: user.email,
          resetUrl: url,
        });
      },
    },
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    advanced: {
      useSecureCookies: true,
      cookies: {
        sessionToken: {
          attributes: {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
          },
        },
      },
    },
    plugins: [nextCookies()],
  });

  const authInstance = asBetterAuthInstance(rawAuth);
  const authAdapter = new BetterAuthAdapter({ auth: authInstance, logger });
  const organizationRepository = new DrizzleOrganizationRepository({ db, logger });
  const planReader = new DrizzlePlanReader({ db, logger });
  const featureReader = new DrizzleFeatureReader({ db, logger });
  const userRepository = new DrizzleUserRepository({ db, logger });
  const membershipRepository = new DrizzleMembershipRepository({ db, logger });
  const websiteRepository = new DrizzleWebsiteRepository({ db, logger });
  const websiteCreationPersistence = new DrizzleWebsiteCreationPersistence({ db, logger });
  const pageRepository = new DrizzlePageRepository({ db, logger });
  const pagePublicationRepository = new DrizzlePagePublicationRepository({ db, logger });
  const superAdminStore = new DrizzleSuperAdminStore({ db, logger });
  const authorizationService = new AuthorizationService({
    membershipReader: membershipRepository,
    superAdminChecker: superAdminStore,
  });
  const eventPublisher = new OutboxEventPublisher({ db, logger });
  const organizationCreationPersistence = new DrizzleOrganizationCreationPersistence({ db, logger });
  const outboxProcessor = new DrizzleOutboxProcessor({
    db,
    logger,
    maxAttempts: config.outboxMaxAttempts,
    baseBackoffMs: config.outboxBaseBackoffMs,
    maxBackoffMs: config.outboxMaxBackoffMs,
  });
  const linkageReconciler = new LinkageReconciler({
    db,
    logger,
    userCreator: userRepository,
    userReader: userRepository,
    identityDisabler,
    idGenerator,
    clock,
    batchSize: config.linkageBatchSize,
    gracePeriodMs: config.linkageGracePeriodMs,
  });

  const createOrganizationDeps: CreateOrganizationDeps = {
    organizationRepository,
    planRepository: planReader,
    eventPublisher,
    clock,
    idGenerator,
    organizationCreationPersistence,
  };

  const registerUserDeps: RegisterUserDeps = {
    authenticationPort: authAdapter,
    userReader: userRepository,
    userCreator: userRepository,
    eventPublisher,
    clock,
    idGenerator,
    registrationMode,
  };

  const addOrganizationMemberDeps: AddOrganizationMemberDeps = {
    membershipRepository,
    userReader: userRepository,
    authorizationService,
    clock,
    idGenerator,
  };

  const changeOrganizationMemberRoleDeps: ChangeOrganizationMemberRoleDeps = {
    membershipRepository,
    authorizationService,
    clock,
  };

  const removeOrganizationMemberDeps: RemoveOrganizationMemberDeps = {
    membershipRepository,
    authorizationService,
    clock,
  };

  const getOrganizationMembersDeps: GetOrganizationMembersDeps = {
    membershipRepository,
    authorizationService,
  };

  const healthCheck = async () => {
    const details: Record<string, boolean> = {};
    let healthy = true;
    try {
      await db.execute("SELECT 1" as unknown as never);
      details.database = true;
    } catch {
      details.database = false;
      healthy = false;
    }
    details.authentication = true;
    details.userRepository = true;
    details.membershipRepository = true;
    details.planReader = true;
    details.featureReader = true;
    details.eventPublisher = true;
    details.outboxProcessor = true;
    return { healthy, details };
  };

  const close = async () => {
    await connection.close();
  };

  return {
    clock,
    idGenerator,
    logger,
    eventPublisher,
    organizationRepository,
    planReader,
    featureReader,
    userReader: userRepository,
    userCreator: userRepository,
    membershipRepository,
    websiteRepository,
    websiteCreationPersistence,
    pageRepository,
    pagePublisher: pagePublicationRepository,
    pageSnapshotReader: pagePublicationRepository,
    superAdminStore,
    authorizationService,
    authenticationPort: authAdapter,
    authInstance,
    emailVerificationPort: config.emailAdapter ?? null,
    passwordResetEmailPort: config.passwordResetEmailAdapter ?? null,
    organizationCreationPersistence,
    outboxProcessor,
    linkageReconciler,
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
    createWebsite,
    getWebsite,
    listOrganizationWebsites,
    createPage,
    getPage,
    listWebsitePages,
    updatePageDetails,
    archivePage,
    restorePage,
    addSection,
    updateSection,
    removeSection,
    duplicateSection,
    reorderSections,
    getPageBuilderState,
    publishPage,
    resolvePublishedPage,
    resolvePublishedWebsite,
    registrationMode,
    healthCheck,
    close,
  };
}

function requiredEnvironmentValue(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optionalPositiveInteger(key: string): number | undefined {
  const raw = process.env[key];
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function composeProductionFromEnvironment(): ProductionComposition {
  const betterAuthUrl = requiredEnvironmentValue("BETTER_AUTH_URL");
  const trustedOrigins = resolveTrustedOrigins(process.env, betterAuthUrl);

  return composeProduction({
    betterAuthSecret: requiredEnvironmentValue("BETTER_AUTH_SECRET"),
    betterAuthUrl,
    trustedOrigins,
    registrationMode: process.env.AUTH_REGISTRATION_MODE ?? "invite_only",
    emailVerificationEnabled: process.env.EMAIL_VERIFICATION_ENABLED === "true",
    linkageBatchSize: optionalPositiveInteger("LINKAGE_RECONCILIATION_BATCH_SIZE"),
    linkageGracePeriodMs: optionalPositiveInteger("LINKAGE_RECONCILIATION_GRACE_PERIOD_MS"),
    logLevel: "info",
  });
}

export function resolveTrustedOrigins(
  environment: NodeJS.ProcessEnv,
  betterAuthUrl: string,
): string[] {
  const candidates = [
    betterAuthUrl,
    ...(environment.TRUSTED_ORIGINS ?? "").split(","),
    environment.URL,
    environment.DEPLOY_PRIME_URL,
    environment.DEPLOY_URL,
  ];
  const origins = new Set<string>();

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value) continue;
    try {
      origins.add(new URL(value).origin);
    } catch {
      throw new Error(`Trusted origin is not a valid URL: ${value}`);
    }
  }

  return [...origins];
}
