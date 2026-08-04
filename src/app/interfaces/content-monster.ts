import type { HasAnimation } from '@interfaces/artable';
import type { CombatantTargettingType } from '@interfaces/combat';
import type { ItemId } from '@interfaces/content-item';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type { HasRarity } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type MonsterId = Branded<string, 'MonsterId'>;

export type MonsterXpReward = {
  min: number;
  max: number;
  multiplierPerLevel: number;
};

export type MonsterDroppedItem = {
  itemId: ItemId;
  min: number;
  max: number;
  multiplierPerLevel: number;
  chance: number;
};

export type MonsterSkill = {
  skillId: EquipmentSkillId;
};

export type MonsterContent = IsContentItem &
  HasDescription &
  HasAnimation &
  HasRarity & {
    id: MonsterId;
    baseStats: StatBlock;
    statsPerLevel: StatBlock;

    targettingType: CombatantTargettingType;

    xp: MonsterXpReward;

    droppedItems: MonsterDroppedItem[];

    skills: MonsterSkill[];
  };
