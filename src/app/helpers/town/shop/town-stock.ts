import { getEntry } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { equipmentItemDisplayName } from '@helpers/item/affix';
import { resolveRewardDisplay } from '@helpers/item/item-preview';
import { gamestate } from '@helpers/state-game';
import type {
  EquipmentContent,
  GameState,
  ItemPreviewDisplay,
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
    equipmentItem: entry.equipmentItem,
  });
  if (!display) return undefined;

  // Rolled affixes change the display name (e.g. "Flaming Wergen Staff") - the base content alone doesn't know this specific instance's roll.
  return {
    ...display,
    name: equipmentItemDisplayName(entry.equipmentItem, display.name),
  };
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
