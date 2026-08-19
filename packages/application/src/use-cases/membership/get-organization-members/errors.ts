import type { PersistenceUnavailableError, InvalidPersistenceStateError } from "../../../contracts.js";

export type GetOrganizationMembersError =
  | { readonly code: "validation_error"; readonly message: string }
  | { readonly code: "unauthorized"; readonly message: string }
  | PersistenceUnavailableError
  | InvalidPersistenceStateError;
