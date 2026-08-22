import { getEntry } from '@helpers/content';
import { partyGet } from '@helpers/party';
import type {
  EquipmentContent,
  ItemPreviewContent,
  ItemPreviewDisplay,
  ItemPreviewSpritesheet,
  JobContent,
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
      levelRequirement: content.levelRequirement,
      equippableHeroNames: equippableHeroNames(content),
    };
  }

  if ('infusionStats' in content) {
    return {
      ...base,
      stats: content.infusionStats,
      resistances: content.infusionDebuffResistances,
    };
  }

  return base;
}
