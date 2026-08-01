import type { HasAnimation } from '@interfaces/artable';
import type { CombatantTargettingType } from '@interfaces/combat';
import type { ItemId } from '@interfaces/content-item';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type MonsterId = Branded<string, 'MonsterId'>;

export type MonsterDroppedItem = {
  itemId: ItemId;
  min: number;
  max: number;
};

export type MonsterContent = IsContentItem &
  HasDescription &
  HasAnimation & {
    id: MonsterId;
    baseStats: StatBlock;
    statsPerLevel: StatBlock;

    targettingType: CombatantTargettingType;

    xpMin: number;
    xpMax: number;

    droppedItems: MonsterDroppedItem[];
  };
