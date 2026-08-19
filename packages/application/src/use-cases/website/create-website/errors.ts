export type CreateWebsiteError =
  | { readonly code: "input_validation"; readonly message: string; readonly field: string }
  | { readonly code: "unauthorized"; readonly message: string }
  | { readonly code: "organization_not_found"; readonly message: string }
  | { readonly code: "organization_inactive"; readonly message: string }
  | { readonly code: "plan_not_available"; readonly message: string }
  | { readonly code: "website_limit_exceeded"; readonly message: string; readonly limit: number }
  | { readonly code: "duplicate_slug"; readonly message: string; readonly slug: string }
  | { readonly code: "reserved_slug"; readonly message: string; readonly slug: string }
  | { readonly code: "persistence_unavailable"; readonly message: string }
  | { readonly code: "invalid_persistence_state"; readonly message: string };
