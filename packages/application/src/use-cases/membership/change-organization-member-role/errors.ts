import type { ConcurrencyConflict, PersistenceUnavailableError, InvalidPersistenceStateError } from "../../../contracts";

export type ChangeOrganizationMemberRoleError =
  | { readonly code: "validation_error"; readonly message: string }
  | { readonly code: "unauthorized"; readonly message: string }
  | { readonly code: "membership_not_found"; readonly message: string; readonly membershipId: string }
  | { readonly code: "cannot_demote_sole_owner"; readonly message: string; readonly organizationId: string }
  | ConcurrencyConflict
  | PersistenceUnavailableError
  | InvalidPersistenceStateError;
