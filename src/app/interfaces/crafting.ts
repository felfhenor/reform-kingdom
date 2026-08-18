import type { ChanceTier } from '@interfaces/chance-tier';
import type { CollectibleContent } from '@interfaces/content-collectible';
import type { EquipmentContent } from '@interfaces/content-equipment';
import type { ItemContent } from '@interfaces/content-item';
import type { RecipeContent, RecipeId } from '@interfaces/content-recipe';
import type { Branded } from '@interfaces/identifiable';
import type { ItemPreviewDisplay } from '@interfaces/item-preview';
import type { Tradeskill } from '@interfaces/tradeskill';

export type CraftQueueEntryId = Branded<string, 'CraftQueueEntryId'>;

export type CraftQueueEntry = {
  id: CraftQueueEntryId;
  recipeId: RecipeId;
  quantityTotal: number;
  quantityCompleted: number;
  ticksIntoCraft: number;
};

export type TradeskillBuildingState = {
  level: number;
  xp: { current: number; maximum: number };
  queue: CraftQueueEntry[];
};

export type GameStateTradeskills = Record<Tradeskill, TradeskillBuildingState>;

// A single requirement resolved for display - collectible requirements
// aren't consumed, so `quantity` is always 1 for them (a possession gate,
// not a cost).
export type CraftRequirementEntry = {
  kind: 'collectible' | 'equipment' | 'item';
  content: CollectibleContent | EquipmentContent | ItemContent | undefined;
  spritesheet: 'collectible' | 'equipment' | 'item';
  quantity: number;
  owned: number;
};

// A recipe resolved for display in a tradeskill's craft list - everything
// the UI needs to render + sort a row without re-deriving it per-field.
export type CraftRecipeEntry = {
  recipe: RecipeContent;
  resultContent:
    ItemContent | EquipmentContent | CollectibleContent | undefined;
  resultSpritesheet: 'item' | 'equipment' | 'collectible';
  resultDisplay: ItemPreviewDisplay | undefined;
  resultChance: number;
  backdropSprite: string | undefined;
  maxCraftable: number;
  ownedQuantity: number;
  xp: number;
  xpChance: number;
  xpChanceTier: ChanceTier;
  requirementEntries: CraftRequirementEntry[];
};
