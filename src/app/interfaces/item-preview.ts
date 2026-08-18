import type { CollectibleContent } from '@interfaces/content-collectible';
import type { EquipmentContent } from '@interfaces/content-equipment';
import type { ItemContent } from '@interfaces/content-item';
import type { DropRarity } from '@interfaces/droppable';
import type { StatBlock } from '@interfaces/stat';

// Anything `itemPreviewDisplay` can normalize down to a hover preview - the
// three content kinds a recipe, stored material, or caravan trade can
// resolve to.
export type ItemPreviewContent = ItemContent | EquipmentContent | CollectibleContent;

export type ItemPreviewSpritesheet = 'item' | 'equipment' | 'collectible';

// The flattened shape `app-tooltip-item-preview` renders - normalized from
// any of the three `ItemPreviewContent` kinds via `itemPreviewDisplay`.
export type ItemPreviewDisplay = {
  name: string;
  description: string;
  sprite: string;
  spritesheet: ItemPreviewSpritesheet;
  rarity: DropRarity;
  // Infusion stats for an item, base stats for equipment - undefined for a
  // collectible, or an item with no infusion stats to show.
  stats?: StatBlock;
  // Equipment only.
  levelRequirement?: number;
  // Equipment only - party hero names whose job can equip this item.
  equippableHeroNames?: string[];
};
