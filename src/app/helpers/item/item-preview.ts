import { getEntry } from '@helpers/content/content';
import {
  recipeBackdropSprite,
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers/crafting/recipes';
import { partyGet } from '@helpers/hero/party';
import type {
  CollectibleContent,
  CollectibleId,
  EquipmentContent,
  ItemContent,
  ItemPreviewContent,
  ItemPreviewDisplay,
  ItemPreviewSpritesheet,
  JobContent,
  RecipeContent,
  RecipeId,
} from '@interfaces';

// Hero names whose job can equip this type, shown in item tooltips.
function equippableHeroNames(equipment: EquipmentContent): string[] {
  return partyGet()
    .filter((hero) =>
      getEntry<JobContent>(hero.jobId)?.equippableTypes.includes(
        equipment.type,
      ),
    )
    .map((hero) => hero.name);
}

// Flattens item/equipment/collectible to the shape app-tooltip-item-preview renders.
export function itemPreviewDisplay(
  content: ItemPreviewContent,
  spritesheet: ItemPreviewSpritesheet,
): ItemPreviewDisplay {
  const base = {
    name: content.name,
    description: content.description,
    sprite: content.sprite,
    spritesheet,
    rarity: content.rarity,
  };

  if ('baseStats' in content) {
    return {
      ...base,
      stats: content.baseStats,
      resistances: content.debuffResistances,
      combatStats: content.combatStats,
      levelRequirement: content.levelRequirement,
      equippableHeroNames: equippableHeroNames(content),
    };
  }

  if ('infusionStats' in content) {
    return {
      ...base,
      stats: content.infusionStats,
      resistances: content.infusionDebuffResistances,
      combatStats: content.infusionCombatStats,
    };
  }

  return base;
}

// Shared by anything offering a reward/stock pick from this same itemId/equipmentId/collectibleId/recipeId union - e.g. CaravanTrade, TownStockEntry.
export function resolveRewardDisplay(reward: {
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
