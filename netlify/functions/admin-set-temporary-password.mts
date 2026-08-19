import { createHash, timingSafeEqual } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { composeProductionFromEnvironment } from "../../packages/composition/src/production";

const TARGET_EMAIL = "livingitsolutions@gmail.com";
const TOKEN_ENVIRONMENT_VARIABLE = "ADMIN_PASSWORD_CHANGE_TOKEN";
const MINIMUM_OPERATOR_TOKEN_LENGTH = 32;

interface VerifiedTarget {
  readonly authSubjectId: string;
  readonly credentialId: string;
}

export interface PasswordChangeTransaction {
  findVerifiedTarget(email: string): Promise<VerifiedTarget | null>;
  updateCredential(target: VerifiedTarget, passwordHash: string): Promise<boolean>;
  readCredentialHash(target: VerifiedTarget): Promise<string | null>;
  revokeSessions(authSubjectId: string): Promise<void>;
  countSessions(authSubjectId: string): Promise<number>;
}

export interface PasswordChangeStore {
  transaction<T>(operation: (transaction: PasswordChangeTransaction) => Promise<T>): Promise<T>;
}

export interface PasswordCapabilities {
  hash(password: string): Promise<string>;
  verify(input: { hash: string; password: string }): Promise<boolean>;
}

interface RuntimeResources {
  readonly store: PasswordChangeStore;
  close(): Promise<void>;
}

export interface AdminSetTemporaryPasswordDependencies {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly passwordCapabilities: PasswordCapabilities;
  createRuntimeResources(): RuntimeResources;
}

interface QueryResult<Row> {
  readonly rows?: Row[];
  readonly rowCount?: number;
  readonly length?: number;
  readonly [index: number]: Row;
}

interface VerificationRow {
  readonly auth_subject_id: string;
  readonly credential_id: string;
  readonly identity_count: number;
  readonly platform_user_count: number;
  readonly super_admin_count: number;
  readonly intended_super_admin_count: number;
  readonly credential_count: number;
}

class TargetVerificationError extends Error {}
class CredentialUpdateError extends Error {}
class PasswordVerificationError extends Error {}
class SessionRevocationError extends Error {}

function rowsOf<Row>(result: QueryResult<Row>): Row[] {
  if (Array.isArray(result)) return result;
  return result.rows ?? [];
}

function safeJson(status: number, body: Record<string, boolean>): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function authorized(request: Request, expectedToken: string | undefined): boolean {
  if (!expectedToken || expectedToken.length < MINIMUM_OPERATOR_TOKEN_LENGTH) return false;
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;

  const suppliedDigest = createHash("sha256").update(authorization.slice(7)).digest();
  const expectedDigest = createHash("sha256").update(expectedToken).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}

function createProductionStore(database: {
  transaction<T>(operation: (transaction: { execute(query: unknown): Promise<unknown> }) => Promise<T>): Promise<T>;
}): PasswordChangeStore {
  return {
    transaction<T>(operation: (transaction: PasswordChangeTransaction) => Promise<T>): Promise<T> {
      return database.transaction(async (databaseTransaction) => operation({
        async findVerifiedTarget(email) {
          const result = await databaseTransaction.execute(sql`
            SELECT
              identity.id AS auth_subject_id,
              credential.id AS credential_id,
              (SELECT count(*)::int FROM ba_user
                WHERE lower(email) = ${email} AND disabled = false) AS identity_count,
              (SELECT count(*)::int FROM platform_users
                WHERE lower(email) = ${email} AND status = 'active' AND deleted_at IS NULL) AS platform_user_count,
              (SELECT count(*)::int FROM platform_super_admins) AS super_admin_count,
              (SELECT count(*)::int
                 FROM platform_super_admins super_admin
                 JOIN platform_users platform_user ON platform_user.id = super_admin.user_id
                WHERE lower(super_admin.email) = ${email}
                  AND lower(platform_user.email) = ${email}
                  AND platform_user.status = 'active'
                  AND platform_user.deleted_at IS NULL) AS intended_super_admin_count,
              (SELECT count(*)::int
                 FROM ba_account account
                 JOIN ba_user account_identity ON account_identity.id = account.user_id
                WHERE lower(account_identity.email) = ${email}
                  AND account.provider_id = 'credential'
                  AND account.password IS NOT NULL) AS credential_count
            FROM ba_user identity
            JOIN platform_users platform_user ON platform_user.auth_subject_id = identity.id
            JOIN platform_super_admins super_admin ON super_admin.user_id = platform_user.id
            JOIN ba_account credential
              ON credential.user_id = identity.id
             AND credential.provider_id = 'credential'
             AND credential.password IS NOT NULL
            WHERE lower(identity.email) = ${email}
              AND lower(platform_user.email) = ${email}
              AND lower(super_admin.email) = ${email}
              AND identity.disabled = false
              AND platform_user.status = 'active'
              AND platform_user.deleted_at IS NULL
            FOR UPDATE OF identity, platform_user, super_admin, credential
          `) as QueryResult<VerificationRow>;
          const [row] = rowsOf(result);
          if (!row
            || row.identity_count !== 1
            || row.platform_user_count !== 1
            || row.super_admin_count !== 1
            || row.intended_super_admin_count !== 1
            || row.credential_count !== 1) {
            return null;
          }
          return {
            authSubjectId: row.auth_subject_id,
            credentialId: row.credential_id,
          };
        },
        async updateCredential(target, passwordHash) {
          const result = await databaseTransaction.execute(sql`
            UPDATE ba_account
            SET password = ${passwordHash}, updated_at = now()
            WHERE id = ${target.credentialId}
              AND user_id = ${target.authSubjectId}
              AND provider_id = 'credential'
            RETURNING id
          `) as QueryResult<{ readonly id: string }>;
          return rowsOf(result).length === 1;
        },
        async readCredentialHash(target) {
          const result = await databaseTransaction.execute(sql`
            SELECT password
            FROM ba_account
            WHERE id = ${target.credentialId}
              AND user_id = ${target.authSubjectId}
              AND provider_id = 'credential'
          `) as QueryResult<{ readonly password: string | null }>;
          return rowsOf(result)[0]?.password ?? null;
        },
        async revokeSessions(authSubjectId) {
          await databaseTransaction.execute(sql`
            DELETE FROM ba_session WHERE user_id = ${authSubjectId}
          `);
        },
        async countSessions(authSubjectId) {
          const result = await databaseTransaction.execute(sql`
            SELECT count(*)::int AS count
            FROM ba_session
            WHERE user_id = ${authSubjectId}
          `) as QueryResult<{ readonly count: number }>;
          return rowsOf(result)[0]?.count ?? -1;
        },
      }));
    },
  };
}

export const canonicalPasswordCapabilities: PasswordCapabilities = {
  hash: hashPassword,
  verify: verifyPassword,
};

export async function changeTemporaryPassword(
  store: PasswordChangeStore,
  passwordCapabilities: PasswordCapabilities,
  email: string,
  temporaryPassword: string,
): Promise<void> {
  await store.transaction(async (transaction) => {
    const target = await transaction.findVerifiedTarget(email);
    if (!target) throw new TargetVerificationError();

    const passwordHash = await passwordCapabilities.hash(temporaryPassword);
    if (!await transaction.updateCredential(target, passwordHash)) {
      throw new CredentialUpdateError();
    }

    const storedHash = await transaction.readCredentialHash(target);
    if (!storedHash || !await passwordCapabilities.verify({ hash: storedHash, password: temporaryPassword })) {
      throw new PasswordVerificationError();
    }

    await transaction.revokeSessions(target.authSubjectId);
    if (await transaction.countSessions(target.authSubjectId) !== 0) {
      throw new SessionRevocationError();
    }
  });
}

export function createAdminSetTemporaryPasswordHandler(
  dependencies: AdminSetTemporaryPasswordDependencies,
) {
  return async function adminSetTemporaryPassword(request: Request): Promise<Response> {
    if (request.method !== "POST") return safeJson(405, { ok: false });

    const operatorToken = dependencies.environment[TOKEN_ENVIRONMENT_VARIABLE];
    if (!operatorToken || operatorToken.length < MINIMUM_OPERATOR_TOKEN_LENGTH) {
      return safeJson(503, { ok: false });
    }
    if (!authorized(request, operatorToken)) return safeJson(401, { ok: false });

    let email: string;
    let temporaryPassword: string;
    try {
      const body = await request.json() as { email?: unknown; temporaryPassword?: unknown };
      if (typeof body.email !== "string"
        || typeof body.temporaryPassword !== "string"
        || body.temporaryPassword.length === 0) {
        return safeJson(400, { ok: false });
      }
      email = body.email.trim().toLowerCase();
      temporaryPassword = body.temporaryPassword;
    } catch {
      return safeJson(400, { ok: false });
    }

    if (email !== TARGET_EMAIL) return safeJson(403, { ok: false });

    let resources: RuntimeResources | undefined;
    try {
      resources = dependencies.createRuntimeResources();
      await changeTemporaryPassword(
        resources.store,
        dependencies.passwordCapabilities,
        email,
        temporaryPassword,
      );
      return safeJson(200, {
        ok: true,
        targetAccountVerified: true,
        platformSuperAdminVerified: true,
        credentialUpdated: true,
        passwordVerified: true,
        sessionsRevoked: true,
        removePasswordChangeToken: true,
      });
    } catch (error) {
      if (error instanceof TargetVerificationError) return safeJson(403, { ok: false });
      return safeJson(500, { ok: false });
    } finally {
      temporaryPassword = "";
      await resources?.close();
    }
  };
}

const handler = createAdminSetTemporaryPasswordHandler({
  environment: process.env,
  passwordCapabilities: canonicalPasswordCapabilities,
  createRuntimeResources() {
    const composition = composeProductionFromEnvironment();
    return {
      store: createProductionStore(composition.database),
      close: composition.close,
    };
  },
});

export default handler;
