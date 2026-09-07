import { getEntry } from '@helpers/content/content';
import { formatDuration, timerTicksElapsed } from '@helpers/engine/timer';
import { equipmentItemDisplayName } from '@helpers/item/affix';
import {
  equipmentItemBonusCombatStats,
  equipmentItemBonusResistances,
  equipmentItemBonusStats,
} from '@helpers/item/equipment-display';
import { resolveRewardDisplay } from '@helpers/item/item-preview';
import { gamestate } from '@helpers/state-game';
import type {
  CombatStatBlock,
  EquipmentContent,
  GameState,
  ItemPreviewDisplay,
  StatBlock,
  StatusEffectBlock,
  TownContent,
  TownId,
  TownStockAddition,
  TownStockEntry,
} from '@interfaces';

export function townStock(townId: TownId): TownStockEntry[] {
  return gamestate().world.towns[townId]?.stock ?? [];
}

export function townStockDisplay(
  entry: TownStockEntry,
): ItemPreviewDisplay | undefined {
  const display = resolveRewardDisplay({
    equipmentId: entry.equipmentItem.equipmentId,
  });
  if (!display) return undefined;

  // Rolled affixes change the display name (e.g. "Flaming Wergen Staff") - the base content alone doesn't know this specific instance's roll.
  return {
    ...display,
    name: equipmentItemDisplayName(entry.equipmentItem, display.name),
  };
}

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

// Drops entries whose equipmentId no longer resolves
export function pruneInvalidTownStock(
  stock: TownStockEntry[],
): TownStockEntry[] {
  return stock
    .filter(
      (entry) =>
        !!entry.equipmentItem &&
        !!getEntry<EquipmentContent>(entry.equipmentItem.equipmentId),
    )
    .map((entry) =>
      entry.addedAtTick === undefined
        ? { ...entry, addedAtTick: timerTicksElapsed() }
        : entry,
    );
}

// Always lands as its own new entry (rolled equipment is never merged) - capped, so a full shop simply refuses the addition.
export function applyTownStockAdd(
  state: GameState,
  townId: TownId,
  addition: TownStockAddition,
  cap: number,
): void {
  const target = state.world.towns[townId];
  if (!target) return;
  if (target.stock.length >= cap) return;

  const entry: TownStockEntry = {
    ...addition,
    addedAtTick: timerTicksElapsed(),
  };
  target.stock = [...target.stock, entry];
}
