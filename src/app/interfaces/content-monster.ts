import type { HasAnimation } from '@interfaces/artable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type MonsterId = Branded<string, 'MonsterId'>;

export type MonsterContent = IsContentItem &
  HasDescription &
  HasAnimation & {
    id: MonsterId;
    baseStats: StatBlock;
    statsPerLevel: StatBlock;
  };
