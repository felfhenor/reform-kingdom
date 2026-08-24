import { getEntriesByType, getEntry } from '@helpers/content';
import {
  craftMaxCraftableQuantity,
  requirementAvailable,
} from '@helpers/crafting/crafting-queue';
import {
  isRecipeCraftable,
  recipeBackdropSprite,
  recipeResultContent,
  recipeResultOwnedQuantity,
  recipeResultSpritesheet,
} from '@helpers/crafting/recipes';
import {
  craftXpChance,
  craftXpChanceTier,
  tradeskillBuilding,
  tradeskillIdForName,
} from '@helpers/crafting/tradeskill';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
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
  TradeskillId,
} from '@interfaces';
import { RARITY_PRIORITY } from '@interfaces';
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

// Only recipes the building has reached and that pass isRecipeCraftable are
// shown, sorted by recipe level (not item level) so entries stay put as craftability changes.
export function getCraftableRecipeEntries(
  tradeskill: Tradeskill,
): CraftRecipeEntry[] {
  const building = tradeskillBuilding(tradeskill);
  const backdropSprite = recipeBackdropSprite();
  const tradeskillId = tradeskillIdForName(tradeskill);

  const entries: CraftRecipeEntry[] = getEntriesByType<RecipeContent>('recipe')
    .filter(
      (recipe) =>
        recipe.tradeskillId === tradeskillId &&
        building.level >= recipe.minTradeskillLevel &&
        isRecipeCraftable(recipe.id),
    )
    .map((recipe) => {
      const resultContent = recipeResultContent(recipe);
      const resultSpritesheet = recipeResultSpritesheet(recipe);

      return {
        recipe,
        resultContent,
        resultSpritesheet,
        resultDisplay: resultContent
          ? itemPreviewDisplay(resultContent, resultSpritesheet)
          : undefined,
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

// Denominator for the queue progress bar; craftQueueTicksRemaining is what's left.
export function craftQueueTotalTicks(tradeskill: Tradeskill): number {
  return sumBy(tradeskillBuilding(tradeskill).queue, (entry) => {
    const recipe = getEntry<RecipeContent>(entry.recipeId);
    if (!recipe) return 0;

    return recipe.craftTime * entry.quantityTotal;
  });
}

// Not queue.length - a single slot can be crafting many units of one item.
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

  (Object.keys(pruned) as TradeskillId[]).forEach((tradeskillId) => {
    const building = pruned[tradeskillId];
    pruned[tradeskillId] = {
      ...building,
      queue: building.queue.filter(
        (entry) => !!getEntry<RecipeContent>(entry.recipeId),
      ),
    };
  });

  return pruned;
}
