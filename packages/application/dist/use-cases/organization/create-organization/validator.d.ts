/**
 * Provider-independent input validation for CreateOrganization.
 *
 * Validates before policy evaluation and before any repository writes.
 * Returns typed errors on failure; does not throw.
 */
import type { CreateOrganizationInput } from "./input.js";
import type { InputValidationError } from "./errors.js";
export type ValidationResult = {
    ok: true;
    normalized: {
        name: string;
        slug: string;
        billingEmail: string;
    };
} | {
    ok: false;
    error: InputValidationError;
};
export declare function validateCreateOrganizationInput(input: CreateOrganizationInput): ValidationResult;
//# sourceMappingURL=validator.d.ts.map