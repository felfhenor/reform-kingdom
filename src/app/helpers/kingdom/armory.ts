import { getEntry } from '@helpers/content';
import { analyticsSendDesignEvent } from '@helpers/engine/analytics';
import { equipmentItemInfusionBonus } from '@helpers/item/infusion';
import { gainGold } from '@helpers/item/materials';
import { rngUuid } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  DropRarity,
  EquipmentArmoryEntry,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  EquipmentItemId,
  GameStateDiscoveredEquipment,
} from '@interfaces';
import { RARITY_PRIORITY } from '@interfaces';
import { orderBy, sum } from 'es-toolkit/compat';

export function armoryGet(): EquipmentItem[] {
  return gamestate().armory;
}

// One entry per owned item (duplicates never merged), carrying the instance alongside its content for per-instance infusion state.
export function getArmoryEntries(): EquipmentArmoryEntry[] {
  const entries = armoryGet()
    .map((item) => {
      const content = getEntry<EquipmentContent>(item.equipmentId);
      return content ? { item, content } : undefined;
    })
    .filter((entry): entry is EquipmentArmoryEntry => !!entry);

  return orderBy(
    entries,
    [
      (entry) => RARITY_PRIORITY[entry.content.rarity],
      (entry) => entry.content.name,
    ],
    ['desc', 'asc'],
  );
}

export function filterArmoryEntries(
  entries: EquipmentArmoryEntry[],
  searchText: string,
): EquipmentArmoryEntry[] {
  const text = searchText.trim().toLowerCase();
  if (text === '') return entries;

  return entries.filter((entry) => {
    if (entry.content.name.toLowerCase().includes(text)) return true;
    if (entry.content.description.toLowerCase().includes(text)) return true;

    return false;
  });
}

// Drops any armory entries whose equipmentId no longer resolves to real
// content - e.g. after a piece of gear is renamed/removed from gamedata.
export function pruneInvalidArmoryItems(
  armory: EquipmentItem[],
): EquipmentItem[] {
  return armory.filter(
    (item) => !!getEntry<EquipmentContent>(item.equipmentId),
  );
}

export function armoryAdd(equipmentId: EquipmentId, quantity = 1): void {
  if (quantity <= 0) return;

  updateGamestate((state) => {
    const newItems: EquipmentItem[] = Array.from({ length: quantity }, () => ({
      id: rngUuid() as EquipmentItemId,
      equipmentId,
      infusedItemIds: [],
    }));
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

// Same rate infusion pricing uses, plus a per-level component so higher-tier drops are worth more.
const SELL_GOLD_PER_STAT_POINT = 20;
const SELL_GOLD_PER_LEVEL = 10;
const RARITY_SELL_MULTIPLIER: Record<DropRarity, number> = {
  Common: 1,
  Uncommon: 1.25,
  Rare: 1.75,
  Mystical: 2.5,
  Legendary: 4,
};

// Base stats plus infusion bonus both count - an infused item sells for more, but infusion materials aren't refunded.
export function equipmentSellValue(entry: EquipmentArmoryEntry): number {
  const statTotal =
    sum(Object.values(entry.content.baseStats)) +
    sum(Object.values(equipmentItemInfusionBonus(entry.item.infusedItemIds)));

  const base =
    statTotal * SELL_GOLD_PER_STAT_POINT +
    entry.content.levelRequirement * SELL_GOLD_PER_LEVEL;

  return Math.max(
    1,
    Math.round(base * RARITY_SELL_MULTIPLIER[entry.content.rarity]),
  );
}

// Sells owned armory items atomically; stale ids are silently skipped. Returns total gold gained.
export function sellEquipmentItems(
  equipmentItemIds: EquipmentItemId[],
): number {
  const idsToSell = new Set(equipmentItemIds);
  const entries = getArmoryEntries().filter((entry) =>
    idsToSell.has(entry.item.id),
  );
  if (entries.length === 0) return 0;

  const totalGold = sum(entries.map((entry) => equipmentSellValue(entry)));

  updateGamestate((state) => {
    state.armory = state.armory.filter((item) => !idsToSell.has(item.id));
    gainGold(state, totalGold);
    return state;
  });

  analyticsSendDesignEvent('Kingdom:Armory:MassSell', entries.length);
  return totalGold;
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
