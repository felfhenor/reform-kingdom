import type { HasAnimation } from '@interfaces/artable';
import type { JobAbilityId } from '@interfaces/content-jobability';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type { EquipmentItemType } from '@interfaces/equipment';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { BaseStat, StatBlock } from '@interfaces/stat';
import type { HasDescription } from '@interfaces/traits';

export type JobId = Branded<string, 'JobId'>;

export type JobSkillPathLevel = {
  level: number;
  skillId: EquipmentSkillId;
};

export type JobSkillPath = {
  pathName: string;
  levels: JobSkillPathLevel[];
};

// One rank of a job ability; a hero uses the highest rank at or below their level.
export type JobAbilityLevel = {
  jobAbilityId: JobAbilityId;
  level: number;
  value: number;
};

export type JobStatPriority = {
  stat: BaseStat;
  multiplier: number;
};

export type JobContent = IsContentItem &
  HasDescription &
  HasAnimation & {
    id: JobId;

    shorthand: string;

    baseStats: StatBlock;
    statsPerLevel: StatBlock;

    equippableTypes: EquipmentItemType[];

    // Stats "Optimize Equipment" favors, highest priority first; ties fall back to level requirement.
    statPriority: JobStatPriority[];

    skillPath: JobSkillPath[];

    abilities: JobAbilityLevel[];
  };
