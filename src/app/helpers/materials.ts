import { gamestate, updateGamestate } from '@helpers/state-game';
import type { MaterialId } from '@interfaces';

export function getMaterialQuantity(materialId: MaterialId): number {
  return gamestate().materials[materialId]?.quantity ?? 0;
}

export function addMaterial(materialId: MaterialId, quantity: number): void {
  updateGamestate((state) => {
    const current = state.materials[materialId]?.quantity ?? 0;
    state.materials[materialId] = { quantity: current + quantity };
    return state;
  });
}

export function removeMaterial(materialId: MaterialId, quantity: number): void {
  updateGamestate((state) => {
    const current = state.materials[materialId]?.quantity ?? 0;
    const remaining = Math.max(0, current - quantity);

    if (remaining === 0) {
      delete state.materials[materialId];
    } else {
      state.materials[materialId] = { quantity: remaining };
    }

    return state;
  });
}
