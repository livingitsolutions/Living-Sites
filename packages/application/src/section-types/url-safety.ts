export type SafeUrlKind = "link" | "image";

export type SafeUrlResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly message: string };

export type SafeSectionPropsResult =
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly message: string };

const forbiddenScheme = /^(?:javascript|data|vbscript)\s*:/i;
const explicitScheme = /^[a-z][a-z0-9+.-]*\s*:/i;

export function validateSafeUrl(value: string, kind: SafeUrlKind): SafeUrlResult {
  const normalized = value.trim();
  if (!normalized) return { ok: true, value: "" };
  if (forbiddenScheme.test(normalized)) return { ok: false, message: `${kind} URL uses a forbidden scheme.` };

  if (kind === "link" && ((normalized.startsWith("/") && !normalized.startsWith("//")) || normalized.startsWith("#"))) {
    return { ok: true, value: normalized };
  }
  if (kind === "image" && normalized.startsWith("/") && !normalized.startsWith("//")) return { ok: true, value: normalized };

  if (!explicitScheme.test(normalized)) return { ok: false, message: `${kind} URL must use an approved absolute scheme or safe relative form.` };

  try {
    const parsed = new URL(normalized);
    const protocol = parsed.protocol.toLowerCase();
    const allowed = kind === "link" ? ["https:", "mailto:", "tel:"] : ["https:"];
    if (!allowed.includes(protocol)) return { ok: false, message: `${kind} URL scheme "${protocol}" is not allowed.` };
    return { ok: true, value: parsed.toString() };
  } catch {
    return { ok: false, message: `${kind} URL is invalid.` };
  }
}

const urlFieldsByRenderer: Readonly<Record<string, Readonly<Record<string, SafeUrlKind>>>> = {
  hero: { ctaUrl: "link" },
  image: { imageUrl: "image" },
  gallery: { "images[].imageUrl": "image" },
  cta: { url: "link" },
};

export function validateAndNormalizeSectionUrls(
  rendererKey: string,
  props: Readonly<Record<string, unknown>>,
): SafeSectionPropsResult {
  const fields = urlFieldsByRenderer[rendererKey];
  if (!fields) return { ok: true, value: props };
  const normalized = structuredClone(props) as Record<string, unknown>;

  for (const [path, kind] of Object.entries(fields)) {
    if (path.includes("[]")) {
      const [listKey, itemKey] = path.split("[].");
      const list = normalized[listKey!];
      if (!Array.isArray(list)) continue;
      for (let index = 0; index < list.length; index += 1) {
        const item = list[index];
        if (!item || typeof item !== "object" || Array.isArray(item)) continue;
        const record = item as Record<string, unknown>;
        const value = record[itemKey!];
        if (typeof value !== "string") continue;
        const result = validateSafeUrl(value, kind);
        if (!result.ok) return { ok: false, message: `props.${listKey}[${index}].${itemKey}: ${result.message}` };
        record[itemKey!] = result.value;
      }
      continue;
    }

    const value = normalized[path];
    if (typeof value !== "string") continue;
    const result = validateSafeUrl(value, kind);
    if (!result.ok) return { ok: false, message: `props.${path}: ${result.message}` };
    normalized[path] = result.value;
  }

  return { ok: true, value: normalized };
}
