import {
  SELL_GOLD_PER_COMBAT_STAT_POINT,
  SELL_GOLD_PER_LEVEL,
  SELL_GOLD_PER_RESISTANCE_POINT,
  SELL_GOLD_PER_STAT_POINT,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { affixEffectSum, equipmentItemAffixEffects } from '@helpers/item/affix';
import { newEquipmentItem } from '@helpers/item/equipment';
import {
  COMBAT_STAT_BONUS,
  equipmentItemBonusTotals,
  RESISTANCE_BONUS,
} from '@helpers/item/equipment-bonus';
import { equipmentItemInfusionBonus } from '@helpers/item/infusion';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  BaseStat,
  DropRarity,
  EquipmentArmoryEntry,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  GameStateDiscoveredEquipment,
} from '@interfaces';
import { RARITY_PRIORITY } from '@interfaces';
import { orderBy, sum, sumBy } from 'es-toolkit/compat';

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
    const newItems: EquipmentItem[] = Array.from({ length: quantity }, () =>
      newEquipmentItem(equipmentId),
    );
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

const RARITY_SELL_MULTIPLIER: Record<DropRarity, number> = {
  Common: 1,
  Uncommon: 1.5,
  Rare: 3,
  Mystical: 5,
  Legendary: 15,
};

export const VALUE_MULTIPLIER_PER_STAT: Record<BaseStat, number> = {
  Agility: 2,
  Constitution: 3,
  Energy: 1,
  Health: 1,
  Intelligence: 5,
  Luck: 10,
  Resistance: 4,
  Spirit: 3,
  Strength: 5,
  Vitality: 4,
};

// Base stats plus infusion bonus both count - an infused item sells for more, but infusion materials aren't refunded.
export function equipmentSellValue(entry: EquipmentArmoryEntry): number {
  const affixEffects = equipmentItemAffixEffects(entry.item);
  const affixStatBoost = affixEffectSum(affixEffects, 'Stat');

  const statTotal =
    sumBy(
      Object.keys(entry.content.baseStats),
      (stat) =>
        entry.content.baseStats[stat as BaseStat] *
        VALUE_MULTIPLIER_PER_STAT[stat as BaseStat],
    ) +
    sum(Object.values(equipmentItemInfusionBonus(entry.item.infusedItemIds))) +
    affixStatBoost;

  const base =
    statTotal * SELL_GOLD_PER_STAT_POINT +
    entry.content.levelRequirement * SELL_GOLD_PER_LEVEL;

  // A SellValue affix is a flat bonus, added after the rarity multiplier rather than scaled by it.
  const affixBonus = affixEffectSum(affixEffects, 'SellValue');

  // Combat stats (base + infusion + affix) are also a flat bonus, unscaled by rarity - same treatment as SellValue.
  const combatStatTotal =
    sum(Object.values(COMBAT_STAT_BONUS.equipmentBlock(entry.content) ?? {})) +
    sum(Object.values(equipmentItemBonusTotals(entry.item, COMBAT_STAT_BONUS)));

  // Debuff resistances (base + infusion + affix) get the same flat treatment.
  const resistanceTotal =
    sum(Object.values(RESISTANCE_BONUS.equipmentBlock(entry.content) ?? {})) +
    sum(Object.values(equipmentItemBonusTotals(entry.item, RESISTANCE_BONUS)));

  return Math.max(
    1,
    Math.round(base * RARITY_SELL_MULTIPLIER[entry.content.rarity]) +
      affixBonus +
      combatStatTotal * SELL_GOLD_PER_COMBAT_STAT_POINT +
      resistanceTotal * SELL_GOLD_PER_RESISTANCE_POINT,
  );
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
