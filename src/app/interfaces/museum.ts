import type { CollectibleContent } from '@interfaces/content-collectible';

export type MuseumTab = 'collectibles' | 'recipes';

export type MuseumCollectibleEntry = {
  collectible: CollectibleContent;
  discovered: boolean;
  quantity: number;
  foundAtNode?: string;
  sourceNodeNames: string[];
};
