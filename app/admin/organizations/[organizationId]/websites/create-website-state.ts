export interface CreateWebsiteState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "slug", string>>;
}

export const initialCreateWebsiteState: CreateWebsiteState = { status: "idle" };
