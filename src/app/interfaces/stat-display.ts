import type { Icon } from '@interfaces/artable';

// Display order, friendly labels, icons, and which keys are percentages
// (vs a flat number like `agroValue`).
export type StatDisplayDimension<K extends string = string> = {
  order: K[];
  label: Record<K, string>;
  icon: Record<K, Icon>;
  // Omitted (or a key missing from the map) defaults to percent - true for
  // every dimension shipped so far except `agroValue`.
  isPercent?: Record<K, boolean>;
};
