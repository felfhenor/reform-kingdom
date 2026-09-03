import { ensureArray } from '@helpers/content/ensure-helpers-core';
import type {
  ItemId,
  RecipeContent,
  RecipeId,
  RecipeRequirement,
  RecipeRequirementCollectible,
  RecipeRequirementEquipment,
  RecipeRequirementItem,
  TradeskillId,
} from '../../interfaces';

function ensureRecipeRequirement(
  requirement: Partial<RecipeRequirementItem> &
    Partial<RecipeRequirementEquipment> &
    Partial<RecipeRequirementCollectible> = {},
): RecipeRequirement {
  if (requirement.equipmentId) {
    return { equipmentId: requirement.equipmentId };
  }

  if (requirement.collectibleId) {
    return { collectibleId: requirement.collectibleId };
  }

  return {
    itemId: requirement.itemId ?? ('UNKNOWN' as ItemId),
    quantity: requirement.quantity ?? 1,
  };
}

export function ensureRecipe(
  recipe: Partial<RecipeContent>,
): Required<RecipeContent> {
  return {
    id: recipe.id ?? ('UNKNOWN' as RecipeId),
    name: recipe.name ?? 'UNKNOWN',
    __type: 'recipe',
    result: recipe.result ?? { itemId: 'UNKNOWN' as ItemId, quantity: 1 },
    requirements: ensureArray(recipe.requirements, ensureRecipeRequirement),
    tradeskillId: recipe.tradeskillId ?? ('UNKNOWN' as TradeskillId),
    minTradeskillLevel: recipe.minTradeskillLevel ?? 1,
    maxTradeskillLevel: recipe.maxTradeskillLevel ?? 1,
    tradeskillXP: recipe.tradeskillXP ?? 0,
    craftTime: recipe.craftTime ?? 60,
    tokenUnlockCost: recipe.tokenUnlockCost ?? 3,
  };
}
