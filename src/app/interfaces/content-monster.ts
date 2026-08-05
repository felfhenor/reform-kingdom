import type { HasAnimation } from '@interfaces/artable';
import type { CombatantTargettingType } from '@interfaces/combat';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type {
  DropHasLevelMultiplier,
  DropRange,
  DroppedReward,
  HasRarity,
} from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type MonsterId = Branded<string, 'MonsterId'>;

export type MonsterXpReward = DropRange & DropHasLevelMultiplier;

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

    drops: DroppedReward[];

    skills: MonsterSkill[];
  };
