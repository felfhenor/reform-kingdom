import type { ChanceTier } from '@interfaces/chance-tier';
import type { CollectibleContent } from '@interfaces/content-collectible';
import type { EquipmentContent } from '@interfaces/content-equipment';
import type { ItemContent } from '@interfaces/content-item';
import type { RecipeContent, RecipeId } from '@interfaces/content-recipe';
import type { TradeskillId } from '@interfaces/content-tradeskill';
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

export type GameStateTradeskills = Record<
  TradeskillId,
  TradeskillBuildingState
>;

// Display-only shape for one active-craft corner card - built by
// `craftingActiveStatusEntries`, rendered by `card-status-crafting`.
export type CraftingStatusEntry = {
  tradeskillId: TradeskillId;
  tradeskill: Tradeskill;
  // The recipe's own name with its "Category: " prefix stripped (see
  // `stripRecipeCategory`) - just the item, e.g. "Copper Ingot".
  itemName: string;
  resultSpritesheet: 'item' | 'equipment' | 'collectible';
  resultSprite: string;
  // Whole-queue remaining ticks for this tradeskill, not just the item above.
  remainingTicks: number;
};

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
