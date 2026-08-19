export type SafeUrlKind = "link" | "image";
export type SafeUrlResult = {
    readonly ok: true;
    readonly value: string;
} | {
    readonly ok: false;
    readonly message: string;
};
export type SafeSectionPropsResult = {
    readonly ok: true;
    readonly value: Readonly<Record<string, unknown>>;
} | {
    readonly ok: false;
    readonly message: string;
};
export declare function validateSafeUrl(value: string, kind: SafeUrlKind): SafeUrlResult;
export declare function validateAndNormalizeSectionUrls(rendererKey: string, props: Readonly<Record<string, unknown>>): SafeSectionPropsResult;
//# sourceMappingURL=url-safety.d.ts.map