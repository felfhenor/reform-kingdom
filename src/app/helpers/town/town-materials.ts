import { getEntry } from '@helpers/content/content';
import { gamestate } from '@helpers/state-game';
import type {
  CommissionRequirement,
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

// Item requirements only - a town has no armory or kill tally to credit equipment/monster-kill requirements to.
export function depositCommissionRequirementsToTown(
  state: GameState,
  townId: TownId,
  requirements: CommissionRequirement[],
): void {
  requirements.forEach((requirement) => {
    if (!('itemId' in requirement)) return;
    applyTownMaterialDelta(state, townId, requirement.itemId, requirement.quantity);
  });
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
