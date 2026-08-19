import type { SectionType } from "@livingsites/domain";
export declare const SECTION_TYPES: readonly SectionType[];
export declare function getSectionType(keyOrId: string): SectionType | null;
export declare function validateSectionProps(type: SectionType, props: unknown): {
    readonly ok: true;
    readonly value: Readonly<Record<string, unknown>>;
} | {
    readonly ok: false;
    readonly errors: readonly string[];
};
//# sourceMappingURL=registry.d.ts.map