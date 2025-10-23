import type { HasAnimation } from '@interfaces/artable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type HeroId = Branded<string, 'HeroId'>;

export type HeroContent = IsContentItem &
  HasDescription &
  HasAnimation & {
    id: HeroId;
    baseStats: StatBlock;
    statsPerLevel: StatBlock;
    startingWeaponIds: string[];
  };
