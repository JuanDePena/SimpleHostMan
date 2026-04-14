export type PillTone = "default" | "success" | "danger" | "muted";

export interface SelectOption {
  value: string;
  label: string;
}

export interface WorkspaceFilterField {
  name: string;
  label: string;
  value?: string;
  type?: "select" | "search";
  options?: SelectOption[];
  placeholder?: string;
}
