import type { HasSprite } from '@interfaces/artable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { GameStat, StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type TrinketId = Branded<string, 'TrinketId'>;

export type TrinketContent = IsContentItem &
  HasDescription &
  HasSprite & {
    id: TrinketId;
    baseStats: StatBlock;
    upgradeableStats: GameStat[];
  };
