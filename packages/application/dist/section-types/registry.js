const text = (maxLength) => ({ type: "string", maxLength });
const object = (required, properties) => ({ type: "object", required, properties, additionalProperties: false });
const definitions = [
    ["hero", "Hero", "layout", object(["headline", "subheading", "ctaLabel", "ctaUrl"], { headline: text(160), subheading: text(500), ctaLabel: text(80), ctaUrl: text(2048) }), { headline: "Build something remarkable", subheading: "Introduce this page with a clear, confident message.", ctaLabel: "Get started", ctaUrl: "#" }],
    ["rich-text", "Rich Text", "content", object(["heading", "body"], { heading: text(160), body: text(10000) }), { heading: "Section heading", body: "Add clear, useful copy here." }],
    ["image", "Image", "media", object(["imageUrl", "alt", "caption"], { imageUrl: text(2048), alt: text(300), caption: text(500) }), { imageUrl: "", alt: "", caption: "" }],
    ["services", "Services", "content", object(["heading", "items"], { heading: text(160), items: { type: "array", maxItems: 12, items: object(["title", "description"], { title: text(120), description: text(500) }) } }), { heading: "Our services", items: [{ title: "Service one", description: "Describe the value this service provides." }] }],
    ["gallery", "Gallery", "media", object(["heading", "images"], { heading: text(160), images: { type: "array", maxItems: 12, items: object(["imageUrl", "alt"], { imageUrl: text(2048), alt: text(300) }) } }), { heading: "Gallery", images: [{ imageUrl: "", alt: "" }] }],
    ["cta", "CTA", "interactive", object(["heading", "body", "buttonLabel", "url"], { heading: text(160), body: text(1000), buttonLabel: text(80), url: text(2048) }), { heading: "Ready to begin?", body: "Give visitors one clear next step.", buttonLabel: "Contact us", url: "#" }],
];
const audit = { createdAt: "2026-08-19T00:00:00.000Z", updatedAt: "2026-08-19T00:00:00.000Z" };
export const SECTION_TYPES = definitions.map(([key, name, category, propsSchema, defaultProps]) => ({ id: `section-type:${key}`, key: key, name, releaseVersion: "1.0.0", category, propsSchema, defaultProps, rendererKey: key, allowMultiple: true, renderWithoutTheme: true, isSystem: true, isActive: true, version: 1, audit }));
export function getSectionType(keyOrId) {
    return SECTION_TYPES.find((type) => type.key === keyOrId || type.id === keyOrId) ?? null;
}
function validateObject(schema, value, path = "props") {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return [`${path} must be an object.`];
    const record = value;
    const errors = schema.required.filter((key) => !(key in record)).map((key) => `${path}.${key} is required.`);
    for (const key of Object.keys(record))
        if (!(key in schema.properties))
            errors.push(`${path}.${key} is not supported.`);
    for (const [key, field] of Object.entries(schema.properties)) {
        if (!(key in record))
            continue;
        const item = record[key];
        if (field.type === "string") {
            if (typeof item !== "string")
                errors.push(`${path}.${key} must be text.`);
            else if (field.maxLength && item.length > field.maxLength)
                errors.push(`${path}.${key} is too long.`);
        }
        else if (!Array.isArray(item))
            errors.push(`${path}.${key} must be a list.`);
        else {
            if (field.maxItems && item.length > field.maxItems)
                errors.push(`${path}.${key} has too many items.`);
            item.forEach((entry, index) => errors.push(...validateObject(field.items, entry, `${path}.${key}[${index}]`)));
        }
    }
    return errors;
}
export function validateSectionProps(type, props) {
    const errors = validateObject(type.propsSchema, props);
    return errors.length ? { ok: false, errors } : { ok: true, value: props };
}
//# sourceMappingURL=registry.js.map