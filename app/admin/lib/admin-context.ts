import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import type { AuthSubjectId, Organization, OrganizationId, UserId } from "@livingsites/domain";
import {
  OrganizationPermissions,
  WebsitePermissions,
  type PermissionKey,
} from "@livingsites/application";
import { getAuth } from "@/app/lib/auth";
import { authPageRequest, evaluateAuthPageRequest } from "@/app/lib/auth-page-request";
import { getComposition } from "@/app/lib/composition";
import { adminNavigation } from "./navigation-config";

type SessionUser = { id: string; name: string; email: string; emailVerified: boolean; image?: string | null };

export type AuthenticatedAdminUser =
  | { kind: "redirect"; location: "/login" }
  | { kind: "unrecognized"; sessionUser: SessionUser }
  | { kind: "authenticated"; sessionUser: SessionUser; platformUser: { id: UserId; displayName: string; email: string } };

export async function getAuthenticatedAdminUser(pathname: string): Promise<AuthenticatedAdminUser> {
  const decision = await evaluateAuthPageRequest(authPageRequest(pathname, await headers()), getAuth());
  if (decision.kind === "redirect") return { kind: "redirect", location: decision.location as "/login" };

  const sessionUser = decision.session!.user as SessionUser;
  const composition = getComposition();
  let platformUser = await composition.userReader.findByAuthSubjectId(sessionUser.id as AuthSubjectId);
  if (!platformUser && sessionUser.email) platformUser = await composition.userReader.findByEmail(sessionUser.email);
  if (!platformUser) return { kind: "unrecognized", sessionUser };
  return { kind: "authenticated", sessionUser, platformUser };
}

export const getOrganizationAdminContext = cache(async (organizationIdValue: string) => {
  const pathname = `/admin/organizations/${organizationIdValue}`;
  const user = await getAuthenticatedAdminUser(pathname);
  if (user.kind !== "authenticated") return user;

  const composition = getComposition();
  const organizationId = organizationIdValue as OrganizationId;
  const access = await composition.authorizationService.can({
    userId: user.platformUser.id,
    organizationId,
    permission: OrganizationPermissions.Read,
  });
  if (!access.allowed) return { kind: "denied" as const, user, reason: access.reason };

  const organization = await composition.organizationRepository.findById(organizationId);
  if (!organization) return { kind: "denied" as const, user, reason: "Organization was not found." };

  const membership = await composition.membershipRepository.findForUserAndOrganization(organizationId, user.platformUser.id);
  const permissionEntries = await Promise.all(
    adminNavigation.map(async (item) => [item.permission, (await composition.authorizationService.can({
      userId: user.platformUser.id,
      organizationId,
      permission: item.permission,
    })).allowed] as const),
  );
  const createWebsite = await composition.authorizationService.can({
    userId: user.platformUser.id,
    organizationId,
    permission: WebsitePermissions.Create,
  });

  return {
    kind: "authorized" as const,
    sessionUser: user.sessionUser,
    platformUser: user.platformUser,
    organization,
    role: membership?.role ?? "Platform Super Admin",
    permissions: Object.fromEntries(permissionEntries) as Record<PermissionKey, boolean>,
    canCreateWebsite: createWebsite.allowed,
  };
});

export async function listUserOrganizations(userId: UserId): Promise<Array<{ organization: Organization; role: string }>> {
  const composition = getComposition();
  const memberships = await composition.membershipRepository.listForUser(userId);
  const organizationEntries = await Promise.all(memberships.map(async (membership) => {
    const organization = await composition.organizationRepository.findById(membership.organizationId);
    return organization ? { organization, role: String(membership.role) } : null;
  }));
  return organizationEntries.filter((entry): entry is { organization: Organization; role: string } => entry !== null);
}
