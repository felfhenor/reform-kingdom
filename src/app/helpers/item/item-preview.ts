import { getEntry } from '@helpers/content/content';
import {
  recipeBackdropSprite,
  recipeResultContent,
  recipeResultSpritesheet,
  recipeStylizedName,
} from '@helpers/crafting/recipes';
import { partyGet } from '@helpers/hero/party';
import { equipmentItemGrantedSkills } from '@helpers/item/equipment-display.ui';
import {
  type CollectibleContent,
  type CollectibleId,
  type EquipmentContent,
  type EquipmentId,
  type EquipmentItem,
  type ItemContent,
  type ItemId,
  type ItemPreviewContent,
  type ItemPreviewDisplay,
  type ItemPreviewSpritesheet,
  type JobContent,
  type RecipeContent,
  type RecipeId,
  type WorkerContent,
  type WorkerId,
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

export function itemPreviewDisplay(
  spritesheet: ItemPreviewSpritesheet,
  content: ItemPreviewContent,
  instance?: EquipmentItem,
): ItemPreviewDisplay {
  const base: Partial<ItemPreviewDisplay> = {
    name: content.name,
    description: content.description,
    sprite: content.sprite,
    spritesheet,
    rarity: content.rarity,
    skills: [],
  };

  if (instance) {
    base.skills = equipmentItemGrantedSkills(
      instance,
      content as EquipmentContent,
    );
  }

  if (spritesheet === 'worker') {
    return base as ItemPreviewDisplay;
  }

  if ('baseStats' in content) {
    const eqContent = content as EquipmentContent;
    return {
      ...base,
      stats: eqContent.baseStats,
      resistances: eqContent.debuffResistances,
      combatStats: eqContent.combatStats,
      levelRequirement: eqContent.levelRequirement,
      equippableHeroNames: equippableHeroNames(eqContent),
    } as ItemPreviewDisplay;
  }

  if ('infusionStats' in content) {
    return {
      ...base,
      stats: content.infusionStats,
      resistances: content.infusionDebuffResistances,
      combatStats: content.infusionCombatStats,
    } as ItemPreviewDisplay;
  }

  return base as ItemPreviewDisplay;
}

// Shared by anything offering a reward/stock pick from this same itemId/equipmentId/collectibleId/recipeId union.
export function resolveRewardDisplay(reward: {
  itemId?: ItemId;
  equipmentId?: EquipmentId;
  workerId?: WorkerId;
  equipmentItem?: EquipmentItem;
  collectibleId?: CollectibleId;
  recipeId?: RecipeId;
}): ItemPreviewDisplay | undefined {
  if (reward.itemId) {
    const item = getEntry<ItemContent>(reward.itemId);
    return item ? itemPreviewDisplay('item', item) : undefined;
  }

  if (reward.equipmentId) {
    const equipment = getEntry<EquipmentContent>(reward.equipmentId);
    return equipment
      ? itemPreviewDisplay('equipment', equipment, reward.equipmentItem)
      : undefined;
  }

  if (reward.collectibleId) {
    const collectible = getEntry<CollectibleContent>(reward.collectibleId);
    return collectible
      ? itemPreviewDisplay('collectible', collectible)
      : undefined;
  }

  if (reward.recipeId) {
    const recipe = getEntry<RecipeContent>(reward.recipeId);
    const result = recipe ? recipeResultContent(recipe) : undefined;
    if (!recipe || !result) return undefined;

    // Recipe's own name, not the crafted item's - it grants the blueprint.
    return {
      ...itemPreviewDisplay(recipeResultSpritesheet(recipe), result),
      name: recipeStylizedName(recipe),
      backdropSprite: recipeBackdropSprite(),
    };
  }

  if (reward.workerId) {
    const worker = getEntry<WorkerContent>(reward.workerId);
    return worker ? itemPreviewDisplay('worker', worker) : undefined;
  }

  return undefined;
}
