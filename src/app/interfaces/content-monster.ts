import type { HasAnimation } from '@interfaces/artable';
import type { TargettingPriorityEntry } from '@interfaces/combat';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type {
  DroppedReward,
  HasRarity,
  LeveledRange,
} from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type MonsterId = Branded<string, 'MonsterId'>;

export type MonsterSkill = {
  skillId: EquipmentSkillId;
  weight: number;
};

export type MonsterContent = IsContentItem &
  HasDescription &
  HasAnimation &
  HasRarity & {
    id: MonsterId;
    baseStats: StatBlock;
    statsPerLevel: StatBlock;

    // Priority list of targeting modes, tried in order - see combatGetTargetsFromPriorityList.
    targetting: TargettingPriorityEntry[];

    xp: LeveledRange;

    drops: DroppedReward[];

    skills: MonsterSkill[];
  };
