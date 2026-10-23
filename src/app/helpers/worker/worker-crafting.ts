import {
  categoryMessageLog,
  ITEM_ICON_TOKEN,
  itemDropHtml,
} from '@helpers/combat/combat-log';
import { WORKER_CRAFT_STAMINA_PER_TRADESKILL_LEVEL } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { consumeRequirement } from '@helpers/crafting/crafting-reserved-equipment';
import { requirementAvailable } from '@helpers/crafting/crafting-queue';
import {
  recipeResultQuantity,
  recipeResultRollSucceeds,
} from '@helpers/crafting/recipe-result';
import { isRecipeAvailable } from '@helpers/crafting/recipes';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { applyMaterialDelta } from '@helpers/item/materials';
import { gamestate, updateGamestate } from '@helpers/state-game';
import {
  workerGainXp,
  workerLevelInRange,
  workerStatsForLevel,
} from '@helpers/worker/worker-progression';
import type {
  GameState,
  GameStateWorkers,
  ItemContent,
  ItemQuantity,
  LevelRange,
  RecipeContent,
  RecipeId,
  RecipeRequirementItem,
  WorkerContent,
  WorkerCraftAssignment,
  WorkerId,
  WorkerStatusCrafting,
} from '@interfaces';

// Same practical scale as gather nodes' workerLevelRange, so mapped 1:1.
export function recipeWorkerLevelRange(recipe: RecipeContent): LevelRange {
  return { min: recipe.minTradeskillLevel, max: recipe.maxTradeskillLevel };
}

export function recipeWorkerStaminaCost(recipe: RecipeContent): number {
  return recipe.minTradeskillLevel * WORKER_CRAFT_STAMINA_PER_TRADESKILL_LEVEL;
}

export function workerCraftTicksPerUnit(
  recipe: RecipeContent,
  craftSpeed: number,
): number {
  return Math.max(1, Math.ceil(recipe.craftTime / craftSpeed));
}

function recipeItemRequirements(
  recipe: RecipeContent,
): RecipeRequirementItem[] {
  return recipe.requirements.filter(
    (requirement): requirement is RecipeRequirementItem =>
      'itemId' in requirement,
  );
}

export function isRecipeWorkerCraftable(recipe: RecipeContent): boolean {
  if (!('itemId' in recipe.result)) return false;
  if (recipe.requirements.some((requirement) => 'equipmentId' in requirement))
    return false;

  if (!isRecipeAvailable(recipe)) return false;

  return recipe.requirements.every(
    (requirement) =>
      !('collectibleId' in requirement) ||
      isCollectibleDiscovered(requirement.collectibleId),
  );
}

export function workerCraftAssignmentIsValid(
  workerId: WorkerId,
  level: number,
  assignment: WorkerCraftAssignment,
): boolean {
  const content = getEntry<WorkerContent>(workerId);
  const recipe = getEntry<RecipeContent>(assignment.recipeId);
  if (!content || !recipe) return false;

  const { craftSpeed, stamina } = workerStatsForLevel(content, level);
  return (
    craftSpeed > 0 &&
    stamina >= recipeWorkerStaminaCost(recipe) &&
    isRecipeWorkerCraftable(recipe)
  );
}

export function workerCraftingStatusStart(
  recipeId: RecipeId,
): WorkerStatusCrafting {
  return {
    kind: 'Crafting',
    recipeId,
    ticksIntoCraft: 0,
    materialsHeld: false,
  };
}

// All-or-nothing: a partial take would be over-refunded later, since material deltas clamp at 0.
function takeCraftUnit(state: GameState, recipe: RecipeContent): boolean {
  const requirements = recipeItemRequirements(recipe);
  const available = requirements.every(
    (requirement) => requirementAvailable(requirement) >= requirement.quantity,
  );
  if (!available) return false;

  requirements.forEach((requirement) =>
    consumeRequirement(state, requirement, 1),
  );
  return true;
}

function craftUnitRefund(recipeId: RecipeId): ItemQuantity[] {
  const recipe = getEntry<RecipeContent>(recipeId);
  return recipe ? recipeItemRequirements(recipe) : [];
}

// The only place a held unit is refunded, so the refund and the status change can't drift apart.
export function workerStopCrafting(state: GameState, workerId: WorkerId): void {
  const target = state.workers[workerId];
  if (target?.status.kind !== 'Crafting') return;

  if (target.status.materialsHeld) {
    craftUnitRefund(target.status.recipeId).forEach(({ itemId, quantity }) =>
      applyMaterialDelta(state, itemId, quantity),
    );
  }
  target.status = { kind: 'AtDuchy' };
}

// Re-picking the recipe already being crafted keeps its progress.
export function workerStartCrafting(
  state: GameState,
  workerId: WorkerId,
  recipeId: RecipeId,
): void {
  const target = state.workers[workerId];
  if (!target) return;

  const { status } = target;
  if (status.kind === 'Crafting' && status.recipeId === recipeId) return;
  if (status.kind !== 'AtDuchy' && status.kind !== 'Crafting') return;

  workerStopCrafting(state, workerId);
  target.status = workerCraftingStatusStart(recipeId);
}

// Held units of every crafter the load-time prune parked, derived from its own result.
export function workerCraftOrphanedMaterials(
  before: GameStateWorkers,
  after: GameStateWorkers,
): ItemQuantity[] {
  return (Object.keys(before) as WorkerId[]).flatMap((workerId) => {
    const status = before[workerId].status;
    if (status.kind !== 'Crafting' || !status.materialsHeld) return [];
    if (after[workerId]?.status.kind === 'Crafting') return [];
    return craftUnitRefund(status.recipeId);
  });
}

function abandonInvalidCraft(workerId: WorkerId): void {
  updateGamestate((state) => {
    workerStopCrafting(state, workerId);
    const target = state.workers[workerId];
    if (target) target.assignment = null;
    return state;
  });
}

// Takes a unit when waiting (that tick counts as progress), then advances it; true when a unit finishes.
function advanceCraft(
  workerId: WorkerId,
  recipe: RecipeContent,
  ticksPerUnit: number,
): boolean {
  let completed = false;

  updateGamestate((state) => {
    const status = state.workers[workerId]?.status;
    if (status?.kind !== 'Crafting') return state;
    if (!status.materialsHeld && !takeCraftUnit(state, recipe)) return state;

    status.materialsHeld = true;
    status.ticksIntoCraft += 1;
    completed = status.ticksIntoCraft >= ticksPerUnit;
    return state;
  });

  return completed;
}

// The next unit starts at 0 progress, so units never chain within one tick.
function completeCraftUnit(
  workerId: WorkerId,
  recipe: RecipeContent,
  delivered: number,
): void {
  updateGamestate((state) => {
    if (delivered > 0 && 'itemId' in recipe.result) {
      applyMaterialDelta(state, recipe.result.itemId, delivered);
    }

    const status = state.workers[workerId]?.status;
    if (status?.kind !== 'Crafting') return state;

    status.ticksIntoCraft = 0;
    status.materialsHeld = takeCraftUnit(state, recipe);
    return state;
  });
}

function logWorkerCraft(
  worker: WorkerContent,
  recipe: RecipeContent,
  delivered: number,
): void {
  const item =
    'itemId' in recipe.result
      ? getEntry<ItemContent>(recipe.result.itemId)
      : undefined;
  if (!item) return;

  if (delivered === 0) {
    categoryMessageLog(
      'Craft',
      'Worker Crafting',
      `${worker.name} failed to craft ${recipe.name}.`,
    );
    return;
  }

  categoryMessageLog(
    'Craft',
    'Worker Crafting',
    `${worker.name} crafted ${ITEM_ICON_TOKEN}${itemDropHtml(item, delivered)}!`,
    { sprite: item.sprite, spritesheet: 'item' },
  );
}

export function workerCraftingProcessTick(workerId: WorkerId): void {
  const worker = gamestate().workers[workerId];
  const status = worker?.status;
  if (!worker || status?.kind !== 'Crafting') return;

  const content = getEntry<WorkerContent>(workerId);
  const recipe = getEntry<RecipeContent>(status.recipeId);
  if (
    !content ||
    !recipe ||
    !workerCraftAssignmentIsValid(workerId, worker.level, status)
  ) {
    abandonInvalidCraft(workerId);
    return;
  }

  const { craftSpeed } = workerStatsForLevel(content, worker.level);
  if (
    !advanceCraft(workerId, recipe, workerCraftTicksPerUnit(recipe, craftSpeed))
  )
    return;

  const delivered = recipeResultRollSucceeds(recipe)
    ? recipeResultQuantity(recipe)
    : 0;
  completeCraftUnit(workerId, recipe, delivered);
  logWorkerCraft(content, recipe, delivered);

  if (workerLevelInRange(recipeWorkerLevelRange(recipe), worker.level)) {
    workerGainXp(workerId, 1);
  }
}
