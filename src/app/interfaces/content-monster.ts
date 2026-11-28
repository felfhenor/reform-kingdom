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
