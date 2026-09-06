import { getEntriesByType, getEntry } from '@helpers/content/content';
import { newEquipmentItem } from '@helpers/item/equipment';
import { rngSucceedsChance, rngUuid } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import { townPickRecipeToQueue } from '@helpers/town/crafting/town-craft-pick';
import { resetTownSpecialtyPriority } from '@helpers/town/crafting/town-craft-priority-state';
import { townCraftQueueSize } from '@helpers/town/crafting/town-craft-queue-size';
import {
  RAID_LOSS_CRAFT_DEBUFF_MULTIPLIER,
  townCraftTimeFor,
} from '@helpers/town/crafting/town-craft-time';
import { isTownCraftDebuffActive } from '@helpers/town/raid/town-raid-state';
import { townShopItemCap } from '@helpers/town/shop/town-shop-access';
import { applyTownStockAdd } from '@helpers/town/shop/town-stock';
import { applyTownMaterialDelta } from '@helpers/town/town-materials';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import type {
  CraftQueueEntryId,
  GameState,
  RecipeContent,
  TownContent,
  TownCraftQueueEntry,
  TownId,
  TownNodeState,
} from '@interfaces';

// Runs every tick once activated, same reasoning as WORKER_TICK_INTERVAL - craft progress is continuous.
const CRAFT_TICK_INTERVAL = 1;

// Grants the result unconditionally (the caller already decided the craft succeeds) - a material result
// feeds the materials stash directly, only equipment lands in stock.
function grantCraftedResult(
  state: GameState,
  townId: TownId,
  recipe: RecipeContent,
): void {
  if ('itemId' in recipe.result) {
    applyTownMaterialDelta(
      state,
      townId,
      recipe.result.itemId,
      recipe.result.quantity ?? 1,
    );
    return;
  }

  if ('equipmentId' in recipe.result) {
    const cap = townShopItemCap(townId);
    applyTownStockAdd(
      state,
      townId,
      { equipmentItem: newEquipmentItem(recipe.result.equipmentId) },
      cap,
    );
  }
}

// Returns false to signal "hold" - the entry stays in the queue untouched and retries next tick.
function resolveQueueEntryCompletion(
  state: GameState,
  town: TownContent,
  target: TownNodeState,
  entry: TownCraftQueueEntry,
  recipe: RecipeContent,
): boolean {
  if (!target.tradeskills[entry.tradeskillId]) return true; // orphaned tradeskill - drop the entry defensively

  if (
    'equipmentId' in recipe.result &&
    target.stock.length >= townShopItemCap(town.id)
  ) {
    return false;
  }

  grantCraftedResult(state, town.id, recipe);
  resetTownSpecialtyPriority(target, recipe.id);

  return true;
}

// Returns the entry to keep in the queue (advanced or held), or undefined once it's actually complete.
function advanceQueueEntry(
  state: GameState,
  town: TownContent,
  target: TownNodeState,
  entry: TownCraftQueueEntry,
): TownCraftQueueEntry | undefined {
  const recipe = getEntry<RecipeContent>(entry.recipeId);
  if (!recipe) return undefined; // unresolvable - drop defensively

  const debuffMultiplier = isTownCraftDebuffActive(target)
    ? RAID_LOSS_CRAFT_DEBUFF_MULTIPLIER
    : 1;
  const level = target.tradeskills[entry.tradeskillId]?.level ?? 1;
  const craftTime = townCraftTimeFor(recipe, town, level, debuffMultiplier);
  const ticksIntoCraft = entry.ticksIntoCraft + 1;
  if (ticksIntoCraft < craftTime) return { ...entry, ticksIntoCraft };

  const completed = resolveQueueEntryCompletion(
    state,
    town,
    target,
    entry,
    recipe,
  );
  return completed ? undefined : { ...entry, ticksIntoCraft };
}

// All queue entries advance/complete together in one pass - a town has multiple workers crafting in tandem, not one at a time.
function processExistingQueue(
  state: GameState,
  town: TownContent,
  target: TownNodeState,
): void {
  const nextQueue: TownCraftQueueEntry[] = [];

  target.craftQueue.forEach((entry) => {
    const kept = advanceQueueEntry(state, town, target, entry);
    if (kept) nextQueue.push(kept);
  });

  target.craftQueue = nextQueue;
}

// Below craftingChanceItemThreshold (or the queue is empty), queue every chance it can, materials permitting;
// at/above it, only craftingChanceOnTick% per tick - gives players a window to see stock before it's replaced.
function shouldAttemptQueue(town: TownContent, queueLength: number): boolean {
  if (queueLength === 0) return true;
  if (queueLength < town.crafting.craftingChanceItemThreshold) return true;
  return rngSucceedsChance(town.crafting.craftingChanceOnTick);
}

function maybeQueueNewCraft(
  state: GameState,
  town: TownContent,
  target: TownNodeState,
): void {
  if (target.craftQueue.length >= townCraftQueueSize(town)) return;
  if (!shouldAttemptQueue(town, target.craftQueue.length)) return;

  const pick = townPickRecipeToQueue(town);
  if (!pick) return;

  pick.recipe.requirements.forEach((requirement) => {
    if ('itemId' in requirement) {
      applyTownMaterialDelta(
        state,
        town.id,
        requirement.itemId,
        -requirement.quantity,
      );
    }
  });

  target.craftQueue = [
    ...target.craftQueue,
    {
      id: rngUuid() as CraftQueueEntryId,
      tradeskillId: pick.tradeskillId,
      recipeId: pick.recipe.id,
      ticksIntoCraft: 0,
    },
  ];
}

function processTownCraftQueue(town: TownContent): void {
  updateGamestate((state) => {
    const target = state.world.towns[town.id];
    if (!target) return state;

    processExistingQueue(state, town, target);
    maybeQueueNewCraft(state, town, target);

    return state;
  });
}

export function townCraftProcessTick(): void {
  getEntriesByType<TownContent>('town').forEach((town) => {
    if (!isTownDueForUpdate(town.id, 'craft', CRAFT_TICK_INTERVAL)) return;

    processTownCraftQueue(town);
    markTownSubsystemProcessed(town.id, 'craft');
  });
}
