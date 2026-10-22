import { worldTownsState } from '@helpers/state-game';
import type {
  CommissionRequirement,
  GameState,
  ItemId,
  TownContent,
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

  if (quantity === 0) delete target.materials[itemId];
  else target.materials[itemId] = quantity;
}

export function townMaterialQuantity(townId: TownId, itemId: ItemId): number {
  return worldTownsState()[townId]?.materials[itemId] ?? 0;
}

export function townDefaultMaterials(town: TownContent): TownMaterials {
  const materials: TownMaterials = {};
  town.materialThresholds.forEach((threshold) => {
    if (threshold.default > 0) materials[threshold.itemId] = threshold.default;
  });
  return materials;
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
