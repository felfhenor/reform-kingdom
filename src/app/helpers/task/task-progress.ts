import { tasksRecord } from '@helpers/task/task-record';
import type { AstralProjectorId, ItemId, RecipeId } from '@interfaces';

export function taskRecordGather(
  nodeName: string,
  itemId: ItemId,
  quantity: number,
): void {
  void tasksRecord(
    (requirement) =>
      requirement.kind === 'GatherItem' &&
      requirement.nodeName === nodeName &&
      requirement.itemId === itemId,
    quantity,
  );
}

export function taskRecordCraft(recipeId: RecipeId): void {
  void tasksRecord(
    (requirement) =>
      requirement.kind === 'CraftRecipe' && requirement.recipeId === recipeId,
  );
}

export function taskRecordEncounterClear(nodeName: string): void {
  void tasksRecord(
    (requirement) =>
      requirement.kind === 'ClearEncounter' &&
      requirement.nodeName === nodeName,
  );
}

export function taskRecordAstralCast(
  astralProjectorId: AstralProjectorId,
): Promise<void> {
  return tasksRecord(
    (requirement) =>
      requirement.kind === 'CastAstralSpell' &&
      requirement.astralProjectorId === astralProjectorId,
  );
}

export function taskRecordCommissionFulfilled(): Promise<void> {
  return tasksRecord((requirement) => requirement.kind === 'FulfillCommission');
}
