import { getEntry } from '@helpers/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  GameStateDiscoveredEquipment,
} from '@interfaces';
import { RARITY_PRIORITY } from '@interfaces';
import { orderBy } from 'es-toolkit/compat';

export function armoryGet(): EquipmentItem[] {
  return gamestate().armory;
}

// Resolves every owned armory item to its content, one entry per item -
// duplicate equipment is never merged/counted, each physical item stays
// its own entry, same as the underlying `armory` state list.
export function getArmoryEntries(): EquipmentContent[] {
  const entries = armoryGet()
    .map((item) => getEntry<EquipmentContent>(item.equipmentId))
    .filter((entry): entry is EquipmentContent => !!entry);

  return orderBy(
    entries,
    [(entry) => RARITY_PRIORITY[entry.rarity], (entry) => entry.name],
    ['desc', 'asc'],
  );
}

export function filterArmoryEntries(
  entries: EquipmentContent[],
  searchText: string,
): EquipmentContent[] {
  const text = searchText.trim().toLowerCase();
  if (text === '') return entries;

  return entries.filter((entry) => {
    if (entry.name.toLowerCase().includes(text)) return true;
    if (entry.description.toLowerCase().includes(text)) return true;

    return false;
  });
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

    const existing = state.discoveredEquipment[equipmentId];
    state.discoveredEquipment[equipmentId] = {
      foundAt: existing?.foundAt ?? Date.now(),
    };

    return state;
  });
}

// Whether this equipment has ever been found - unlike armory ownership, this
// is permanent and survives equipping, selling, or breaking the gear down.
export function isEquipmentDiscovered(equipmentId: EquipmentId): boolean {
  return !!gamestate().discoveredEquipment[equipmentId]?.foundAt;
}

// Drops any discovery entries whose equipmentId no longer resolves to real
// content - e.g. after a piece of gear is renamed/removed from gamedata.
export function pruneInvalidDiscoveredEquipment(
  discovered: GameStateDiscoveredEquipment,
): GameStateDiscoveredEquipment {
  const pruned: GameStateDiscoveredEquipment = {};

  (Object.keys(discovered) as EquipmentId[]).forEach((equipmentId) => {
    if (getEntry<EquipmentContent>(equipmentId)) {
      pruned[equipmentId] = discovered[equipmentId];
    }
  });

  return pruned;
}
