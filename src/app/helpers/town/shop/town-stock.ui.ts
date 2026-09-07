import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import {
  equipmentItemBonusCombatStats,
  equipmentItemBonusResistances,
  equipmentItemBonusStats,
} from '@helpers/item/equipment-display';
import type {
  CombatStatBlock,
  StatBlock,
  StatusEffectBlock,
  TownContent,
  TownStockEntry,
} from '@interfaces';

// Affix/infusion bonus rows for a rolled stock entry's tooltip.
export function townStockBonusStats(entry: TownStockEntry): StatBlock {
  return equipmentItemBonusStats(entry.equipmentItem);
}

export function townStockBonusResistances(
  entry: TownStockEntry,
): StatusEffectBlock {
  return equipmentItemBonusResistances(entry.equipmentItem);
}

export function townStockBonusCombatStats(
  entry: TownStockEntry,
): CombatStatBlock {
  return equipmentItemBonusCombatStats(entry.equipmentItem);
}

// Formatted (formatDuration) time left before this entry cycles out - undefined when the town has expiration disabled (itemExpirationTimer <= 0).
export function townStockExpiresIn(
  entry: TownStockEntry,
  town: TownContent,
): string | undefined {
  const { itemExpirationTimer } = town.traders;
  if (itemExpirationTimer <= 0) return undefined;

  const remaining =
    itemExpirationTimer - (timerTicksElapsed() - entry.addedAtTick);
  return formatDuration(remaining);
}
