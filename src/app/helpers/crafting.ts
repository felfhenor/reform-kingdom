import {
  craftMaxCraftableQuantity,
  requirementAvailable,
} from '@helpers/crafting-queue';
import { isCollectibleDiscovered } from '@helpers/collectibles';
import { getEntriesByType, getEntry } from '@helpers/content';
import {
  isRecipeCraftable,
  recipeBackdropSprite,
  recipeResultContent,
  recipeResultOwnedQuantity,
  recipeResultSpritesheet,
} from '@helpers/recipes';
import {
  craftXpChance,
  craftXpChanceTier,
  tradeskillBuilding,
} from '@helpers/tradeskill';
import type {
  CollectibleContent,
  CraftRecipeEntry,
  CraftRequirementEntry,
  EquipmentContent,
  GameStateTradeskills,
  ItemContent,
  RecipeContent,
  RecipeRequirement,
  Tradeskill,
} from '@interfaces';
import { ALL_TRADESKILLS, RARITY_PRIORITY } from '@interfaces';
import { orderBy, sumBy } from 'es-toolkit/compat';

function buildRequirementEntry(
  requirement: RecipeRequirement,
): CraftRequirementEntry {
  if ('collectibleId' in requirement) {
    return {
      kind: 'collectible',
      content: getEntry<CollectibleContent>(requirement.collectibleId),
      spritesheet: 'collectible',
      quantity: 1,
      owned: isCollectibleDiscovered(requirement.collectibleId) ? 1 : 0,
    };
  }

  if ('equipmentId' in requirement) {
    return {
      kind: 'equipment',
      content: getEntry<EquipmentContent>(requirement.equipmentId),
      spritesheet: 'equipment',
      quantity: 1,
      owned: requirementAvailable(requirement),
    };
  }

  return {
    kind: 'item',
    content: getEntry<ItemContent>(requirement.itemId),
    spritesheet: 'item',
    quantity: requirement.quantity,
    owned: requirementAvailable(requirement),
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
// `isRecipeCraftable`). Sorted purely by the recipe's own tradeskill level
// descending (highest first) - not the resulting item's equip-level
// requirement, which can diverge from the recipe tier it's actually crafted
// at and would otherwise scatter same-tier recipes apart. This also keeps
// the order stable as craftability changes while the player crafts - entries
// that are currently uncraftable (out of resources, or a unique collectible
// already owned/queued) stay in place rather than jumping to the bottom.
// Callers that want to hide uncraftable entries should filter separately
// rather than relying on sort position.
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
        resultChance: recipe.result.chance ?? 100,
        backdropSprite,
        maxCraftable: craftMaxCraftableQuantity(recipe, tradeskill),
        ownedQuantity: recipeResultOwnedQuantity(recipe),
        xp: recipe.tradeskillXP,
        xpChance: craftXpChance(recipe, building.level),
        xpChanceTier: craftXpChanceTier(recipe, building.level),
        requirementEntries: recipeRequirementEntries(recipe),
      };
    });

  return orderBy(
    entries,
    [
      (entry) => entry.recipe.minTradeskillLevel,
      (entry) =>
        entry.resultContent ? RARITY_PRIORITY[entry.resultContent.rarity] : 0,
      (entry) => entry.recipe.name,
    ],
    ['desc', 'asc', 'asc'],
  );
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
