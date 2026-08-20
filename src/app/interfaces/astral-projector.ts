import type { CollectibleContent } from '@interfaces/content-collectible';
import type { ItemContent } from '@interfaces/content-item';

// `discovered` drives the bestiary-style "???" masking for an unfound material.
export type AstralProjectorMaterialEntry = {
  content: ItemContent | undefined;
  quantity: number;
  owned: number;
  discovered: boolean;
};

// Always discovered - unlocking the spell already required finding it (not consumed).
export type AstralProjectorCollectibleEntry = {
  content: CollectibleContent | undefined;
};
