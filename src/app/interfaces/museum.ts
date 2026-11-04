import type { CollectibleSource } from '@interfaces/collectible-source';
import type { CollectibleContent } from '@interfaces/content-collectible';
import type { ItemContent } from '@interfaces/content-item';
import type { RecipeContent } from '@interfaces/content-recipe';

export type MuseumCanBeDiscovered = { discovered: boolean };

export type MuseumDiscoverableSingleSource = MuseumCanBeDiscovered & {
  source?: CollectibleSource;
};

export type MuseumDiscoverableMultipleSources = MuseumCanBeDiscovered & {
  sourceNodeNames: string[];
};

export type MuseumCollectibleEntry = MuseumDiscoverableSingleSource & {
  collectible: CollectibleContent;
  quantity: number;
};

// Only world-drop recipes get an entry; sourceNodeNames is always computed live, never stored.
// tokenUnlockCost is only ever set for undiscovered entries - a discovered
// recipe has nothing left to unlock.
export type MuseumRecipeEntry = MuseumDiscoverableMultipleSources & {
  recipe: RecipeContent;
  tokenUnlockCost?: number;
};

export type MuseumItemEntry = MuseumDiscoverableMultipleSources & {
  item: ItemContent;
};
