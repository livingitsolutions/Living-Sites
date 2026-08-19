import { PagePermissions } from "../../authorization/permissions.js";
import { proveWebsiteAccess } from "./shared.js";
export async function listWebsitePages(input, deps) {
    const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission: PagePermissions.Read }, deps);
    if (!access.ok)
        return access;
    return { ok: true, value: await deps.pageReader.listForWebsite(input.websiteId, input.status ? { status: input.status } : undefined) };
}
//# sourceMappingURL=list-website-pages.js.map