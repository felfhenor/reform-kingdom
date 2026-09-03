import { getEntry } from '@helpers/content';
import { gamestate } from '@helpers/state-game';
import type {
  GameState,
  ItemContent,
  ItemId,
  TownId,
  TownMaterials,
} from '@interfaces';

export function applyTownMaterialDelta(
  state: GameState,
  townId: TownId,
  itemId: ItemId,
  delta: number,
): void {
  const target = state.world.towns[townId];
  if (!target) return;

  const quantity = Math.max(0, (target.materials[itemId] ?? 0) + delta);

  if (quantity === 0) {
    delete target.materials[itemId];
  } else {
    target.materials[itemId] = quantity;
  }
}

export function townMaterialQuantity(townId: TownId, itemId: ItemId): number {
  return gamestate().world.towns[townId]?.materials[itemId] ?? 0;
}

// Drops entries whose itemId no longer resolves - mirrors pruneInvalidTownStock/pruneInvalidMaterials.
export function pruneInvalidTownMaterials(
  materials: TownMaterials,
): TownMaterials {
  const pruned: TownMaterials = {};

  (Object.keys(materials) as ItemId[]).forEach((itemId) => {
    if (getEntry<ItemContent>(itemId)) {
      pruned[itemId] = materials[itemId];
    }
  });

  return pruned;
}
