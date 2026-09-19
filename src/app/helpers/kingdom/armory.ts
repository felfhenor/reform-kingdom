import {
  SELL_GOLD_PER_COMBAT_STAT_POINT,
  SELL_GOLD_PER_LEVEL,
  SELL_GOLD_PER_RESISTANCE_POINT,
  SELL_GOLD_PER_STAT_POINT,
  VALUE_MULTIPLIER_PER_COMBAT_STAT,
  VALUE_MULTIPLIER_PER_RESISTANCE,
  VALUE_MULTIPLIER_PER_STAT,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { dictionaryWith } from '@helpers/engine/dictionary';
import { affixEffectSum, equipmentItemAffixEffects } from '@helpers/item/affix';
import { newEquipmentItem } from '@helpers/item/equipment';
import {
  COMBAT_STAT_BONUS,
  equipmentItemBonusTotals,
  RESISTANCE_BONUS,
  weightedBlockTotal,
} from '@helpers/item/equipment-bonus';
import { equipmentItemInfusionBonus } from '@helpers/item/infusion';
import {
  armoryCapForBoost,
  armoryCapForState,
  armoryOverflowCapForBoost,
  armoryOverflowCapForState,
  syncArmoryGlobalEffects,
} from '@helpers/kingdom/armory-global-effects';
import {
  armoryState,
  discoveredEquipmentState,
  globalEffectSumsState,
  updateGamestate,
} from '@helpers/state-game';
import type {
  AffixId,
  DropRarity,
  EquipmentArmoryEntry,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  GameState,
  GameStateDiscoveredEquipment,
} from '@interfaces';
import { RARITY_PRIORITY } from '@interfaces';
import { orderBy } from 'es-toolkit/compat';

export function armoryGet(): EquipmentItem[] {
  return armoryState();
}

export function armoryCap(): number {
  return armoryCapForBoost(globalEffectSumsState().armorySizeBoost);
}

// Drops/loot get to overshoot the cap by this much before hard-stopping.
export function armoryOverflowCap(): number {
  return armoryOverflowCapForBoost(globalEffectSumsState().armorySizeBoost);
}

export function armoryHasRoomFor(
  currentCount: number,
  quantity = 1,
  allowOverflow = false,
): boolean {
  const cap = allowOverflow ? armoryOverflowCap() : armoryCap();
  return currentCount + quantity <= cap;
}

// For use inside an `updateGamestate` callback, where a slice selector would return the stale pre-mutation value.
export function armoryHasRoomForState(
  state: GameState,
  quantity = 1,
  allowOverflow = false,
): boolean {
  const cap = allowOverflow
    ? armoryOverflowCapForState(state)
    : armoryCapForState(state);
  return state.armory.length + quantity <= cap;
}

export function armoryHasRoom(quantity = 1, allowOverflow = false): boolean {
  return armoryHasRoomFor(armoryGet().length, quantity, allowOverflow);
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

// Permanent "ever found" flag - separate from armory possession, so it still
// applies to equipment the player never actually keeps (e.g. auto-sold loot).
export function markEquipmentDiscovered(
  state: GameState,
  equipmentId: EquipmentId,
): void {
  const existing = state.discoveredEquipment[equipmentId];
  state.discoveredEquipment = dictionaryWith(
    state.discoveredEquipment,
    equipmentId,
    { foundAt: existing?.foundAt ?? Date.now() },
  );
}

// Clamps to available room (or skips the check for debug tooling) and returns what was actually admitted - a full armory can mean fewer items landed than requested.
export function addArmoryItems(
  state: GameState,
  equipmentId: EquipmentId,
  items: EquipmentItem[],
  allowOverflow = false,
  bypassCap = false,
): EquipmentItem[] {
  const room = bypassCap
    ? items.length
    : Math.max(
        0,
        (allowOverflow
          ? armoryOverflowCapForState(state)
          : armoryCapForState(state)) - state.armory.length,
      );
  const admitted = items.slice(0, room);
  if (admitted.length === 0) return admitted;

  state.armory = [...state.armory, ...admitted];
  syncArmoryGlobalEffects(state);
  markEquipmentDiscovered(state, equipmentId);

  return admitted;
}

// Returns the admitted count, which may be less than `quantity` (or 0) once the relevant cap is reached - only reliable when called from a tick-guaranteed context, since `updateGamestate` runs its callback synchronously there (see game-state-conventions.md).
export function armoryAdd(
  equipmentId: EquipmentId,
  quantity = 1,
  allowOverflow = false,
  bypassCap = false,
): number {
  if (quantity <= 0) return 0;

  let admittedCount = 0;

  updateGamestate((state) => {
    const newItems: EquipmentItem[] = Array.from({ length: quantity }, () =>
      newEquipmentItem(equipmentId),
    );
    admittedCount = addArmoryItems(
      state,
      equipmentId,
      newItems,
      allowOverflow,
      bypassCap,
    ).length;

    return state;
  });

  return admittedCount;
}

// Debug tool - builds one item with caller-specified affixes instead of a random rarity roll, and always bypasses the cap.
export function armoryAddWithAffixes(
  equipmentId: EquipmentId,
  affixIds: AffixId[],
): void {
  updateGamestate((state) => {
    addArmoryItems(
      state,
      equipmentId,
      [newEquipmentItem(equipmentId, affixIds)],
      false,
      true,
    );

    return state;
  });
}

// Whether this equipment has ever been found - unlike armory ownership, this
// is permanent and survives equipping, selling, or breaking the gear down.
export function isEquipmentDiscovered(equipmentId: EquipmentId): boolean {
  return !!discoveredEquipmentState()[equipmentId]?.foundAt;
}

const RARITY_SELL_MULTIPLIER: Record<DropRarity, number> = {
  Common: 1,
  Uncommon: 1.5,
  Rare: 3,
  Mystical: 5,
  Legendary: 15,
};

// Base stats plus infusion bonus both count - an infused item sells for more, but infusion materials aren't refunded.
export function equipmentSellValue(entry: EquipmentArmoryEntry): number {
  const affixEffects = equipmentItemAffixEffects(entry.item);
  const affixStatBoost = affixEffectSum(affixEffects, 'Stat');

  const statTotal =
    weightedBlockTotal(entry.content.baseStats, VALUE_MULTIPLIER_PER_STAT) +
    weightedBlockTotal(
      equipmentItemInfusionBonus(entry.item.infusedItemIds),
      VALUE_MULTIPLIER_PER_STAT,
    ) +
    affixStatBoost;

  const base =
    statTotal * SELL_GOLD_PER_STAT_POINT +
    entry.content.levelRequirement * SELL_GOLD_PER_LEVEL;

  // A SellValue affix is a flat bonus, added after the rarity multiplier rather than scaled by it.
  const affixBonus = affixEffectSum(affixEffects, 'SellValue');

  // Combat stats (base + infusion + affix) are also a flat bonus, unscaled by rarity - same treatment as SellValue.
  const combatStatTotal =
    weightedBlockTotal(
      COMBAT_STAT_BONUS.equipmentBlock(entry.content),
      VALUE_MULTIPLIER_PER_COMBAT_STAT,
    ) +
    weightedBlockTotal(
      equipmentItemBonusTotals(entry.item, COMBAT_STAT_BONUS),
      VALUE_MULTIPLIER_PER_COMBAT_STAT,
    );

  // Debuff resistances (base + infusion + affix) get the same flat treatment.
  const resistanceTotal =
    weightedBlockTotal(
      RESISTANCE_BONUS.equipmentBlock(entry.content),
      VALUE_MULTIPLIER_PER_RESISTANCE,
    ) +
    weightedBlockTotal(
      equipmentItemBonusTotals(entry.item, RESISTANCE_BONUS),
      VALUE_MULTIPLIER_PER_RESISTANCE,
    );

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
