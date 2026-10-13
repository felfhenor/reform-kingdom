import type { HasSprite } from '@interfaces/artable';
import type { JobAbilityContent } from '@interfaces/content-jobability';
import type { HasRarity } from '@interfaces/droppable';

export type JobAbilityRank = { level: number; value: number };

export type JobAbilityRow = HasRarity &
  HasSprite & {
    ability: JobAbilityContent;
    // Ability name suffixed with the held tier's numeral, e.g. "Ambush II".
    name: string;
    current?: JobAbilityRank;
    next?: JobAbilityRank;
  };
