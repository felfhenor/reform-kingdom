import { defaultEquipment } from '@helpers/defaults';
import type { EquipmentSlot } from '@interfaces';
import { EquipmentTypeToSlot } from '@interfaces';

import { sortBy, uniqBy } from 'es-toolkit/compat';

export function equipmentSlotOrder(): EquipmentSlot[] {
  return Object.keys(defaultEquipment()) as EquipmentSlot[];
}

// Order-independent, so two types filling the same slots in a different order count as one pattern.
export function equipmentSlotsKey(slots: EquipmentSlot[]): string {
  const order = equipmentSlotOrder();
  return sortBy(slots, (slot) => order.indexOf(slot)).join('+');
}

export function equipmentSlotPatterns(): EquipmentSlot[][] {
  return uniqBy(Object.values(EquipmentTypeToSlot), equipmentSlotsKey);
}

function linkedSlots(
  start: EquipmentSlot,
  patterns: EquipmentSlot[][],
): Set<EquipmentSlot> {
  const linked = new Set<EquipmentSlot>([start]);
  let size = 0;
  while (linked.size !== size) {
    size = linked.size;
    patterns
      .filter((pattern) => pattern.some((slot) => linked.has(slot)))
      .forEach((pattern) => pattern.forEach((slot) => linked.add(slot)));
  }
  return linked;
}

// Slots bridged by any multi-slot type must be planned together, or one slot's pick can evict its partner's.
export function equipmentSlotGroups(): EquipmentSlot[][] {
  const patterns = equipmentSlotPatterns();
  const order = equipmentSlotOrder();

  return order.reduce<EquipmentSlot[][]>((groups, slot) => {
    if (groups.some((group) => group.includes(slot))) return groups;
    const linked = linkedSlots(slot, patterns);
    return [...groups, order.filter((s) => linked.has(s))];
  }, []);
}

// Every way to cover `slots` with non-overlapping patterns; any slot may also be left as it is.
export function equipmentSlotLayouts(
  slots: EquipmentSlot[],
  patterns: EquipmentSlot[][],
): EquipmentSlot[][][] {
  if (slots.length === 0) return [[]];

  const [first, ...rest] = slots;
  const fitting = patterns.filter(
    (pattern) =>
      pattern.includes(first) && pattern.every((slot) => slots.includes(slot)),
  );

  return [
    ...equipmentSlotLayouts(rest, patterns),
    ...fitting.flatMap((pattern) =>
      equipmentSlotLayouts(
        rest.filter((slot) => !pattern.includes(slot)),
        patterns,
      ).map((layout) => [pattern, ...layout]),
    ),
  ];
}
