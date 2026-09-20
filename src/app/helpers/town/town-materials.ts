import { getEntry } from '@helpers/content/content';
import { dictionaryWith, dictionaryWithout } from '@helpers/engine/dictionary';
import { worldTownsState } from '@helpers/state-game';
import { updateTownNode } from '@helpers/town/town-node';
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

  const current = target.materials[itemId] ?? 0;
  const quantity = Math.max(0, current + delta);
  if (quantity === current) return;

  updateTownNode(state, townId, (town) => {
    town.materials =
      quantity === 0
        ? dictionaryWithout(town.materials, itemId)
        : dictionaryWith(town.materials, itemId, quantity);
  });
}

export function townMaterialQuantity(townId: TownId, itemId: ItemId): number {
  return worldTownsState()[townId]?.materials[itemId] ?? 0;
}

// Item requirements only - a town has no armory or kill tally to credit equipment/monster-kill requirements to.
export function depositCommissionRequirementsToTown(
  state: GameState,
  townId: TownId,
  requirements: CommissionRequirement[],
): void {
  requirements.forEach((requirement) => {
    if (!('itemId' in requirement)) return;
    applyTownMaterialDelta(
      state,
      townId,
      requirement.itemId,
      requirement.quantity,
    );
  });
}

// Drops entries whose itemId no longer resolves.
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
