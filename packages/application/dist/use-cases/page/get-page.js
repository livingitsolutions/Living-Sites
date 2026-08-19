import { PagePermissions } from "../../authorization/permissions";
import { proveWebsiteAccess } from "./shared";
export async function getPage(input, deps) {
    const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission: PagePermissions.Read }, deps);
    if (!access.ok)
        return access;
    const page = await deps.pageReader.findById(input.pageId);
    return page && page.websiteId === input.websiteId ? { ok: true, value: page } : { ok: false, error: { code: "not_found", message: "Page was not found in this Website." } };
}
//# sourceMappingURL=get-page.js.map