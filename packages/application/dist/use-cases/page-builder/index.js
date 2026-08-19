import { PageStatus } from "@livingsites/domain";
import { PagePermissions } from "../../authorization/permissions";
import { SECTION_TYPES, getSectionType, validateSectionProps } from "../../section-types";
import { proveWebsiteAccess } from "../page/shared";
async function loadPage(input, deps, permission) {
    const access = await proveWebsiteAccess({ ...input, userId: deps.authenticatedUser.userId, permission }, deps);
    if (!access.ok)
        return access;
    const page = await deps.pageReader.findById(input.pageId);
    if (!page || page.websiteId !== input.websiteId)
        return { ok: false, error: { code: "not_found", message: "Page was not found in this Website." } };
    if (permission === PagePermissions.Update && page.status === PageStatus.Archived)
        return { ok: false, error: { code: "draft_only", message: "Archived Pages cannot be edited in the builder." } };
    return { ok: true, value: page };
}
async function persist(page, sections, input, deps) {
    const saved = await deps.pageMutationPersistence.saveBuilder({ pageId: page.id, sections, expectedVersion: input.expectedVersion, updatedAt: deps.clock.nowIso(), updatedBy: String(deps.authenticatedUser.userId) });
    if (!saved.ok)
        return { ok: false, error: { code: "expectedVersion" in saved.error ? "concurrency_conflict" : "persistence_error", message: "expectedVersion" in saved.error ? "This Page changed in another session. Reload before trying again." : saved.error.message } };
    return { ok: true, value: { page: saved.value, sections: saved.value.sections, sectionTypes: SECTION_TYPES, canEdit: true } };
}
export async function getPageBuilderState(input, deps) {
    const loaded = await loadPage(input, deps, PagePermissions.Read);
    if (!loaded.ok)
        return loaded;
    const editDecision = await deps.authorizationService.can({ userId: deps.authenticatedUser.userId, organizationId: input.organizationId, websiteId: input.websiteId, permission: PagePermissions.Update });
    return { ok: true, value: { page: loaded.value, sections: loaded.value.sections, sectionTypes: SECTION_TYPES, canEdit: editDecision.allowed && loaded.value.status !== PageStatus.Archived } };
}
export async function addSection(input, deps) {
    const loaded = await loadPage(input, deps, PagePermissions.Update);
    if (!loaded.ok)
        return loaded;
    const type = getSectionType(input.sectionTypeKey);
    if (!type)
        return { ok: false, error: { code: "invalid_section_type", message: "The requested SectionType is not registered." } };
    const props = input.props ?? type.defaultProps;
    const validated = validateSectionProps(type, props);
    if (!validated.ok)
        return { ok: false, error: { code: "invalid_props", message: validated.errors.join(" ") } };
    const now = deps.clock.nowIso();
    const section = { id: deps.idGenerator.generatePrefixed("section"), pageId: loaded.value.id, websiteId: loaded.value.websiteId, sectionTypeId: type.id, props: validated.value, sortOrder: loaded.value.sections.length, status: "active", audit: { createdAt: now, updatedAt: now, createdBy: deps.authenticatedUser.userId, updatedBy: deps.authenticatedUser.userId } };
    return persist(loaded.value, [...loaded.value.sections, section], input, deps);
}
export async function updateSection(input, deps) {
    const loaded = await loadPage(input, deps, PagePermissions.Update);
    if (!loaded.ok)
        return loaded;
    const section = loaded.value.sections.find((candidate) => candidate.id === input.sectionId);
    if (!section)
        return { ok: false, error: { code: "cross_page_section", message: "Section does not belong to this Page." } };
    const type = getSectionType(String(section.sectionTypeId));
    if (!type)
        return { ok: false, error: { code: "invalid_section_type", message: "Section references an unregistered SectionType." } };
    const validated = validateSectionProps(type, input.props);
    if (!validated.ok)
        return { ok: false, error: { code: "invalid_props", message: validated.errors.join(" ") } };
    const sections = loaded.value.sections.map((candidate) => candidate.id === section.id ? { ...candidate, props: validated.value, audit: { ...candidate.audit, updatedAt: deps.clock.nowIso(), updatedBy: deps.authenticatedUser.userId } } : candidate);
    return persist(loaded.value, sections, input, deps);
}
export async function removeSection(input, deps) {
    const loaded = await loadPage(input, deps, PagePermissions.Update);
    if (!loaded.ok)
        return loaded;
    if (!loaded.value.sections.some((section) => section.id === input.sectionId))
        return { ok: false, error: { code: "cross_page_section", message: "Section does not belong to this Page." } };
    return persist(loaded.value, loaded.value.sections.filter((section) => section.id !== input.sectionId), input, deps);
}
export async function duplicateSection(input, deps) {
    const loaded = await loadPage(input, deps, PagePermissions.Update);
    if (!loaded.ok)
        return loaded;
    const index = loaded.value.sections.findIndex((section) => section.id === input.sectionId);
    if (index < 0)
        return { ok: false, error: { code: "cross_page_section", message: "Section does not belong to this Page." } };
    const original = loaded.value.sections[index];
    const now = deps.clock.nowIso();
    const duplicate = { ...original, id: deps.idGenerator.generatePrefixed("section"), props: structuredClone(original.props), audit: { createdAt: now, updatedAt: now, createdBy: deps.authenticatedUser.userId, updatedBy: deps.authenticatedUser.userId } };
    const sections = [...loaded.value.sections];
    sections.splice(index + 1, 0, duplicate);
    return persist(loaded.value, sections, input, deps);
}
export async function reorderSections(input, deps) {
    const loaded = await loadPage(input, deps, PagePermissions.Update);
    if (!loaded.ok)
        return loaded;
    const existing = new Set(loaded.value.sections.map((section) => String(section.id)));
    const proposed = new Set(input.sectionIds.map(String));
    if (existing.size !== proposed.size || input.sectionIds.length !== proposed.size || [...existing].some((id) => !proposed.has(id)))
        return { ok: false, error: { code: "invalid_order", message: "Reorder must contain every Page Section exactly once." } };
    const byId = new Map(loaded.value.sections.map((section) => [String(section.id), section]));
    return persist(loaded.value, input.sectionIds.map((id, index) => ({ ...byId.get(String(id)), sortOrder: index })), input, deps);
}
//# sourceMappingURL=index.js.map