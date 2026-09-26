import type { CostItem, ItemId, ItemQuantity } from '@interfaces';

// Shared by every content type that gates a purchase/upgrade behind spending
// materials (gather node development, shrine development, etc).
export function ensureCostItem(item: Partial<CostItem> = {}): CostItem {
  return {
    itemId: item.itemId ?? ('UNKNOWN' as ItemId),
    required: item.required ?? 0,
  };
}

export function ensureItemQuantity(
  item: Partial<ItemQuantity> = {},
): ItemQuantity {
  return {
    itemId: item.itemId ?? ('UNKNOWN' as ItemId),
    quantity: item.quantity ?? 1,
  };
}

// `ensureItemFn` is typed with `any` so every concrete `ensure*` helper can
// keep its own narrow `Partial<...>` (or union-of-partials) parameter type
// without fighting function parameter variance here.
export function ensureArray<T>(
  items: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ensureItemFn: (item: any) => T,
): T[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ensureItemFn(item ?? {}));
}

export function ensureEnumArray<T extends string>(
  items: unknown,
  validValues: readonly T[],
): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is T => validValues.includes(item as T));
}

export function ensureEnumValue<T extends string>(
  value: unknown,
  validValues: readonly T[],
  fallback: T,
): T {
  return validValues.includes(value as T) ? (value as T) : fallback;
}
