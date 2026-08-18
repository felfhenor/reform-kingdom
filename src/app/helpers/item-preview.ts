import { getEntry } from '@helpers/content';
import { partyGet } from '@helpers/party';
import type {
  EquipmentContent,
  ItemPreviewContent,
  ItemPreviewDisplay,
  ItemPreviewSpritesheet,
  JobContent,
} from '@interfaces';

// Party hero names whose job can equip `equipment`'s type - shown by every
// item tooltip (see `TooltipItemPreviewComponent`) so the player can tell at
// a glance whether anyone can use a piece of gear.
function equippableHeroNames(equipment: EquipmentContent): string[] {
  return partyGet()
    .filter((hero) =>
      getEntry<JobContent>(hero.jobId)?.equippableTypes.includes(
        equipment.type,
      ),
    )
    .map((hero) => hero.name);
}

// Normalizes an item/equipment/collectible down to the flattened shape
// `app-tooltip-item-preview` renders - equipment surfaces its base stats,
// level requirement, and who can equip it, an item surfaces its infusion
// stats (if any), and a collectible carries neither.
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
      levelRequirement: content.levelRequirement,
      equippableHeroNames: equippableHeroNames(content),
    };
  }

  if ('infusionStats' in content) {
    return { ...base, stats: content.infusionStats };
  }

  return base;
}
