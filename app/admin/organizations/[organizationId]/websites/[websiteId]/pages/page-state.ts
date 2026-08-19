export interface PageActionState { status: "idle" | "success" | "error"; message?: string; fieldErrors?: Partial<Record<"title" | "slug", string>> }
export const initialPageActionState: PageActionState = { status: "idle" };
