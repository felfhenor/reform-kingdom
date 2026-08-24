import {
  analyticsSafeSegment,
  analyticsSendDesignEvent,
} from '@helpers/analytics';
import { armoryAdd, armoryGet } from '@helpers/armory';
import {
  collectiblesAdd,
  isCollectibleDiscovered,
} from '@helpers/collectibles';
import {
  collectibleDropHtml,
  craftMessageLog,
  equipmentDropHtml,
  itemDropHtml,
} from '@helpers/combat-log';
import { getEntry } from '@helpers/content';
import {
  addMaterial,
  applyMaterialDelta,
  getMaterialQuantity,
} from '@helpers/materials';
import { isRecipeCraftable } from '@helpers/recipes';
import { researchCraftBonusXp } from '@helpers/research/research-effects';
import { rngSucceedsChance, rngUuid } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import {
  craftXpChance,
  tradeskillBuilding,
  tradeskillBuildingIn,
  tradeskillGainXp,
  tradeskillIdForName,
  tradeskillMaxQueueSize,
} from '@helpers/tradeskill';
import type {
  CollectibleContent,
  CraftQueueEntry,
  CraftQueueEntryId,
  EquipmentContent,
  EquipmentItem,
  EquipmentItemId,
  GameState,
  ItemContent,
  RecipeContent,
  RecipeId,
  RecipeRequirement,
  RecipeRequirementEquipment,
  RecipeRequirementItem,
  Tradeskill,
} from '@interfaces';
import { ALL_TRADESKILLS } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

const MAX_CRAFTABLE_CAP = 99;

export function requirementAvailable(
  requirement: RecipeRequirementItem | RecipeRequirementEquipment,
): number {
  if ('itemId' in requirement) return getMaterialQuantity(requirement.itemId);

  return armoryGet().filter(
    (item) => item.equipmentId === requirement.equipmentId,
  ).length;
}

function requirementNeeded(
  requirement: RecipeRequirementItem | RecipeRequirementEquipment,
): number {
  return 'itemId' in requirement ? requirement.quantity : 1;
}

function isConsumedRequirement(
  requirement: RecipeRequirement,
): requirement is RecipeRequirementItem | RecipeRequirementEquipment {
  return !('collectibleId' in requirement);
}

function recipeResultCollectibleId(recipe: RecipeContent) {
  return 'collectibleId' in recipe.result
    ? recipe.result.collectibleId
    : undefined;
}

// A recipe that crafts a collectible can only ever be crafted once - blocked
// once the collectible is already owned, or already sitting in the queue
// (so a batch can't queue two before the first even finishes).
function isUniqueCollectibleResultBlocked(
  recipe: RecipeContent,
  tradeskill: Tradeskill,
): boolean {
  const collectibleId = recipeResultCollectibleId(recipe);
  if (!collectibleId) return false;

  if (isCollectibleDiscovered(collectibleId)) return true;

  return tradeskillBuilding(tradeskill).queue.some(
    (entry) => entry.recipeId === recipe.id,
  );
}

// Resource-based ceiling from item/equipment requirements, gated to 0 if any
// collectible requirement (a possession gate, not consumed) is unmet, and
// capped to at most 1 if the recipe's result is itself a unique collectible.
export function craftMaxCraftableQuantity(
  recipe: RecipeContent,
  tradeskill: Tradeskill,
): number {
  const collectibleGateUnmet = recipe.requirements.some(
    (requirement) =>
      'collectibleId' in requirement &&
      !isCollectibleDiscovered(requirement.collectibleId),
  );
  if (collectibleGateUnmet) return 0;

  const consumedRequirements = recipe.requirements.filter(
    isConsumedRequirement,
  );

  const resourcesConsumed =
    Math.min(
      ...consumedRequirements.map((requirement) =>
        Math.floor(
          requirementAvailable(requirement) / requirementNeeded(requirement),
        ),
      ),
    ) ?? 0;

  const resourceLimit =
    consumedRequirements.length === 0
      ? MAX_CRAFTABLE_CAP
      : clamp(resourcesConsumed, 0, MAX_CRAFTABLE_CAP);
  const safeResourceLimit = Number.isFinite(resourceLimit) ? resourceLimit : 0;

  if (isUniqueCollectibleResultBlocked(recipe, tradeskill)) return 0;
  if (recipeResultCollectibleId(recipe)) return Math.min(safeResourceLimit, 1);

  return safeResourceLimit;
}

// Mutates `state` directly - only ever called from inside a single
// `updateGamestate` callback (see `craftQueueStart`/`craftQueueRemove`), so
// every requirement in a batch is applied atomically in one state commit.
function applyRequirementQuantity(
  state: GameState,
  requirement: RecipeRequirement,
  quantity: number,
  sign: 1 | -1,
): void {
  if ('collectibleId' in requirement) return; // possession gate, never consumed

  if ('itemId' in requirement) {
    applyMaterialDelta(
      state,
      requirement.itemId,
      sign * requirement.quantity * quantity,
    );
    return;
  }

  if (sign > 0) {
    const added: EquipmentItem[] = Array.from({ length: quantity }, () => ({
      id: rngUuid() as EquipmentItemId,
      equipmentId: requirement.equipmentId,
      infusedItemIds: [],
    }));
    state.armory = [...state.armory, ...added];
    return;
  }

  let remaining = quantity;
  state.armory = state.armory.filter((item) => {
    if (item.equipmentId !== requirement.equipmentId || remaining <= 0) {
      return true;
    }
    remaining -= 1;
    return false;
  });
}

// Reserves materials/equipment for the full batch up front (so a queued
// craft can never fail mid-way through for lack of resources), then queues
// the entry. `quantity` is clamped to what's actually craftable.
export function craftQueueStart(
  tradeskill: Tradeskill,
  recipeId: RecipeId,
  quantity: number,
): boolean {
  const recipe = getEntry<RecipeContent>(recipeId);
  const tradeskillId = tradeskillIdForName(tradeskill);
  if (!recipe || !tradeskillId || recipe.tradeskillId !== tradeskillId) {
    return false;
  }
  if (!isRecipeCraftable(recipeId)) return false;

  const building = tradeskillBuilding(tradeskill);
  if (building.level < recipe.minTradeskillLevel) return false;
  if (building.queue.length >= tradeskillMaxQueueSize(building.level)) {
    return false;
  }

  const clampedQuantity = clamp(
    Math.floor(quantity),
    1,
    craftMaxCraftableQuantity(recipe, tradeskill),
  );
  if (clampedQuantity <= 0) return false;

  updateGamestate((state) => {
    recipe.requirements.forEach((requirement) => {
      applyRequirementQuantity(state, requirement, clampedQuantity, -1);
    });

    const entry: CraftQueueEntry = {
      id: rngUuid() as CraftQueueEntryId,
      recipeId,
      quantityTotal: clampedQuantity,
      quantityCompleted: 0,
      ticksIntoCraft: 0,
    };

    const building = tradeskillBuildingIn(state, tradeskillId);
    state.tradeskills[tradeskillId] = {
      ...building,
      queue: [...building.queue, entry],
    };

    return state;
  });

  analyticsSendDesignEvent(
    `Kingdom:Craft:Queue:${analyticsSafeSegment(recipe.name)}`,
  );
  return true;
}

// Refunds only the unconsumed remainder of the batch - units already
// crafted keep the materials/equipment they used.
export function craftQueueRemove(
  tradeskill: Tradeskill,
  queueEntryId: CraftQueueEntryId,
): void {
  const tradeskillId = tradeskillIdForName(tradeskill);
  if (!tradeskillId) return;

  updateGamestate((state) => {
    const building = tradeskillBuildingIn(state, tradeskillId);
    const entry = building.queue.find((queued) => queued.id === queueEntryId);
    if (!entry) return state;

    const recipe = getEntry<RecipeContent>(entry.recipeId);
    const remaining = entry.quantityTotal - entry.quantityCompleted;

    if (recipe && remaining > 0) {
      recipe.requirements.forEach((requirement) => {
        applyRequirementQuantity(state, requirement, remaining, 1);
      });
    }

    state.tradeskills[tradeskillId] = {
      ...building,
      queue: building.queue.filter((queued) => queued.id !== queueEntryId),
    };

    return state;
  });
}

// An item result with a `chance` roll can whiff entirely, producing nothing
// - but the tradeskill still attempted the craft, so XP is granted either way
// (see `resolveCraftUnit`).
function grantCraftResult(tradeskill: Tradeskill, recipe: RecipeContent): void {
  const { chance } = recipe.result;

  if (chance !== undefined && !rngSucceedsChance(chance)) {
    craftMessageLog(
      tradeskill,
      `${tradeskill} failed to craft ${recipe.name}.`,
    );
    return;
  }

  if ('itemId' in recipe.result) {
    const { itemId } = recipe.result;
    const quantity = recipe.result.quantity ?? 1;

    addMaterial(itemId, quantity);

    const item = getEntry<ItemContent>(itemId);
    if (item) {
      craftMessageLog(
        tradeskill,
        `${tradeskill} crafted ${itemDropHtml(item, quantity)}!`,
      );
    }
    return;
  }

  if ('equipmentId' in recipe.result) {
    const { equipmentId } = recipe.result;

    armoryAdd(equipmentId);

    const equipment = getEntry<EquipmentContent>(equipmentId);
    if (equipment) {
      craftMessageLog(
        tradeskill,
        `${tradeskill} crafted ${equipmentDropHtml(equipment)}!`,
      );
    }
    return;
  }

  const { collectibleId } = recipe.result;
  collectiblesAdd(collectibleId, 1);

  const collectible = getEntry<CollectibleContent>(collectibleId);
  if (collectible) {
    craftMessageLog(
      tradeskill,
      `${tradeskill} crafted ${collectibleDropHtml(collectible)}!`,
    );
  }
}

// Keen Eye/Sharper Eye/Deeper Insight's combined chance/bonus (see
// research-effects.ts) - a separate roll from the recipe's own skill-up
// chance above, only relevant when the recipe trains a tradeskill at all.
function grantResearchBonusCraftXp(tradeskill: Tradeskill): void {
  const { chance, bonusXp } = researchCraftBonusXp();
  if (chance <= 0 || bonusXp <= 0 || !rngSucceedsChance(chance)) return;

  tradeskillGainXp(tradeskill, bonusXp);
}

function resolveCraftUnit(tradeskill: Tradeskill, recipe: RecipeContent): void {
  grantCraftResult(tradeskill, recipe);
  analyticsSendDesignEvent(
    `Kingdom:Craft:Complete:${analyticsSafeSegment(recipe.name)}`,
  );

  if (recipe.tradeskillXP > 0) {
    const chance = craftXpChance(recipe, tradeskillBuilding(tradeskill).level);
    if (rngSucceedsChance(chance)) {
      tradeskillGainXp(tradeskill, recipe.tradeskillXP);
    }
    grantResearchBonusCraftXp(tradeskill);
  }
}

function advanceQueueEntry(
  tradeskill: Tradeskill,
  entryId: CraftQueueEntryId,
): void {
  const tradeskillId = tradeskillIdForName(tradeskill);
  if (!tradeskillId) return;

  updateGamestate((state) => {
    const building = tradeskillBuildingIn(state, tradeskillId);
    const index = building.queue.findIndex((queued) => queued.id === entryId);
    if (index === -1) return state;

    const completedEntry = building.queue[index];
    const quantityCompleted = completedEntry.quantityCompleted + 1;

    const queue =
      quantityCompleted >= completedEntry.quantityTotal
        ? building.queue.filter((queued) => queued.id !== entryId)
        : building.queue.map((queued, i) =>
            i === index
              ? { ...queued, quantityCompleted, ticksIntoCraft: 0 }
              : queued,
          );

    state.tradeskills[tradeskillId] = { ...building, queue };
    return state;
  });
}

export function craftProcessTick(): void {
  ALL_TRADESKILLS.forEach((tradeskill) => {
    const entry = tradeskillBuilding(tradeskill).queue[0];
    if (!entry) return;

    const recipe = getEntry<RecipeContent>(entry.recipeId);
    if (!recipe) return;

    const tradeskillId = tradeskillIdForName(tradeskill);
    if (!tradeskillId) return;

    const ticksIntoCraft = entry.ticksIntoCraft + 1;

    if (ticksIntoCraft < recipe.craftTime) {
      updateGamestate((state) => {
        const building = tradeskillBuildingIn(state, tradeskillId);
        const index = building.queue.findIndex(
          (queued) => queued.id === entry.id,
        );
        if (index === -1) return state;

        state.tradeskills[tradeskillId] = {
          ...building,
          queue: building.queue.map((queued, i) =>
            i === index ? { ...queued, ticksIntoCraft } : queued,
          ),
        };
        return state;
      });
      return;
    }

    resolveCraftUnit(tradeskill, recipe);
    advanceQueueEntry(tradeskill, entry.id);
  });
}

