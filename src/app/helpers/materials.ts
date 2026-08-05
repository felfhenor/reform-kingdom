import { getEntry } from '@helpers/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type { GameStateMaterials, ItemContent, MaterialId } from '@interfaces';

// Drops any storage entries whose id no longer resolves to real content -
// e.g. after a material is renamed/removed from gamedata.
export function pruneInvalidMaterials(
  materials: GameStateMaterials,
): GameStateMaterials {
  const pruned: GameStateMaterials = {};

  (Object.keys(materials) as MaterialId[]).forEach((materialId) => {
    if (getEntry<ItemContent>(materialId)) {
      pruned[materialId] = materials[materialId];
    }
  });

  return pruned;
}

export function getMaterialQuantity(materialId: MaterialId): number {
  return gamestate().materials[materialId]?.quantity ?? 0;
}

export function isMaterialDiscovered(materialId: MaterialId): boolean {
  return !!gamestate().materials[materialId]?.foundAt;
}

export function addMaterial(materialId: MaterialId, quantity: number): void {
  updateGamestate((state) => {
    const existing = state.materials[materialId];
    const current = existing?.quantity ?? 0;
    const foundAt = existing?.foundAt ?? Date.now();
    state.materials[materialId] = { quantity: current + quantity, foundAt };
    return state;
  });
}

export function removeMaterial(materialId: MaterialId, quantity: number): void {
  updateGamestate((state) => {
    const existing = state.materials[materialId];
    const remaining = Math.max(0, (existing?.quantity ?? 0) - quantity);

    if (remaining === 0) {
      delete state.materials[materialId];
    } else {
      state.materials[materialId] = {
        quantity: remaining,
        foundAt: existing?.foundAt ?? Date.now(),
      };
    }

    return state;
  });
}
