export type DesiredStatePillTone = "default" | "success" | "danger" | "muted";
export type DesiredStateRelatedPanelTone = "default" | "success" | "danger";
export type DesiredStateComparisonState = "match" | "changed" | "unknown";

export type DesiredStateRelatedPanelItem = {
  title: string;
  meta?: string;
  summary?: string;
  tone?: DesiredStateRelatedPanelTone;
};

export type DesiredStateComparisonRow = {
  field: string;
  desiredValue: string;
  appliedValue: string;
  state: DesiredStateComparisonState;
};

export type DesiredStateSelectOption = {
  value: string;
  label: string;
};

export type DesiredStateDetailGridRenderer = (
  entries: Array<{ label: string; value: string; className?: string }>,
  options?: { className?: string }
) => string;

export type DesiredStateRelatedPanelRenderer<
  Item extends DesiredStateRelatedPanelItem = DesiredStateRelatedPanelItem
> = (
  title: string,
  description: string | undefined,
  items: Item[],
  emptyMessage: string
) => string;

export type DesiredStateActionFactsRenderer = (
  rows: Array<{ label: string; value: string }>,
  options?: { className?: string }
) => string;

export type DesiredStateActionFormRenderer = (
  action: string,
  hiddenFields: Record<string, string>,
  label: string,
  options?: { confirmMessage?: string }
) => string;

export type DesiredStateComparisonTableRenderer<
  Row extends DesiredStateComparisonRow = DesiredStateComparisonRow
> = (title: string, description: string, rows: Row[]) => string;

export type DesiredStateComparisonDeltaItemsRenderer<
  Row extends DesiredStateComparisonRow = DesiredStateComparisonRow,
  Item extends DesiredStateRelatedPanelItem = DesiredStateRelatedPanelItem
> = (rows: Row[], limit?: number) => Item[];

export type DesiredStateSelectOptionsRenderer = (
  options: DesiredStateSelectOption[],
  selectedValue: string | undefined,
  optionsConfig?: {
    allowBlank?: boolean;
    blankLabel?: string;
  }
) => string;

export type DesiredStatePillRenderer = (
  value: string,
  tone?: DesiredStatePillTone
) => string;
