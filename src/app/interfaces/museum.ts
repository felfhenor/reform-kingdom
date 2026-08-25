import type { CollectibleContent } from '@interfaces/content-collectible';
import type { RecipeContent } from '@interfaces/content-recipe';
import type { CollectibleSource } from '@interfaces/collectible-source';

export type MuseumTab = 'collectibles' | 'recipes';

export type MuseumCollectibleEntry = {
  collectible: CollectibleContent;
  discovered: boolean;
  quantity: number;
  source?: CollectibleSource;
};

// Only world-drop recipes get an entry; sourceNodeNames is always computed live, never stored.
// tokenUnlockCost is only ever set for undiscovered entries - a discovered
// recipe has nothing left to unlock.
export type MuseumRecipeEntry = {
  recipe: RecipeContent;
  discovered: boolean;
  sourceNodeNames: string[];
  tokenUnlockCost?: number;
};
