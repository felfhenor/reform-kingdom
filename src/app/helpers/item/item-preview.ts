import { getEntry } from '@helpers/content/content';
import {
  recipeBackdropSprite,
  recipeResultContent,
  recipeResultSpritesheet,
  recipeStylizedName,
} from '@helpers/crafting/recipes';
import { partyGet } from '@helpers/hero/party';
import { equipmentItemMiscAffixDescriptions } from '@helpers/item/affix';
import { equipmentItemGatherYieldBonuses } from '@helpers/item/equipment-bonus';
import {
  equipmentItemBonusCombatStats,
  equipmentItemBonusMonsterTypeDamage,
  equipmentItemBonusResistances,
  equipmentItemBonusStats,
} from '@helpers/item/equipment-display';
import { equipmentItemGrantedSkills } from '@helpers/item/equipment-display.ui';
import {
  type CollectibleContent,
  type CollectibleId,
  type EquipmentContent,
  type EquipmentId,
  type EquipmentItem,
  type GatherYieldBonus,
  type ItemContent,
  type ItemId,
  type ItemPreviewContent,
  type ItemPreviewDisplay,
  type ItemPreviewSpritesheet,
  type JobContent,
  type RecipeContent,
  type RecipeId,
  type TradeskillContent,
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

// Resolves each tradeskillId to its display name/icon - shared by the equipment tooltip and the infusion screen (a raw, uncombined material's own infusionGatherYieldBonuses).
export function resolveGatherYieldBonusDisplay(
  bonuses: GatherYieldBonus[],
): NonNullable<ItemPreviewDisplay['gatherYieldBonuses']> {
  return bonuses.map((bonus) => {
    const tradeskill = getEntry<TradeskillContent>(bonus.tradeskillId);
    return {
      tradeskillName: tradeskill?.name ?? bonus.tradeskillId,
      tradeskillSprite: tradeskill?.sprite ?? '',
      value: bonus.value,
    };
  });
}

// undefined (not []) when there's nothing to show, matching how resistances/combatStats stay undefined for gear with no bonus in that dimension.
function gatherYieldBonusDisplay(
  content: EquipmentContent,
  instance?: EquipmentItem,
): ItemPreviewDisplay['gatherYieldBonuses'] {
  const bonuses = resolveGatherYieldBonusDisplay(
    equipmentItemGatherYieldBonuses(content, instance),
  );

  return bonuses.length > 0 ? bonuses : undefined;
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
      monsterTypeDamage: eqContent.monsterTypeDamage,
      gatherYieldBonuses: gatherYieldBonusDisplay(eqContent, instance),
      levelRequirement: eqContent.levelRequirement,
      equippableHeroNames: equippableHeroNames(eqContent),
      ...(instance && {
        bonusStats: equipmentItemBonusStats(instance),
        bonusResistances: equipmentItemBonusResistances(instance),
        bonusCombatStats: equipmentItemBonusCombatStats(instance),
        bonusMonsterTypeDamage: equipmentItemBonusMonsterTypeDamage(instance),
        miscAffixDescriptions: equipmentItemMiscAffixDescriptions(instance),
      }),
    } as ItemPreviewDisplay;
  }

  if ('infusionStats' in content) {
    const infusionGatherYieldBonuses = resolveGatherYieldBonusDisplay(
      content.infusionGatherYieldBonuses ?? [],
    );

    return {
      ...base,
      stats: content.infusionStats,
      resistances: content.infusionDebuffResistances,
      combatStats: content.infusionCombatStats,
      monsterTypeDamage: content.infusionMonsterTypeDamage,
      gatherYieldBonuses:
        infusionGatherYieldBonuses.length > 0
          ? infusionGatherYieldBonuses
          : undefined,
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
