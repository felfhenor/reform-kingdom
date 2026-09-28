import { getEntry } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { resolveRewardDisplay } from '@helpers/item/item-preview';
import { worldTownsState } from '@helpers/state-game';
import type {
  EquipmentContent,
  GameState,
  ItemPreviewDisplay,
  TownId,
  TownStockAddition,
  TownStockEntry,
} from '@interfaces';

export function townStock(townId: TownId): TownStockEntry[] {
  return worldTownsState()[townId]?.stock ?? [];
}

export function townStockDisplay(
  entry: TownStockEntry,
): ItemPreviewDisplay | undefined {
  return resolveRewardDisplay({
    equipmentId: entry.equipmentItem.equipmentId,
    equipmentItem: entry.equipmentItem,
  });
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
  target.stock.push(entry);
}
