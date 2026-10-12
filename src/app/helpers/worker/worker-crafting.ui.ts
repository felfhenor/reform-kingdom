import { getEntry } from '@helpers/content/content';
import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/engine/analytics';
import { gamestate, updateGamestate, workersState } from '@helpers/state-game';
import {
  workerCraftAssignmentIsValid,
  workerCraftTicksPerUnit,
  workerStartCrafting,
} from '@helpers/worker/worker-crafting';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import type {
  ItemContent,
  RecipeContent,
  RecipeId,
  TradeskillId,
  WorkerContent,
  WorkerCraftAssignment,
  WorkerCraftSlot,
  WorkerId,
} from '@interfaces';

// A worker that's out gathering picks the craft up once it gets home.
export function workerAssignCraft(
  workerId: WorkerId,
  recipeId: RecipeId,
): boolean {
  const worker = gamestate().workers[workerId];
  if (!worker) return false;

  const assignment: WorkerCraftAssignment = { recipeId };
  if (!workerCraftAssignmentIsValid(workerId, worker.level, assignment))
    return false;

  updateGamestate((state) => {
    const target = state.workers[workerId];
    if (!target) return state;

    target.assignment = assignment;
    workerStartCrafting(state, workerId, recipeId);

    return state;
  });

  const recipeName = getEntry<RecipeContent>(recipeId)?.name;
  analyticsSendDesignEvent(
    recipeName
      ? `Worker:AssignCraft:${analyticsSafeSegment(recipeName)}`
      : 'Worker:AssignCraft',
  );
  return true;
}

export function workerCraftRemainingTicks(
  workerId: WorkerId,
): number | undefined {
  const worker = workersState()[workerId];
  if (worker?.status.kind !== 'Crafting') return undefined;

  const content = getEntry<WorkerContent>(workerId);
  const recipe = getEntry<RecipeContent>(worker.status.recipeId);
  if (!content || !recipe) return undefined;

  const { craftSpeed } = workerStatsForLevel(content, worker.level);
  if (craftSpeed <= 0) return undefined;

  return (
    workerCraftTicksPerUnit(recipe, craftSpeed) - worker.status.ticksIntoCraft
  );
}

function workerCraftSlot(
  workerId: WorkerId,
  recipeId: RecipeId,
  waiting: boolean,
): WorkerCraftSlot | undefined {
  const worker = getEntry<WorkerContent>(workerId);
  const recipe = getEntry<RecipeContent>(recipeId);
  if (!worker || !recipe || !('itemId' in recipe.result)) return undefined;

  const item = getEntry<ItemContent>(recipe.result.itemId);
  if (!item) return undefined;

  return {
    workerId,
    sprite: item.sprite,
    waiting,
    tooltip: waiting
      ? `${worker.name} is waiting for materials to craft ${item.name}`
      : `${worker.name} is crafting ${item.name}`,
  };
}

export function workerCraftSlots(
  tradeskillId: TradeskillId,
): WorkerCraftSlot[] {
  const workers = workersState();

  return (Object.keys(workers) as WorkerId[])
    .map((workerId) => {
      const status = workers[workerId].status;
      if (status.kind !== 'Crafting') return undefined;
      if (
        getEntry<RecipeContent>(status.recipeId)?.tradeskillId !== tradeskillId
      )
        return undefined;

      return workerCraftSlot(workerId, status.recipeId, !status.materialsHeld);
    })
    .filter((slot): slot is WorkerCraftSlot => !!slot);
}
