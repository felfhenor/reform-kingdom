import { contentNameById } from '@helpers/i18n/i18n-content';
import { categoryMessageLog } from '@helpers/combat/combat-log';
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
import { workerOrderCount } from '@helpers/worker/worker-order';
import { kingdomWorkerStatsForLevel } from '@helpers/worker/worker-progression';
import { workerTurnHome } from '@helpers/worker/worker-travel';
import type {
  ItemContent,
  RecipeContent,
  RecipeId,
  TradeskillId,
  WorkerContent,
  WorkerCraftAssignment,
  WorkerCraftSlot,
  WorkerId,
  IsContentItem,
} from '@interfaces';

// A worker that's out gathering turns home with its haul and starts the craft there.
export async function workerAssignCraft(
  workerId: WorkerId,
  recipeId: RecipeId,
  count?: number,
): Promise<boolean> {
  const worker = gamestate().workers[workerId];
  if (!worker) return false;

  const remaining = workerOrderCount(count);
  const assignment: WorkerCraftAssignment = {
    recipeId,
    ...(remaining ? { remaining } : {}),
  };
  if (!workerCraftAssignmentIsValid(workerId, worker.level, assignment))
    return false;

  let assigned = false;
  await updateGamestate((state) => {
    const target = state.workers[workerId];
    if (!target) return state;

    target.assignment = assignment;
    workerStartCrafting(state, workerId, recipeId);
    assigned = true;

    return state;
  });
  if (!assigned) return false;

  const status = gamestate().workers[workerId]?.status;
  if (status?.kind === 'TravelingTo' || status?.kind === 'Gathering') {
    workerTurnHome(workerId, status);
  }

  const workerName = contentNameById(workerId);
  const recipeName = contentNameById(recipeId);
  if (workerName && recipeName) {
    categoryMessageLog(
      'Craft',
      'Worker Crafting',
      `${workerName} was assigned to craft ${recipeName}.`,
    );
  }
  analyticsSendDesignEvent(
    recipeName
      ? `Worker:AssignCraft:${analyticsSafeSegment(getEntry<IsContentItem>(recipeId)?.name ?? recipeName)}`
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

  const { craftSpeed } = kingdomWorkerStatsForLevel(content, worker.level);
  if (craftSpeed <= 0) return undefined;

  return (
    workerCraftTicksPerUnit(recipe, craftSpeed) - worker.status.ticksIntoCraft
  );
}

function workerCraftSlot(
  workerId: WorkerId,
  recipeId: RecipeId,
  waiting: boolean,
  remaining?: number,
): WorkerCraftSlot | undefined {
  const worker = getEntry<WorkerContent>(workerId);
  const recipe = getEntry<RecipeContent>(recipeId);
  if (!worker || !recipe || !('itemId' in recipe.result)) return undefined;

  const item = getEntry<ItemContent>(recipe.result.itemId);
  if (!item) return undefined;

  const left =
    remaining !== undefined ? ` (${remaining.toLocaleString()} left)` : '';
  return {
    workerId,
    sprite: item.sprite,
    waiting,
    tooltip: waiting
      ? `${worker.name} is waiting for materials to craft ${item.name}${left}`
      : `${worker.name} is crafting ${item.name}${left}`,
  };
}

export function workerCraftSlots(
  tradeskillId: TradeskillId,
): WorkerCraftSlot[] {
  const workers = workersState();

  return (Object.keys(workers) as WorkerId[])
    .map((workerId) => {
      const { status, assignment } = workers[workerId];
      if (status.kind !== 'Crafting') return undefined;
      if (
        getEntry<RecipeContent>(status.recipeId)?.tradeskillId !== tradeskillId
      )
        return undefined;

      return workerCraftSlot(
        workerId,
        status.recipeId,
        !status.materialsHeld,
        assignment?.remaining,
      );
    })
    .filter((slot): slot is WorkerCraftSlot => !!slot);
}
