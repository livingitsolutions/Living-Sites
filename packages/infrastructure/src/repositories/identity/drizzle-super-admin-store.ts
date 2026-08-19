/**
 * Platform Super Admin store and bootstrap capability.
 *
 * Implements PlatformSuperAdminChecker and handles idempotent bootstrap
 * of the initial Platform Super Admin from explicit configuration/environment.
 *
 * Guarantees:
 * - No hardcoded emails
 * - Atomic & idempotent
 * - Cannot accidentally create multiple initial super admins
 * - Safe to repeat
 */
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Logger } from "@livingsites/platform";
import type {
  User,
  UserId,
  AuthSubjectId,
  ISODateString,
} from "@livingsites/domain";
import { createUserDraft } from "@livingsites/domain";
import type { Result } from "@livingsites/domain";
import type { PlatformSuperAdminChecker } from "@livingsites/application";
import type { DrizzleDB } from "../../db/drizzle-instance";
import { platformSuperAdmins, type PlatformSuperAdminRow } from "../../db/schema";
import { DrizzleUserRepository } from "../user/drizzle-user-repository";

export interface BootstrapSuperAdminInput {
  readonly email: string;
  readonly displayName?: string;
  readonly createdBy?: string;
}

export interface BootstrapSuperAdminOutput {
  readonly user: User;
  readonly alreadyExisted: boolean;
}

export type BootstrapSuperAdminError =
  | { readonly code: "invalid_input"; readonly message: string }
  | { readonly code: "bootstrap_locked"; readonly message: string }
  | { readonly code: "persistence_error"; readonly message: string };

export class DrizzleSuperAdminStore implements PlatformSuperAdminChecker {
  private readonly db: DrizzleDB;
  private readonly logger: Logger;
  private readonly userRepository: DrizzleUserRepository;

  constructor(config: { db: DrizzleDB; logger: Logger }) {
    this.db = config.db;
    this.logger = config.logger;
    this.userRepository = new DrizzleUserRepository({ db: config.db, logger: config.logger });
  }

  async isSuperAdmin(userId: UserId): Promise<boolean> {
    try {
      const rows = await this.db
        .select()
        .from(platformSuperAdmins)
        .where(eq(platformSuperAdmins.user_id, String(userId)));
      return rows.length > 0;
    } catch (err) {
      this.logger.error("Failed to check super admin status", { userId: String(userId), error: String(err) });
      return false;
    }
  }

  async isSuperAdminByEmail(email: string): Promise<boolean> {
    try {
      const normalized = email.trim().toLowerCase();
      const rows = await this.db
        .select()
        .from(platformSuperAdmins)
        .where(eq(platformSuperAdmins.email, normalized));
      return rows.length > 0;
    } catch (err) {
      this.logger.error("Failed to check super admin by email", { email, error: String(err) });
      return false;
    }
  }

  async listSuperAdmins(): Promise<PlatformSuperAdminRow[]> {
    return (await this.db.select().from(platformSuperAdmins)) as PlatformSuperAdminRow[];
  }

  async bootstrap(
    input: BootstrapSuperAdminInput,
  ): Promise<Result<BootstrapSuperAdminOutput, BootstrapSuperAdminError>> {
    const email = input.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return {
        ok: false,
        error: { code: "invalid_input", message: "Valid email is required for super admin bootstrap." },
      };
    }

    try {
      // Check if any super admin exists
      const existingAdmins = await this.listSuperAdmins();
      const alreadyAdmin = existingAdmins.find((a) => a.email === email);

      if (alreadyAdmin) {
        const user = await this.userRepository.findById(alreadyAdmin.user_id as UserId);
        if (user) {
          return { ok: true, value: { user, alreadyExisted: true } };
        }
      }

      if (existingAdmins.length > 0 && !alreadyAdmin) {
        return {
          ok: false,
          error: {
            code: "bootstrap_locked",
            message: "Platform Super Admin has already been bootstrapped. Additional super admins cannot be bootstrapped.",
          },
        };
      }

      // Find or create platform user for this email
      let user = await this.userRepository.findByEmail(email);
      if (!user) {
        const now = new Date().toISOString() as ISODateString;
        const userId = randomUUID() as UserId;
        const authSubjectId = randomUUID() as AuthSubjectId;
        const draft = createUserDraft({
          id: userId,
          authSubjectId,
          email,
          displayName: input.displayName ?? "Platform Super Admin",
          now,
        });

        const createResult = await this.userRepository.create(draft);
        if (!createResult.ok) {
          return {
            ok: false,
            error: { code: "persistence_error", message: `Failed to create platform user: ${createResult.error.message}` },
          };
        }
        user = createResult.value;
      }

      // Record in platform_super_admins
      await this.db.insert(platformSuperAdmins).values({
        id: randomUUID(),
        user_id: String(user.id),
        email,
        created_at: new Date(),
        created_by: input.createdBy ?? "system_bootstrap",
      });

      this.logger.info("Platform Super Admin successfully bootstrapped", { email });

      return {
        ok: true,
        value: { user, alreadyExisted: false },
      };
    } catch (err) {
      this.logger.error("Bootstrap super admin error", { error: String(err) });
      return {
        ok: false,
        error: { code: "persistence_error", message: `Bootstrap failed: ${String(err)}` },
      };
    }
  }
}
