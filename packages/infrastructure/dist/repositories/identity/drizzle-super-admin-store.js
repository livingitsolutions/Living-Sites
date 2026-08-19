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
import { createUserDraft } from "@livingsites/domain";
import { platformSuperAdmins } from "../../db/schema";
import { DrizzleUserRepository } from "../user/drizzle-user-repository";
function isDuplicateKeyError(error) {
    if (!error || typeof error !== "object")
        return false;
    const candidate = error;
    return candidate.code === "23505"
        || (candidate.cause !== undefined && isDuplicateKeyError(candidate.cause))
        || /duplicate key|unique constraint/i.test(candidate.message ?? "");
}
export class DrizzleSuperAdminStore {
    db;
    logger;
    userRepository;
    constructor(config) {
        this.db = config.db;
        this.logger = config.logger;
        this.userRepository = new DrizzleUserRepository({ db: config.db, logger: config.logger });
    }
    async isSuperAdmin(userId) {
        try {
            const rows = await this.db
                .select()
                .from(platformSuperAdmins)
                .where(eq(platformSuperAdmins.user_id, String(userId)));
            return rows.length > 0;
        }
        catch (err) {
            this.logger.error("Failed to check super admin status", { userId: String(userId), error: String(err) });
            return false;
        }
    }
    async isSuperAdminByEmail(email) {
        try {
            const normalized = email.trim().toLowerCase();
            const rows = await this.db
                .select()
                .from(platformSuperAdmins)
                .where(eq(platformSuperAdmins.email, normalized));
            return rows.length > 0;
        }
        catch (err) {
            this.logger.error("Failed to check super admin by email", { email, error: String(err) });
            return false;
        }
    }
    async listSuperAdmins() {
        return (await this.db.select().from(platformSuperAdmins));
    }
    async bootstrap(input) {
        const email = input.email?.trim().toLowerCase();
        if (!email || !email.includes("@")) {
            return {
                ok: false,
                error: { code: "invalid_input", message: "Valid email is required for super admin bootstrap." },
            };
        }
        try {
            return await this.db.transaction(async (transaction) => {
                const existingAdmins = await transaction.select().from(platformSuperAdmins);
                const existingAdmin = existingAdmins[0];
                const transactionalUserRepository = new DrizzleUserRepository({ db: transaction, logger: this.logger });
                if (existingAdmin) {
                    if (existingAdmin.email !== email) {
                        return {
                            ok: false,
                            error: {
                                code: "bootstrap_locked",
                                message: "Platform Super Admin has already been bootstrapped. Additional super admins cannot be bootstrapped.",
                            },
                        };
                    }
                    const user = await transactionalUserRepository.findById(existingAdmin.user_id);
                    if (!user) {
                        return {
                            ok: false,
                            error: { code: "persistence_error", message: "Bootstrapped super admin user record is missing." },
                        };
                    }
                    return { ok: true, value: { user, alreadyExisted: true } };
                }
                let user = await transactionalUserRepository.findByEmail(email);
                if (!user) {
                    const now = new Date().toISOString();
                    const draft = createUserDraft({
                        id: randomUUID(),
                        authSubjectId: randomUUID(),
                        email,
                        displayName: input.displayName ?? "Platform Super Admin",
                        now,
                    });
                    const createResult = await transactionalUserRepository.create(draft);
                    if (!createResult.ok) {
                        return {
                            ok: false,
                            error: { code: "persistence_error", message: `Failed to create platform user: ${createResult.error.message}` },
                        };
                    }
                    user = createResult.value;
                }
                await transaction.insert(platformSuperAdmins).values({
                    id: randomUUID(),
                    user_id: String(user.id),
                    email,
                    singleton_key: 1,
                    created_at: new Date(),
                    created_by: input.createdBy ?? "system_bootstrap",
                });
                this.logger.info("Platform Super Admin successfully bootstrapped", { email });
                return { ok: true, value: { user, alreadyExisted: false } };
            });
        }
        catch (err) {
            if (isDuplicateKeyError(err)) {
                const existingAdmins = await this.listSuperAdmins();
                const existingAdmin = existingAdmins[0];
                if (existingAdmin?.email === email) {
                    const user = await this.userRepository.findById(existingAdmin.user_id);
                    if (user)
                        return { ok: true, value: { user, alreadyExisted: true } };
                }
                return {
                    ok: false,
                    error: {
                        code: "bootstrap_locked",
                        message: "Platform Super Admin has already been bootstrapped. Additional super admins cannot be bootstrapped.",
                    },
                };
            }
            this.logger.error("Bootstrap super admin error", { error: String(err) });
            return {
                ok: false,
                error: { code: "persistence_error", message: `Bootstrap failed: ${String(err)}` },
            };
        }
    }
}
//# sourceMappingURL=drizzle-super-admin-store.js.map