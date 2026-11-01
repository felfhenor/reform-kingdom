import type { HasAnimation } from '@interfaces/artable';
import type { CombatStat, TargettingPriorityEntry } from '@interfaces/combat';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type {
  DropLevelRange,
  DroppedReward,
  HasRarity,
  LeveledRange,
} from '@interfaces/droppable';
import type { ElementBlock } from '@interfaces/element';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';
import type { StatusEffectBlock } from '@interfaces/content-statuseffect';
import type { StatDisplayDimension } from '@interfaces/stat-display';
import type { HasDescription } from '@interfaces/traits';

export type MonsterId = Branded<string, 'MonsterId'>;

export type MonsterType =
  | 'Humanoid'
  | 'Demon'
  | 'Amalgamation'
  | 'Insect'
  | 'Beast'
  | 'Spirit'
  | 'Forgetter';

export const MonsterTypeDimension: StatDisplayDimension<MonsterType> = {
  order: [
    'Humanoid',
    'Demon',
    'Amalgamation',
    'Insect',
    'Beast',
    'Spirit',
    'Forgetter',
  ],
  label: {
    Humanoid: 'Humanoid Damage',
    Demon: 'Demon Damage',
    Amalgamation: 'Amalgamation Damage',
    Insect: 'Insect Damage',
    Beast: 'Beast Damage',
    Spirit: 'Spirit Damage',
    Forgetter: 'Forgetter Damage',
  },
  icon: {
    Humanoid: 'gamePerson',
    Demon: 'gameDevilMask',
    Amalgamation: 'gameSlime',
    Insect: 'gameFlyingBeetle',
    Beast: 'gameWolfHead',
    Spirit: 'gameGhost',
    Forgetter: 'gameBrain',
  },
  color: {
    Humanoid: 'text-pink-400',
    Demon: 'text-cyan-400',
    Amalgamation: 'text-green-700',
    Insect: 'text-amber-900',
    Beast: 'text-red-700',
    Spirit: 'text-purple-700',
    Forgetter: 'text-slate-400',
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

    // Negative = weakness.
    elementalResistances?: ElementBlock;

    debuffResistances?: Partial<StatusEffectBlock>;

    // Priority list of targeting modes, tried in order.
    targetting: TargettingPriorityEntry[];

    xp: LeveledRange;

    drops: DroppedReward[];

    skills: MonsterSkill[];
  };
