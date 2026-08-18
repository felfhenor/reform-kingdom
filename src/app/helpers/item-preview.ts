import type {
  ItemPreviewContent,
  ItemPreviewDisplay,
  ItemPreviewSpritesheet,
} from '@interfaces';

// Normalizes an item/equipment/collectible down to the flattened shape
// `app-tooltip-item-preview` renders - equipment surfaces its base stats and
// level requirement, an item surfaces its infusion stats (if any), and a
// collectible carries neither.
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
    };
  }

  if ('infusionStats' in content) {
    return { ...base, stats: content.infusionStats };
  }

  return base;
}
