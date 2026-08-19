import type { CreateWebsiteInput } from "./input";
import type { CreateWebsiteError } from "./errors";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type ValidationError = Extract<CreateWebsiteError, { code: "input_validation" }>;
export type CreateWebsiteValidationResult =
  | { readonly ok: true; readonly value: CreateWebsiteInput & { organizationId: string; name: string; slug: string } }
  | { readonly ok: false; readonly error: ValidationError };

export function validateCreateWebsiteInput(input: CreateWebsiteInput): CreateWebsiteValidationResult {
  const organizationId = String(input.organizationId).trim();
  if (!organizationId) return { ok: false, error: { code: "input_validation", message: "Organization is required.", field: "organizationId" } };
  const name = input.name.trim();
  if (!name || name.length > 200) return { ok: false, error: { code: "input_validation", message: "Name must contain 1 to 200 characters.", field: "name" } };
  const slug = input.slug.trim().toLowerCase();
  if (slug.length < 2 || slug.length > 63 || !SLUG_PATTERN.test(slug)) {
    return { ok: false, error: { code: "input_validation", message: "Slug must be 2 to 63 lowercase alphanumeric characters with single dashes.", field: "slug" } };
  }
  return { ok: true, value: { ...input, organizationId, name, slug } };
}
