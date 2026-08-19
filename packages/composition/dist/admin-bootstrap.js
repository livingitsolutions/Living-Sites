import { sql } from "drizzle-orm";
import { createMembershipDraft, createUserDraft } from "@livingsites/domain";
export class AdminBootstrapError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "AdminBootstrapError";
    }
}
function normalizedRows(result) {
    if (Array.isArray(result))
        return result;
    if (result && typeof result === "object" && "rows" in result) {
        return result.rows;
    }
    return [];
}
async function executeRows(database, query) {
    return normalizedRows(await database.execute(query));
}
function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function requiredText(value, field) {
    const normalized = value.trim();
    if (!normalized)
        throw new AdminBootstrapError("invalid_input", `${field} is required.`);
    return normalized;
}
function errorMessage(error) {
    if (error && typeof error === "object") {
        const candidate = error;
        return candidate.message ?? candidate.code ?? "Unknown persistence error";
    }
    return String(error);
}
export async function reconcileProductionAdministrator(input, composition, options = {}) {
    const email = input.email.trim().toLowerCase();
    if (!validEmail(email))
        throw new AdminBootstrapError("invalid_input", "A valid admin email is required.");
    const organizationName = requiredText(input.organizationName, "Organization name");
    const organizationSlug = requiredText(input.organizationSlug, "Organization slug").toLowerCase();
    const database = composition.database;
    const [identity] = await executeRows(database, sql `
    SELECT id, name FROM ba_user WHERE lower(email) = ${email} LIMIT 1
  `);
    let user = await composition.userReader.findByEmail(email);
    const displayName = input.displayName?.trim() || identity?.name || user?.displayName || "Platform Super Admin";
    if (!identity) {
        if (!options.createIdentity) {
            throw new AdminBootstrapError("identity_missing", "The Better Auth identity must already exist before production reconciliation.");
        }
        user = await options.createIdentity({ email, displayName });
    }
    else if (!user) {
        const draft = createUserDraft({
            id: composition.idGenerator.generatePrefixed("user"),
            authSubjectId: identity.id,
            email,
            displayName,
            now: composition.clock.nowIso(),
        });
        const created = await composition.userCreator.create(draft);
        if (!created.ok)
            throw new AdminBootstrapError("persistence_error", created.error.message);
        user = created.value;
    }
    if (!user)
        throw new AdminBootstrapError("persistence_error", "The intended Platform User could not be resolved.");
    const resolvedUser = user;
    await database.transaction(async (transaction) => {
        const identities = await executeRows(transaction, sql `
      UPDATE ba_user
      SET name = ${displayName}, email_verified = true, disabled = false, disabled_at = NULL, updated_at = now()
      WHERE id = ${String(resolvedUser.authSubjectId)} AND lower(email) = ${email}
      RETURNING id
    `);
        if (identities.length !== 1) {
            throw new AdminBootstrapError("persistence_error", "The intended Better Auth identity could not be reconciled.");
        }
        const users = await executeRows(transaction, sql `
      UPDATE platform_users
      SET display_name = ${displayName}, status = 'active', deleted_at = NULL, updated_at = now()
      WHERE id = ${String(resolvedUser.id)}
        AND auth_subject_id = ${String(resolvedUser.authSubjectId)}
        AND lower(email) = ${email}
      RETURNING id
    `);
        if (users.length !== 1) {
            throw new AdminBootstrapError("persistence_error", "The intended Platform User could not be reconciled.");
        }
        await transaction.execute(sql `
      INSERT INTO identity_linkages (
        id, auth_subject_id, email, display_name, status, platform_user_id,
        attempts, max_attempts, created_at, updated_at, completed_at
      ) VALUES (
        ${composition.idGenerator.generatePrefixed("linkage")}, ${String(resolvedUser.authSubjectId)}, ${email},
        ${displayName}, 'linked', ${String(resolvedUser.id)}, 0, 5, now(), now(), now()
      )
      ON CONFLICT (auth_subject_id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        status = 'linked',
        platform_user_id = EXCLUDED.platform_user_id,
        failure_reason = NULL,
        next_attempt_at = NULL,
        updated_at = now(),
        completed_at = now()
    `);
    });
    user = await composition.userReader.findByEmail(email);
    if (!user || user.status !== "active") {
        throw new AdminBootstrapError("verification_failed", "The Platform User is not active after reconciliation.");
    }
    const superAdmin = await composition.superAdminStore.bootstrap({
        email,
        displayName,
        createdBy: input.createdBy ?? "production_bootstrap_function",
    });
    if (!superAdmin.ok) {
        throw new AdminBootstrapError(superAdmin.error.code, superAdmin.error.message);
    }
    if (String(superAdmin.value.user.id) !== String(user.id)) {
        throw new AdminBootstrapError("bootstrap_locked", "The Platform Super Admin is linked to a different Platform User.");
    }
    let organization = await composition.organizationRepository.findBySlug(organizationSlug);
    if (!organization) {
        const created = await composition.createOrganization({
            name: organizationName,
            slug: organizationSlug,
            billingEmail: email,
        }, composition.createOrganizationDeps);
        if (!created.ok)
            throw new AdminBootstrapError("persistence_error", created.error.message);
        organization = created.value.organization;
    }
    await database.execute(sql `
    UPDATE organizations
    SET name = ${organizationName}, billing_email = ${email}, status = 'active', deleted_at = NULL, updated_at = now()
    WHERE id = ${String(organization.id)} AND slug = ${organizationSlug}
  `);
    organization = await composition.organizationRepository.findBySlug(organizationSlug);
    if (!organization || organization.status !== "active") {
        throw new AdminBootstrapError("verification_failed", "The bootstrap organization is not active after reconciliation.");
    }
    let membership = await composition.membershipRepository.findForUserAndOrganization(organization.id, user.id);
    if (!membership) {
        const draft = createMembershipDraft({
            id: composition.idGenerator.generatePrefixed("membership"),
            organizationId: organization.id,
            userId: user.id,
            role: "owner",
            now: composition.clock.nowIso(),
            createdBy: user.id,
        });
        const created = await composition.membershipRepository.create(draft);
        if (!created.ok)
            throw new AdminBootstrapError("persistence_error", created.error.message);
        membership = created.value;
    }
    else if (String(membership.role).toLowerCase() !== "owner") {
        const changed = await composition.membershipRepository.changeRole(membership.id, "owner", membership.version);
        if (!changed.ok)
            throw new AdminBootstrapError("persistence_error", errorMessage(changed.error));
        membership = changed.value;
    }
    const [verification] = await executeRows(database, sql `
    SELECT
      (SELECT count(*)::int FROM ba_user
        WHERE id = ${String(user.authSubjectId)} AND lower(email) = ${email}
          AND disabled = false AND email_verified = true) AS identity_count,
      (SELECT count(*)::int FROM ba_account
        WHERE user_id = ${String(user.authSubjectId)} AND provider_id = 'credential'
          AND password IS NOT NULL) AS credential_count,
      (SELECT count(*)::int FROM platform_users
        WHERE id = ${String(user.id)} AND auth_subject_id = ${String(user.authSubjectId)}
          AND lower(email) = ${email} AND status = 'active' AND deleted_at IS NULL) AS platform_user_count,
      (SELECT count(*)::int FROM platform_super_admins) AS super_admin_count,
      (SELECT count(*)::int FROM platform_super_admins
        WHERE user_id = ${String(user.id)} AND lower(email) = ${email}) AS intended_super_admin_count,
      (SELECT count(*)::int FROM organizations
        WHERE id = ${String(organization.id)} AND slug = ${organizationSlug}
          AND name = ${organizationName} AND status = 'active' AND deleted_at IS NULL) AS organization_count,
      (SELECT count(*)::int FROM memberships
        WHERE organization_id = ${String(organization.id)} AND user_id = ${String(user.id)}
          AND website_scope_id IS NULL AND status = 'active' AND deleted_at IS NULL AND role = 'owner') AS owner_membership_count,
      (SELECT id FROM platform_super_admins
        WHERE user_id = ${String(user.id)} AND lower(email) = ${email} LIMIT 1) AS super_admin_id,
      (SELECT id FROM memberships
        WHERE organization_id = ${String(organization.id)} AND user_id = ${String(user.id)}
          AND website_scope_id IS NULL AND status = 'active' AND deleted_at IS NULL AND role = 'owner' LIMIT 1) AS membership_id
  `);
    if (!verification
        || verification.identity_count !== 1
        || verification.credential_count < 1
        || verification.platform_user_count !== 1
        || verification.super_admin_count !== 1
        || verification.intended_super_admin_count !== 1
        || verification.organization_count !== 1
        || verification.owner_membership_count !== 1
        || !verification.super_admin_id
        || !verification.membership_id) {
        throw new AdminBootstrapError("verification_failed", "Bootstrap database verification failed.");
    }
    return {
        betterAuthIdentity: { id: String(user.authSubjectId), status: "active", verified: true },
        platformUser: { id: String(user.id), status: "active" },
        platformSuperAdmin: { id: verification.super_admin_id, status: "active", singleton: true },
        organization: { id: String(organization.id), status: "active" },
        ownerMembership: { id: verification.membership_id, status: "active", role: "owner" },
        alreadyReconciled: superAdmin.value.alreadyExisted && membership.id === verification.membership_id,
    };
}
//# sourceMappingURL=admin-bootstrap.js.map