import type { CreateWebsiteInput } from "./input";
import type { CreateWebsiteError } from "./errors";
type ValidationError = Extract<CreateWebsiteError, {
    code: "input_validation";
}>;
export type CreateWebsiteValidationResult = {
    readonly ok: true;
    readonly value: CreateWebsiteInput & {
        organizationId: string;
        name: string;
        slug: string;
    };
} | {
    readonly ok: false;
    readonly error: ValidationError;
};
export declare function validateCreateWebsiteInput(input: CreateWebsiteInput): CreateWebsiteValidationResult;
export {};
//# sourceMappingURL=validator.d.ts.map