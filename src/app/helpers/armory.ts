import { getEntry } from '@helpers/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type { EquipmentContent, EquipmentId, EquipmentItem } from '@interfaces';

export function armoryGet(): EquipmentItem[] {
  return gamestate().armory;
}

// Drops any armory entries whose equipmentId no longer resolves to real
// content - e.g. after a piece of gear is renamed/removed from gamedata.
export function pruneInvalidArmoryItems(
  armory: EquipmentItem[],
): EquipmentItem[] {
  return armory.filter((item) =>
    !!getEntry<EquipmentContent>(item.equipmentId),
  );
}

export function armoryAdd(equipmentId: EquipmentId, quantity = 1): void {
  if (quantity <= 0) return;

  updateGamestate((state) => {
    const newItems = Array.from({ length: quantity }, () => ({ equipmentId }));
    state.armory = [...state.armory, ...newItems];
    return state;
  });
}
