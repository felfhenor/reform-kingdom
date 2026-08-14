import { getEntry } from '@helpers/content';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  GameState,
  GameStateMaterials,
  ItemContent,
  ItemId,
  MaterialId,
} from '@interfaces';

const GOLD_COIN_NAME = 'Gold Coin';

export function goldCoinId(): ItemId {
  return getEntry<ItemContent>(GOLD_COIN_NAME)!.id;
}

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

// The single shared implementation for adding/subtracting a material's
// quantity in place - clamps at 0, drops the entry entirely once depleted,
// and preserves the original `foundAt` timestamp. Every direct mutator of
// `state.materials` (gold included, which is just a regular material) should
// go through this rather than reimplementing the clamp/delete logic locally.
export function applyMaterialDelta(
  state: GameState,
  materialId: MaterialId,
  delta: number,
): void {
  const existing = state.materials[materialId];
  const quantity = Math.max(0, (existing?.quantity ?? 0) + delta);

  if (quantity === 0) {
    delete state.materials[materialId];
  } else {
    state.materials[materialId] = {
      quantity,
      foundAt: existing?.foundAt ?? Date.now(),
    };
  }
}

export function addMaterial(materialId: MaterialId, quantity: number): void {
  updateGamestate((state) => {
    applyMaterialDelta(state, materialId, quantity);
    return state;
  });
}

export function removeMaterial(materialId: MaterialId, quantity: number): void {
  updateGamestate((state) => {
    applyMaterialDelta(state, materialId, -quantity);
    return state;
  });
}

// Gold-specific shorthands so call sites don't each have to import
// `goldCoinId` and resolve it themselves - gold is still just a material
// under the hood, these just save the repeated `goldCoinId()` lookup.
export function getGoldQuantity(): number {
  return getMaterialQuantity(goldCoinId());
}

// Mutates `state` directly - for use inside an existing `updateGamestate`
// callback, same as `applyMaterialDelta`.
export function gainGold(state: GameState, amount: number): void {
  applyMaterialDelta(state, goldCoinId(), amount);
}

export function spendGold(state: GameState, amount: number): void {
  applyMaterialDelta(state, goldCoinId(), -amount);
}
