import { newEquipmentItem } from '@helpers/item/equipment';
import { applyMaterialDelta } from '@helpers/item/materials';
import type {
  CraftQueueEntry,
  EquipmentId,
  EquipmentItem,
  GameState,
  RecipeContent,
  RecipeRequirement,
  ReservedEquipmentSplit,
} from '@interfaces';

// Mutates `state` inside an `updateGamestate` callback; returns the armory instances it removed so they can be reserved.
export function consumeRequirement(
  state: GameState,
  requirement: RecipeRequirement,
  quantity: number,
): EquipmentItem[] {
  if ('collectibleId' in requirement) return []; // possession gate, never consumed

  if ('itemId' in requirement) {
    applyMaterialDelta(
      state,
      requirement.itemId,
      -requirement.quantity * quantity,
    );
    return [];
  }

  const removed: EquipmentItem[] = [];
  state.armory = state.armory.filter((item) => {
    if (
      item.equipmentId !== requirement.equipmentId ||
      removed.length >= quantity
    ) {
      return true;
    }
    removed.push(item);
    return false;
  });
  return removed;
}

export function reservedEquipmentIdsFor(
  recipe: RecipeContent,
  units: number,
): EquipmentId[] {
  return recipe.requirements
    .filter((requirement) => 'equipmentId' in requirement)
    .flatMap((requirement) =>
      Array.from({ length: units }, () => requirement.equipmentId),
    );
}

// Pulls the first matching instance per id out of `reserved`, leaving the rest in order.
export function splitReservedEquipment(
  reserved: EquipmentItem[],
  equipmentIds: EquipmentId[],
): ReservedEquipmentSplit {
  const rest = [...reserved];
  const taken: EquipmentItem[] = [];

  equipmentIds.forEach((equipmentId) => {
    const index = rest.findIndex((item) => item.equipmentId === equipmentId);
    if (index !== -1) taken.push(...rest.splice(index, 1));
  });

  return { taken, rest };
}

// Pre-reservation saves already lost the originals at queue time, so fresh copies stand in for the unfinished units.
export function backfillReservedEquipment(
  entry: CraftQueueEntry,
  recipe: RecipeContent,
): EquipmentItem[] {
  if (entry.reservedEquipment) return entry.reservedEquipment;

  const remaining = entry.quantityTotal - entry.quantityCompleted;
  return reservedEquipmentIdsFor(recipe, remaining).map((equipmentId) =>
    newEquipmentItem(equipmentId),
  );
}

// Gear comes back even if the recipe is gone; materials need it to know what was spent.
export function refundQueueEntry(
  state: GameState,
  entry: CraftQueueEntry,
  recipe?: RecipeContent,
): void {
  state.armory.push(...entry.reservedEquipment);

  const remaining = entry.quantityTotal - entry.quantityCompleted;
  if (!recipe || remaining <= 0) return;

  recipe.requirements.forEach((requirement) => {
    if (!('itemId' in requirement)) return;
    applyMaterialDelta(
      state,
      requirement.itemId,
      requirement.quantity * remaining,
    );
  });
}
