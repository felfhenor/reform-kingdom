import {
  GOLD_COIN_NAME,
  MEMORY_FLUX_NAME,
  REFORGE_REAGENT_NAME,
  STARTING_GOLD_AMOUNT,
  TRADER_TOKEN_NAME,
} from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { ledgerHas, ledgerMark } from '@helpers/engine/ledger';
import {
  discoveredMaterialsState,
  materialsState,
  updateGamestate,
} from '@helpers/state-game';
import type { GameState, ItemContent, ItemId, MaterialId } from '@interfaces';

export function goldCoinId(): ItemId {
  return getEntry<ItemContent>(GOLD_COIN_NAME)!.id;
}

export function traderTokenId(): ItemId {
  return getEntry<ItemContent>(TRADER_TOKEN_NAME)!.id;
}

export function memoryFluxId(): ItemId | undefined {
  return getEntry<ItemContent>(MEMORY_FLUX_NAME)?.id;
}

export function reforgeReagentId(): ItemId {
  return getEntry<ItemContent>(REFORGE_REAGENT_NAME)!.id;
}

export function getMaterialQuantity(materialId: MaterialId): number {
  return materialsState()[materialId]?.quantity ?? 0;
}

// Reads the permanent `discoveredMaterials` record, not live stock - it survives being spent down to 0.
export function isMaterialDiscovered(materialId: MaterialId): boolean {
  return ledgerHas(discoveredMaterialsState(), materialId);
}

function setMaterialEntry(
  state: GameState,
  materialId: MaterialId,
  quantity: number,
  foundAt: number,
): void {
  if (quantity > 0) {
    state.materials[materialId] = {
      quantity,
      foundAt,
    };
    return;
  }

  delete state.materials[materialId];
}

// Shared mutator for material quantity - clamps at 0, drops the entry once depleted. All state.materials mutators (gold included) should go through this.
export function applyMaterialDelta(
  state: GameState,
  materialId: MaterialId,
  delta: number,
): void {
  const existing = state.materials[materialId];
  const quantity = Math.max(0, (existing?.quantity ?? 0) + delta);
  const unchanged = existing
    ? quantity > 0 && existing.quantity === quantity
    : quantity === 0;

  if (!unchanged) {
    setMaterialEntry(
      state,
      materialId,
      quantity,
      existing?.foundAt ?? Date.now(),
    );
  }

  if (delta > 0) ledgerMark(state.discoveredMaterials, materialId);
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

// Mutates `state` directly - for use inside an existing `updateGamestate` callback.
export function gainGold(state: GameState, amount: number): void {
  applyMaterialDelta(state, goldCoinId(), amount);
}

export function spendGold(state: GameState, amount: number): void {
  applyMaterialDelta(state, goldCoinId(), -amount);
}

export function hasGold(amount: number): boolean {
  return getGoldQuantity() >= amount;
}

export function hasTraderTokens(amount: number): boolean {
  return getMaterialQuantity(traderTokenId()) >= amount;
}

// Grants the new-game starting gold - only called once, when a fresh world
// is created, so it never re-applies to an existing save.
export function grantStartingGold(state: GameState): void {
  gainGold(state, STARTING_GOLD_AMOUNT);
}
