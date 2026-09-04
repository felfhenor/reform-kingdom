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
  ItemContent,
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
  if ('itemId' in entry) return resolveRewardDisplay({ itemId: entry.itemId });

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

// Affix/infusion bonus rows for a rolled equipment entry's tooltip (mirrors slot-armory-item's bonusStats/etc) - undefined for a stacked item entry, which has nothing to roll.
export function townStockBonusStats(
  entry: TownStockEntry,
): StatBlock | undefined {
  return 'equipmentItem' in entry
    ? equipmentItemBonusStats(entry.equipmentItem)
    : undefined;
}

export function townStockBonusResistances(
  entry: TownStockEntry,
): StatusEffectBlock | undefined {
  return 'equipmentItem' in entry
    ? equipmentItemBonusResistances(entry.equipmentItem)
    : undefined;
}

export function townStockBonusCombatStats(
  entry: TownStockEntry,
): CombatStatBlock | undefined {
  return 'equipmentItem' in entry
    ? equipmentItemBonusCombatStats(entry.equipmentItem)
    : undefined;
}

// Formatted (formatDuration) time left before this entry cycles out - undefined when the town has expiration disabled (itemExpirationTimer <= 0).
export function townStockExpiresIn(
  entry: TownStockEntry,
  town: TownContent,
): string | undefined {
  const { itemExpirationTimer } = town.traders;
  if (itemExpirationTimer <= 0) return undefined;

  const remaining = itemExpirationTimer - (timerTicksElapsed() - entry.addedAtTick);
  return formatDuration(remaining);
}

// Drops entries whose itemId/equipmentId no longer resolves, and backfills a legacy entry's missing addedAtTick to now (not zero, so it doesn't instantly expire).
export function pruneInvalidTownStock(
  stock: TownStockEntry[],
): TownStockEntry[] {
  return stock
    .filter((entry) =>
      'itemId' in entry
        ? !!getEntry<ItemContent>(entry.itemId)
        : !!getEntry<EquipmentContent>(entry.equipmentItem.equipmentId),
    )
    .map((entry) =>
      entry.addedAtTick === undefined
        ? { ...entry, addedAtTick: timerTicksElapsed() }
        : entry,
    );
}

// Stacks onto a matching itemId entry, resetting its addedAtTick (a restock counts as fresh, extending the whole stack's life); equipment (rolled, never merged) always lands as its own new entry.
export function applyTownStockAdd(
  state: GameState,
  townId: TownId,
  addition: TownStockAddition,
  cap: number,
): void {
  const target = state.world.towns[townId];
  if (!target) return;

  if ('itemId' in addition) {
    const existingIndex = target.stock.findIndex(
      (entry) => 'itemId' in entry && entry.itemId === addition.itemId,
    );
    if (existingIndex !== -1) {
      target.stock = target.stock.map((entry, i) =>
        i === existingIndex && 'itemId' in entry
          ? {
              ...entry,
              quantity: entry.quantity + addition.quantity,
              addedAtTick: timerTicksElapsed(),
            }
          : entry,
      );
      return;
    }
  }

  if (target.stock.length >= cap) return;

  const entry: TownStockEntry = { ...addition, addedAtTick: timerTicksElapsed() };
  target.stock = [...target.stock, entry];
}
