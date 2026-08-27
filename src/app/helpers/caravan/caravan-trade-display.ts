import { getEntry } from '@helpers/content';
import {
  recipeBackdropSprite,
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers/crafting/recipes';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import type {
  CaravanTokenTrade,
  CaravanTrade,
  CollectibleContent,
  CollectibleId,
  EquipmentContent,
  ItemContent,
  ItemPreviewDisplay,
  RecipeContent,
  RecipeId,
} from '@interfaces';

// Shared by CaravanTrade and CaravanTokenTrade - both are itemId/equipmentId/collectibleId/recipeId unions.
function resolveRewardDisplay(reward: {
  itemId?: ItemContent['id'];
  equipmentId?: EquipmentContent['id'];
  collectibleId?: CollectibleId;
  recipeId?: RecipeId;
}): ItemPreviewDisplay | undefined {
  if (reward.itemId) {
    const item = getEntry<ItemContent>(reward.itemId);
    return item ? itemPreviewDisplay(item, 'item') : undefined;
  }

  if (reward.equipmentId) {
    const equipment = getEntry<EquipmentContent>(reward.equipmentId);
    return equipment ? itemPreviewDisplay(equipment, 'equipment') : undefined;
  }

  if (reward.collectibleId) {
    const collectible = getEntry<CollectibleContent>(reward.collectibleId);
    return collectible
      ? itemPreviewDisplay(collectible, 'collectible')
      : undefined;
  }

  if (reward.recipeId) {
    const recipe = getEntry<RecipeContent>(reward.recipeId);
    const result = recipe ? recipeResultContent(recipe) : undefined;
    if (!recipe || !result) return undefined;

    // Recipe's own name, not the crafted item's - it grants the blueprint.
    return {
      ...itemPreviewDisplay(result, recipeResultSpritesheet(recipe)),
      name: recipe.name,
      backdropSprite: recipeBackdropSprite(),
    };
  }

  return undefined;
}

// Mirrors rewardContentInfo in world-nodes.ts, plus the tooltip fields that helper doesn't carry.
export function caravanTradeDisplay(
  trade: CaravanTrade,
): ItemPreviewDisplay | undefined {
  return resolveRewardDisplay(trade);
}

export function caravanTokenTradeDisplay(
  trade: CaravanTokenTrade,
): ItemPreviewDisplay | undefined {
  return resolveRewardDisplay(trade);
}
