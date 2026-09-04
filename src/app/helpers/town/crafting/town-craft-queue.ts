import { getEntriesByType, getEntry } from '@helpers/content/content';
import { craftXpChance } from '@helpers/crafting/tradeskill';
import { newEquipmentItem } from '@helpers/item/equipment';
import { rngSucceedsChance, rngUuid } from '@helpers/rng';
import { updateGamestate } from '@helpers/state-game';
import { townPickRecipeToQueue } from '@helpers/town/crafting/town-craft-pick';
import { townTradeskillLeveledUp } from '@helpers/town/crafting/town-craft-level';
import { applyTownStockAdd } from '@helpers/town/shop/town-stock';
import { townShopItemCap } from '@helpers/town/shop/town-shop-access';
import { applyTownMaterialDelta } from '@helpers/town/town-materials';
import {
  isTownDueForUpdate,
  markTownSubsystemProcessed,
} from '@helpers/town/town-tick';
import type {
  CraftQueueEntryId,
  GameState,
  RecipeContent,
  RecipeResult,
  TownContent,
  TownCraftQueueEntry,
  TownId,
  TownNodeState,
  TownStockEntry,
} from '@interfaces';

// Runs every tick once activated, same reasoning as WORKER_TICK_INTERVAL - craft progress is continuous.
const CRAFT_TICK_INTERVAL = 1;

// A result that stacks onto an existing item entry (applyTownStockAdd's own rule) never needs a free slot.
function craftResultNeedsNewSlot(
  stock: TownStockEntry[],
  result: RecipeResult,
): boolean {
  if ('itemId' in result) {
    return !stock.some(
      (entry) => 'itemId' in entry && entry.itemId === result.itemId,
    );
  }
  return true;
}

// Grants the recipe's result unconditionally - the caller has already decided the craft succeeds.
function grantCraftedStock(
  state: GameState,
  townId: TownId,
  recipe: RecipeContent,
): void {
  const cap = townShopItemCap(townId);

  if ('itemId' in recipe.result) {
    applyTownStockAdd(
      state,
      townId,
      { itemId: recipe.result.itemId, quantity: recipe.result.quantity ?? 1 },
      cap,
    );
    return;
  }

  if ('equipmentId' in recipe.result) {
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
  const building = target.tradeskills[entry.tradeskillId];
  if (!building) return true; // orphaned tradeskill - drop the entry defensively

  // Unlike the player (whose result can whiff on recipe.result.chance), a town's craft always succeeds.
  if (
    craftResultNeedsNewSlot(target.stock, recipe.result) &&
    target.stock.length >= townShopItemCap(town.id)
  ) {
    return false;
  }

  grantCraftedStock(state, town.id, recipe);

  // Mirrors the player's resolveCraftUnit: XP odds taper off as the tradeskill outlevels the recipe.
  const xpChance = craftXpChance(recipe, building.level);
  const grantsXp = recipe.tradeskillXP > 0 && rngSucceedsChance(xpChance);
  if (grantsXp) {
    target.tradeskills = {
      ...target.tradeskills,
      [entry.tradeskillId]: townTradeskillLeveledUp(
        building,
        recipe.tradeskillXP,
        town.crafting.maxTradeskillLevel,
      ),
    };
  }

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

  const craftTime = recipe.craftTime * town.crafting.craftingDurationMultiplier;
  const ticksIntoCraft = entry.ticksIntoCraft + 1;
  if (ticksIntoCraft < craftTime) return { ...entry, ticksIntoCraft };

  const completed = resolveQueueEntryCompletion(state, town, target, entry, recipe);
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
  if (target.craftQueue.length >= town.crafting.maxQueueSize) return;
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
