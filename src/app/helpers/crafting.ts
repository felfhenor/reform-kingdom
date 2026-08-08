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
import { getEntriesByType, getEntry } from '@helpers/content';
import { addMaterial, getMaterialQuantity } from '@helpers/materials';
import { roundToNearest10 } from '@helpers/number';
import {
  isRecipeCraftable,
  recipeBackdropSprite,
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers/recipes';
import { rngSucceedsChance, rngUuid } from '@helpers/rng';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  ChanceTier,
  CollectibleContent,
  CraftQueueEntry,
  CraftQueueEntryId,
  CraftRecipeEntry,
  CraftRequirementEntry,
  EquipmentContent,
  EquipmentItem,
  EquipmentItemId,
  GameState,
  GameStateTradeskills,
  ItemContent,
  RecipeContent,
  RecipeId,
  RecipeRequirement,
  RecipeRequirementEquipment,
  RecipeRequirementItem,
  Tradeskill,
  TradeskillBuildingState,
  TradeskillLevelRequirementContent,
} from '@interfaces';
import { ALL_TRADESKILLS, RARITY_PRIORITY } from '@interfaces';
import { clamp, orderBy, sumBy } from 'es-toolkit/compat';

export const TRADESKILL_MAX_LEVEL = 50;
const MAX_CRAFTABLE_CAP = 99;
const TRADESKILL_XP_START = 10;
const TRADESKILL_XP_END = 5000;
const XP_CURVE_EASE = 1.5;

// Tunable XP curve: eases in from 10 XP at level 1 up to 5,000 XP at the
// level cap, rounded to the nearest 10 for clean numbers. The
// `progress ** 1.5` ease keeps the early-level jumps gentle instead of a
// straight line's constant per-level step dominating a tiny starting value.
export function tradeskillXpForLevel(level: number): number {
  const progress = (level - 1) / (TRADESKILL_MAX_LEVEL - 1);
  const xp =
    TRADESKILL_XP_START +
    (TRADESKILL_XP_END - TRADESKILL_XP_START) * progress ** XP_CURVE_EASE;
  return roundToNearest10(xp);
}

// Default 2 (1 active + 1 queued), +1 every 5 levels, capped at 10.
export function tradeskillMaxQueueSize(level: number): number {
  return Math.min(10, 2 + Math.floor(level / 5));
}

export function tradeskillBuilding(
  tradeskill: Tradeskill,
): TradeskillBuildingState {
  return gamestate().tradeskills[tradeskill];
}

function levelRequirementFor(
  tradeskill: Tradeskill,
  level: number,
): TradeskillLevelRequirementContent | undefined {
  return getEntriesByType<TradeskillLevelRequirementContent>(
    'tradeskilllevelrequirement',
  ).find((entry) => entry.tradeskill === tradeskill && entry.level === level);
}

export function tradeskillLevelGateSatisfied(
  tradeskill: Tradeskill,
  level: number,
): boolean {
  const requirement = levelRequirementFor(tradeskill, level);
  if (!requirement) return true;

  return isCollectibleDiscovered(requirement.requiredCollectibleId);
}

// The requirement blocking the *next* level, only while it's still
// unsatisfied - once the collectible is found this returns undefined and the
// building levels up on its next XP grant (see `tradeskillLeveledUp`).
export function tradeskillActiveGate(
  tradeskill: Tradeskill,
): TradeskillLevelRequirementContent | undefined {
  const nextLevel = tradeskillBuilding(tradeskill).level + 1;
  if (tradeskillLevelGateSatisfied(tradeskill, nextLevel)) return undefined;

  return levelRequirementFor(tradeskill, nextLevel);
}

// Mirrors `characterLeveledUp` in `party.ts`, but each level also requires
// `tradeskillLevelGateSatisfied` - if XP is enough but the gate isn't met,
// XP holds at the cap (no loss) rather than levelling, and releases the next
// time XP is granted after the collectible is found.
function tradeskillLeveledUp(
  building: TradeskillBuildingState,
  tradeskill: Tradeskill,
  amount: number,
): TradeskillBuildingState {
  let level = building.level;
  let current = building.xp.current + amount;
  let maximum = building.xp.maximum;

  while (
    level < TRADESKILL_MAX_LEVEL &&
    current >= maximum &&
    tradeskillLevelGateSatisfied(tradeskill, level + 1)
  ) {
    current -= maximum;
    level += 1;
    maximum = tradeskillXpForLevel(level);
  }

  if (current > maximum) current = maximum;

  return { ...building, level, xp: { current, maximum } };
}

// Rescales every tradeskill's xp.maximum to match the current
// `tradeskillXpForLevel` curve, clamping `current` down if it now exceeds
// the new maximum. Never forces a level-up itself - a building sitting
// exactly at its new maximum simply levels up on its next real XP grant
// (see `tradeskillLeveledUp`).
export function retrofitTradeskillXp(
  tradeskills: GameStateTradeskills,
): GameStateTradeskills {
  const retrofitted = { ...tradeskills };

  ALL_TRADESKILLS.forEach((tradeskill) => {
    const building = retrofitted[tradeskill];
    const maximum = tradeskillXpForLevel(building.level);

    retrofitted[tradeskill] = {
      ...building,
      xp: { current: Math.min(building.xp.current, maximum), maximum },
    };
  });

  return retrofitted;
}

export function tradeskillGainXp(tradeskill: Tradeskill, amount: number): void {
  if (amount <= 0) return;

  updateGamestate((state) => {
    state.tradeskills[tradeskill] = tradeskillLeveledUp(
      state.tradeskills[tradeskill],
      tradeskill,
      amount,
    );
    return state;
  });
}

// WoW-style skill-up odds: fresh (< 50% through the recipe's level range) is
// guaranteed, the back half is a coin flip, the last quarter is a long shot,
// and a building that has out-levelled the recipe entirely gets nothing. A
// recipe with a single-level range (min === max) is always exactly "fresh"
// the moment it's visible, so it's always guaranteed too.
export function craftXpChance(
  recipe: RecipeContent,
  buildingLevel: number,
): number {
  const { minTradeskillLevel: min, maxTradeskillLevel: max } = recipe;
  if (max <= min) return 100;

  const progress = (buildingLevel - min) / (max - min);
  if (progress >= 1) return 0;
  if (progress >= 0.75) return 25;
  if (progress >= 0.5) return 50;
  return 100;
}

export function craftXpChanceTier(
  recipe: RecipeContent,
  buildingLevel: number,
): ChanceTier {
  const chance = craftXpChance(recipe, buildingLevel);

  if (chance >= 100) return 'Guaranteed';
  if (chance >= 50) return 'Likely';
  if (chance >= 25) return 'Possible';
  return 'Trivial';
}

function requirementAvailable(
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
    const existing = state.materials[requirement.itemId];
    const next = Math.max(
      0,
      (existing?.quantity ?? 0) + sign * requirement.quantity * quantity,
    );

    if (next === 0) {
      delete state.materials[requirement.itemId];
    } else {
      state.materials[requirement.itemId] = {
        quantity: next,
        foundAt: existing?.foundAt ?? Date.now(),
      };
    }
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
  if (!recipe || recipe.tradeskill !== tradeskill) return false;
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

    state.tradeskills[tradeskill] = {
      ...state.tradeskills[tradeskill],
      queue: [...state.tradeskills[tradeskill].queue, entry],
    };

    return state;
  });

  return true;
}

// Refunds only the unconsumed remainder of the batch - units already
// crafted keep the materials/equipment they used.
export function craftQueueRemove(
  tradeskill: Tradeskill,
  queueEntryId: CraftQueueEntryId,
): void {
  updateGamestate((state) => {
    const building = state.tradeskills[tradeskill];
    const entry = building.queue.find((queued) => queued.id === queueEntryId);
    if (!entry) return state;

    const recipe = getEntry<RecipeContent>(entry.recipeId);
    const remaining = entry.quantityTotal - entry.quantityCompleted;

    if (recipe && remaining > 0) {
      recipe.requirements.forEach((requirement) => {
        applyRequirementQuantity(state, requirement, remaining, 1);
      });
    }

    state.tradeskills[tradeskill] = {
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
  collectiblesAdd(collectibleId, 1, tradeskill);

  const collectible = getEntry<CollectibleContent>(collectibleId);
  if (collectible) {
    craftMessageLog(
      tradeskill,
      `${tradeskill} crafted ${collectibleDropHtml(collectible)}!`,
    );
  }
}

function resolveCraftUnit(tradeskill: Tradeskill, recipe: RecipeContent): void {
  grantCraftResult(tradeskill, recipe);

  const chance = craftXpChance(recipe, tradeskillBuilding(tradeskill).level);
  if (recipe.tradeskillXP > 0 && rngSucceedsChance(chance)) {
    tradeskillGainXp(tradeskill, recipe.tradeskillXP);
  }
}

function advanceQueueEntry(
  tradeskill: Tradeskill,
  entryId: CraftQueueEntryId,
): void {
  updateGamestate((state) => {
    const building = state.tradeskills[tradeskill];
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

    state.tradeskills[tradeskill] = { ...building, queue };
    return state;
  });
}

export function craftProcessTick(): void {
  ALL_TRADESKILLS.forEach((tradeskill) => {
    const entry = tradeskillBuilding(tradeskill).queue[0];
    if (!entry) return;

    const recipe = getEntry<RecipeContent>(entry.recipeId);
    if (!recipe) return;

    const ticksIntoCraft = entry.ticksIntoCraft + 1;

    if (ticksIntoCraft < recipe.craftTime) {
      updateGamestate((state) => {
        const building = state.tradeskills[tradeskill];
        const index = building.queue.findIndex(
          (queued) => queued.id === entry.id,
        );
        if (index === -1) return state;

        building.queue = building.queue.map((queued, i) =>
          i === index ? { ...queued, ticksIntoCraft } : queued,
        );
        return state;
      });
      return;
    }

    resolveCraftUnit(tradeskill, recipe);
    advanceQueueEntry(tradeskill, entry.id);
  });
}

// Total ticks remaining across a whole queue - the active entry's remainder
// plus every not-yet-started unit (its own and every queued entry's).
export function craftQueueTicksRemaining(tradeskill: Tradeskill): number {
  return sumBy(tradeskillBuilding(tradeskill).queue, (entry) => {
    const recipe = getEntry<RecipeContent>(entry.recipeId);
    if (!recipe) return 0;

    const remainingUnits = entry.quantityTotal - entry.quantityCompleted;
    const remainingTicksThisUnit = recipe.craftTime - entry.ticksIntoCraft;

    return remainingTicksThisUnit + (remainingUnits - 1) * recipe.craftTime;
  });
}

// Total ticks the whole queue will *ever* take, start to finish - the
// denominator for an overall queue progress bar (`craftQueueTicksRemaining`
// is what's left; this minus that is what's already done).
export function craftQueueTotalTicks(tradeskill: Tradeskill): number {
  return sumBy(tradeskillBuilding(tradeskill).queue, (entry) => {
    const recipe = getEntry<RecipeContent>(entry.recipeId);
    if (!recipe) return 0;

    return recipe.craftTime * entry.quantityTotal;
  });
}

// Total individual units still to be crafted across every queue entry - not
// the same as `queue.length` (the number of *batches*/slots), since a single
// slot can be crafting dozens of the same item.
export function craftQueueUnitsRemaining(tradeskill: Tradeskill): number {
  return sumBy(
    tradeskillBuilding(tradeskill).queue,
    (entry) => entry.quantityTotal - entry.quantityCompleted,
  );
}

function recipeEffectiveLevel(
  recipe: RecipeContent,
  resultContent:
    ItemContent | EquipmentContent | CollectibleContent | undefined,
): number {
  if (resultContent && 'levelRequirement' in resultContent) {
    return resultContent.levelRequirement;
  }

  return recipe.minTradeskillLevel;
}

function buildRequirementEntry(
  requirement: RecipeRequirement,
): CraftRequirementEntry {
  if ('collectibleId' in requirement) {
    return {
      kind: 'collectible',
      content: getEntry<CollectibleContent>(requirement.collectibleId),
      spritesheet: 'collectible',
      quantity: 1,
    };
  }

  if ('equipmentId' in requirement) {
    return {
      kind: 'equipment',
      content: getEntry<EquipmentContent>(requirement.equipmentId),
      spritesheet: 'equipment',
      quantity: 1,
    };
  }

  return {
    kind: 'item',
    content: getEntry<ItemContent>(requirement.itemId),
    spritesheet: 'item',
    quantity: requirement.quantity,
  };
}

const REQUIREMENT_KIND_ORDER: Record<CraftRequirementEntry['kind'], number> = {
  collectible: 0,
  equipment: 1,
  item: 2,
};

// Collectible costs (not consumed) first, then equipment, then materials.
function recipeRequirementEntries(
  recipe: RecipeContent,
): CraftRequirementEntry[] {
  return orderBy(
    recipe.requirements.map(buildRequirementEntry),
    [(entry) => REQUIREMENT_KIND_ORDER[entry.kind]],
    ['asc'],
  );
}

// Only recipes the building has actually reached are shown at all, and only
// once any world-drop gate on the recipe itself is satisfied (see
// `isRecipeCraftable`). Entries that are currently uncraftable (out of
// resources, or a unique collectible already owned/queued) sort to the
// bottom rather than disappearing, so the list stays a stable reference of
// everything unlocked.
export function getCraftableRecipeEntries(
  tradeskill: Tradeskill,
): CraftRecipeEntry[] {
  const building = tradeskillBuilding(tradeskill);
  const backdropSprite = recipeBackdropSprite();

  const entries: CraftRecipeEntry[] = getEntriesByType<RecipeContent>('recipe')
    .filter(
      (recipe) =>
        recipe.tradeskill === tradeskill &&
        building.level >= recipe.minTradeskillLevel &&
        isRecipeCraftable(recipe.id),
    )
    .map((recipe) => {
      const resultContent = recipeResultContent(recipe);

      return {
        recipe,
        resultContent,
        resultSpritesheet: recipeResultSpritesheet(recipe),
        backdropSprite,
        effectiveLevel: recipeEffectiveLevel(recipe, resultContent),
        maxCraftable: craftMaxCraftableQuantity(recipe, tradeskill),
        xp: recipe.tradeskillXP,
        xpChance: craftXpChance(recipe, building.level),
        xpChanceTier: craftXpChanceTier(recipe, building.level),
        requirementEntries: recipeRequirementEntries(recipe),
      };
    });

  return orderBy(
    entries,
    [
      (entry) => (entry.maxCraftable === 0 ? 1 : 0),
      (entry) => entry.effectiveLevel,
      (entry) =>
        entry.resultContent ? RARITY_PRIORITY[entry.resultContent.rarity] : 0,
      (entry) => entry.recipe.name,
    ],
    ['asc', 'asc', 'asc', 'asc'],
  );
}

// Drops any queued crafts whose recipeId no longer resolves to real content
// - e.g. after a recipe is renamed/removed from gamedata.
export function pruneInvalidCraftQueues(
  tradeskills: GameStateTradeskills,
): GameStateTradeskills {
  const pruned = { ...tradeskills };

  ALL_TRADESKILLS.forEach((tradeskill) => {
    const building = pruned[tradeskill];
    pruned[tradeskill] = {
      ...building,
      queue: building.queue.filter(
        (entry) => !!getEntry<RecipeContent>(entry.recipeId),
      ),
    };
  });

  return pruned;
}
