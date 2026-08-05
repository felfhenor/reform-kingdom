import type { CollectibleContent } from '@interfaces/content-collectible';
import type { RecipeContent } from '@interfaces/content-recipe';

export type MuseumTab = 'collectibles' | 'recipes';

export type MuseumCollectibleEntry = {
  collectible: CollectibleContent;
  discovered: boolean;
  quantity: number;
  foundAtNode?: string;
  sourceNodeNames: string[];
};

// Only recipes that can be found as a world drop are museum-worthy - recipes
// that are only ever learned by leveling a tradeskill building never get an
// entry (see `getMuseumRecipeEntries`).
export type MuseumRecipeEntry = {
  recipe: RecipeContent;
  discovered: boolean;
  foundAtNode?: string;
  sourceNodeNames: string[];
};
