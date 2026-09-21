import type { HasAnimation } from '@interfaces/artable';
import type { CombatStat, TargettingPriorityEntry } from '@interfaces/combat';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type {
  DropLevelRange,
  DroppedReward,
  HasRarity,
  LeveledRange,
} from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { StatDisplayDimension } from '@interfaces/stat-display';
import type { HasDescription } from '@interfaces/traits';

export type MonsterId = Branded<string, 'MonsterId'>;

export type MonsterType =
  'Humanoid' | 'Demon' | 'Amalgamation' | 'Insect' | 'Beast' | 'Spirit';

export const MonsterTypeDimension: StatDisplayDimension<MonsterType> = {
  order: ['Humanoid', 'Demon', 'Amalgamation', 'Insect', 'Beast', 'Spirit'],
  label: {
    Humanoid: 'Humanoid Damage',
    Demon: 'Demon Damage',
    Amalgamation: 'Amalgamation Damage',
    Insect: 'Insect Damage',
    Beast: 'Beast Damage',
    Spirit: 'Spirit Damage',
  },
  icon: {
    Humanoid: 'gamePerson',
    Demon: 'gameDevilMask',
    Amalgamation: 'gameSlime',
    Insect: 'gameFlyingBeetle',
    Beast: 'gameWolfHead',
    Spirit: 'gameGhost',
  },
};

export type MonsterSkill = DropLevelRange & {
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
    combatStats: Record<CombatStat, number>;

    types: MonsterType[];

    // Priority list of targeting modes, tried in order.
    targetting: TargettingPriorityEntry[];

    xp: LeveledRange;

    drops: DroppedReward[];

    skills: MonsterSkill[];
  };
