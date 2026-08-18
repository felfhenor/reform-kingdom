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

// Shared mutator for material quantity - clamps at 0, drops the entry once depleted. All state.materials mutators (gold included) should go through this.
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

// Gold-specific shorthands - gold is just a material under the hood.
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

export function hasGold(amount: number): boolean {
  return getGoldQuantity() >= amount;
}

const STARTING_GOLD_AMOUNT = 100;

// Grants the new-game starting gold - only called once, from `gameStart`
// when a fresh world is created, so it never re-applies to an existing save.
export function grantStartingGold(state: GameState): void {
  gainGold(state, STARTING_GOLD_AMOUNT);
}
