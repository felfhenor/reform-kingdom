import type { HasSprite } from '@interfaces/artable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { GameStat, StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type WeaponId = Branded<string, 'WeaponId'>;

export type WeaponContent = IsContentItem &
  HasDescription &
  HasSprite & {
    id: WeaponId;
    baseStats: StatBlock;
    upgradeableStats: GameStat[];
  };
