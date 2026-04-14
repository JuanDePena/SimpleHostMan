import { type SelectOption } from "./web-types.js";

export function summarizeGroupStatuses(items: Array<{ status?: string | null }>): string {
  const applied = items.filter((item) => item.status === "applied").length;
  const succeeded = items.filter((item) => item.status === "succeeded").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const queued = items.filter((item) => item.status === undefined || item.status === null).length;
  const running = items.filter((item) => item.status === "running").length;
  const parts = [
    applied > 0 ? `${applied} applied` : "",
    succeeded > 0 ? `${succeeded} succeeded` : "",
    failed > 0 ? `${failed} failed` : "",
    running > 0 ? `${running} running` : "",
    queued > 0 ? `${queued} queued` : ""
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "no outcomes";
}

export function createUniqueSelectOptions(
  values: Array<string | undefined | null>
): SelectOption[] {
  const uniqueValues = Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value && value.length > 0))
    )
  ).sort((left, right) => left.localeCompare(right));

  return uniqueValues.map((value) => ({ value, label: value }));
}

export function groupItemsBy<T>(
  items: T[],
  getKey: (item: T) => string
): Array<{ key: string; items: T[] }> {
  const groups = new Map<string, T[]>();

  items.forEach((item) => {
    const key = getKey(item).trim();

    if (!key) {
      return;
    }

    const existing = groups.get(key);

    if (existing) {
      existing.push(item);
      return;
    }

    groups.set(key, [item]);
  });

  return Array.from(groups.entries())
    .map(([key, groupedItems]) => ({
      key,
      items: groupedItems
    }))
    .sort(
      (left, right) => right.items.length - left.items.length || left.key.localeCompare(right.key)
    );
}
