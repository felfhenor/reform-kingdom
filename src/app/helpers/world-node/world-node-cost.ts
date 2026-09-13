import { applyMaterialDelta, getMaterialQuantity } from '@helpers/item/materials';
import type { CostItem, GameState } from '@interfaces';

// Shared by every leveled world node (gather nodes, shrines) that spends materials to upgrade.
export function worldNodeCanAffordCost(costs: CostItem[]): boolean {
  return costs.every(
    (cost) => getMaterialQuantity(cost.itemId) >= cost.required,
  );
}

// Mutates `state` directly - call only from inside an `updateGamestate` callback.
export function worldNodeSpendCost(state: GameState, costs: CostItem[]): void {
  costs.forEach((cost) => {
    applyMaterialDelta(state, cost.itemId, -cost.required);
  });
}
